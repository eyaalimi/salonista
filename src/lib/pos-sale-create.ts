/**
 * Server-side sale creation logic shared by `POST /api/pos/sales` (online)
 * and `POST /api/pos/sales/sync` (offline batch).
 *
 * Wraps everything in a single Prisma transaction:
 *   1. Resolve & snapshot offers/products.
 *   2. Recompute totals server-side; reject if client diverges.
 *   3. Decrement product stock (allow negative; flag review).
 *   4. Generate receipt number (atomic via SaleSequence).
 *   5. Insert Sale + items + payments + tip allocations + stock movements.
 *
 * Idempotency: if `offlineId` is provided and a Sale with that offlineId
 * already exists for this provider, the existing sale is returned instead
 * of creating a duplicate.
 */

import { prisma } from "@/lib/prisma";
import { computeTotals, type CartInput } from "@/lib/sale-totals";
import { toMillimes, fromMillimes } from "@/lib/money";
import { nextReceiptNumber } from "@/lib/receipt-number";
import { findOpenSession } from "@/lib/cash-drawer";
import { applySaleEarnings } from "@/lib/rewards/earn";
import { applySaleRedemption, validateRedemption, RedemptionError } from "@/lib/rewards/redeem";
import { sendLoyaltyEarnedEmail } from "@/lib/mail";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type SalePayloadLine = {
  kind: "SERVICE" | "PRODUCT";
  offerId?: string;
  productId?: string;
  quantity: number;
  discount?: { value: string; isPercent: boolean };
  assignedEmployeeId?: string;
};

export type SalePayloadPayment = {
  method: PaymentMethod;
  amount: string;
  reference?: string | null;
  /** Required when method = LOYALTY_POINTS. */
  pointsRedeemed?: number;
  /** Required when method = LOYALTY_POINTS. */
  walletId?: string;
};

export type SalePayloadTipAllocation = {
  employeeId: string;
  amount: string;
};

export type SalePayload = {
  offlineId?: string;
  customerId?: string | null;
  lines: SalePayloadLine[];
  saleDiscount?: { value: string; isPercent: boolean };
  payments: SalePayloadPayment[];
  tipTotal?: string;
  tipAllocations?: SalePayloadTipAllocation[];
  notes?: string | null;
  bookingId?: string | null;
  /** Optional override for the createdAt timestamp (used by offline sync). */
  createdAt?: string;
};

export type SaleConflict =
  | { type: "customer_deleted" }
  | { type: "product_deleted"; productId: string }
  | { type: "offer_deleted"; offerId: string }
  | { type: "price_drift"; itemId: string; oldPrice: string; newPrice: string }
  | { type: "stock_negative"; productId: string; quantity: number };

export type SaleCreateResult =
  | {
      kind: "ok";
      saleId: string;
      receiptNumber: string;
      status: SaleStatus;
      rewards?: { earned: number; redeemed: number; welcomeBonus: number; birthdayBonus: number };
    }
  | { kind: "duplicate"; saleId: string; receiptNumber: string }
  | { kind: "validation"; error: string; conflicts?: SaleConflict[] };

const TOTAL_TOLERANCE_MILLIMES = 1; // 0.001 DT

export async function createSaleFromPayload(args: {
  payload: SalePayload;
  providerId: string;
  employeeId: string;
  /** Total computed client-side; server recomputes and compares. Optional. */
  clientTotal?: string;
  /** When true, this is an offline-sync path; missing entities become conflicts
   *  rather than 404s, and the sale completes anyway. */
  fromSync?: boolean;
}): Promise<SaleCreateResult> {
  const { payload, providerId, employeeId, clientTotal, fromSync } = args;

  // Idempotency: short-circuit if this offlineId was already processed.
  if (payload.offlineId) {
    const existing = await prisma.sale.findUnique({
      where: { offlineId: payload.offlineId },
      select: { id: true, providerId: true, receiptNumber: true },
    });
    if (existing && existing.providerId === providerId) {
      return {
        kind: "duplicate",
        saleId: existing.id,
        receiptNumber: existing.receiptNumber,
      };
    }
  }

  const conflicts: SaleConflict[] = [];

  // Resolve customer.
  let customerId: string | null = payload.customerId ?? null;
  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      if (fromSync) {
        conflicts.push({ type: "customer_deleted" });
        customerId = null;
      } else {
        return { kind: "validation", error: "Client introuvable" };
      }
    }
  }

  // Resolve & snapshot lines.
  type ResolvedLine = {
    kind: "SERVICE" | "PRODUCT";
    offerId: string | null;
    productId: string | null;
    nameSnapshot: string;
    priceSnapshot: string;
    taxRateSnapshot: string;
    quantity: number;
    discount?: { value: string; isPercent: boolean };
    assignedEmployeeId: string | null;
  };
  const resolved: ResolvedLine[] = [];

  for (const line of payload.lines) {
    if (line.kind === "SERVICE") {
      if (!line.offerId)
        return { kind: "validation", error: "Service sans offerId" };
      const offer = await prisma.offer.findUnique({ where: { id: line.offerId } });
      if (!offer || offer.providerId !== providerId) {
        if (fromSync) {
          conflicts.push({ type: "offer_deleted", offerId: line.offerId });
          continue;
        }
        return { kind: "validation", error: `Service introuvable: ${line.offerId}` };
      }
      resolved.push({
        kind: "SERVICE",
        offerId: offer.id,
        productId: null,
        nameSnapshot: offer.title,
        priceSnapshot: String(offer.discountPrice),
        taxRateSnapshot: String(offer.taxRate),
        quantity: line.quantity,
        discount: line.discount,
        assignedEmployeeId: line.assignedEmployeeId ?? null,
      });
    } else {
      if (!line.productId)
        return { kind: "validation", error: "Produit sans productId" };
      const product = await prisma.product.findUnique({ where: { id: line.productId } });
      if (!product || product.providerId !== providerId) {
        if (fromSync) {
          conflicts.push({ type: "product_deleted", productId: line.productId });
          continue;
        }
        return { kind: "validation", error: `Produit introuvable: ${line.productId}` };
      }
      resolved.push({
        kind: "PRODUCT",
        offerId: null,
        productId: product.id,
        nameSnapshot: product.name,
        priceSnapshot: String(product.salePrice),
        taxRateSnapshot: String(product.taxRate),
        quantity: line.quantity,
        discount: line.discount,
        assignedEmployeeId: line.assignedEmployeeId ?? null,
      });
    }
  }

  if (resolved.length === 0) {
    return { kind: "validation", error: "Panier vide après résolution", conflicts };
  }

  // Recompute totals server-side (authoritative).
  const cartForCompute: CartInput = {
    lines: resolved.map((r) => ({
      kind: r.kind,
      offerId: r.offerId ?? undefined,
      productId: r.productId ?? undefined,
      nameSnapshot: r.nameSnapshot,
      priceSnapshot: r.priceSnapshot,
      taxRateSnapshot: r.taxRateSnapshot,
      quantity: r.quantity,
      discount: r.discount,
      assignedEmployeeId: r.assignedEmployeeId ?? undefined,
    })),
    saleDiscount: payload.saleDiscount,
    tipTotal: payload.tipTotal,
  };
  const totals = computeTotals(cartForCompute);

  // Validate client/server convergence.
  if (clientTotal !== undefined) {
    const diff = Math.abs(toMillimes(clientTotal) - toMillimes(totals.total));
    if (diff > TOTAL_TOLERANCE_MILLIMES) {
      return {
        kind: "validation",
        error: `Total client/serveur divergent (client=${clientTotal}, serveur=${totals.total})`,
      };
    }
  }

  // Validate sum of payments equals total.
  const paymentSumM = payload.payments.reduce((s, p) => s + toMillimes(p.amount), 0);
  if (Math.abs(paymentSumM - toMillimes(totals.total)) > TOTAL_TOLERANCE_MILLIMES) {
    return {
      kind: "validation",
      error: `Somme des paiements (${fromMillimes(paymentSumM)}) différente du total (${totals.total})`,
    };
  }

  // Validate tip allocations sum equals tipTotal.
  const tipAllocs = payload.tipAllocations ?? [];
  const tipSumM = tipAllocs.reduce((s, t) => s + toMillimes(t.amount), 0);
  const tipTotalM = toMillimes(totals.tipTotal);
  if (Math.abs(tipSumM - tipTotalM) > TOTAL_TOLERANCE_MILLIMES) {
    return {
      kind: "validation",
      error: `Somme des pourboires alloués différente du total des pourboires`,
    };
  }

  // Validate any loyalty redemption payments up-front so we fail fast with a
  // clear French error rather than rolling back the transaction.
  const loyaltyPayments = payload.payments.filter((p) => p.method === "LOYALTY_POINTS");
  if (loyaltyPayments.length > 0) {
    if (!customerId) {
      return { kind: "validation", error: "Identifiez un client pour utiliser des points fidélité" };
    }
    for (const p of loyaltyPayments) {
      if (!p.walletId || !p.pointsRedeemed || p.pointsRedeemed <= 0) {
        return { kind: "validation", error: "Paiement par points incomplet (walletId/pointsRedeemed)" };
      }
      const wallet = await prisma.rewardWallet.findUnique({
        where: { id: p.walletId },
        include: { program: true },
      });
      if (!wallet || wallet.providerId !== providerId || wallet.customerId !== customerId) {
        return { kind: "validation", error: "Portefeuille fidélité introuvable" };
      }
      try {
        const { redemptionValue } = validateRedemption({
          walletBalance: wallet.balance,
          pointsToRedeem: p.pointsRedeemed,
          saleTotal: totals.total,
          program: wallet.program,
        });
        if (Math.abs(toMillimes(redemptionValue) - toMillimes(p.amount)) > TOTAL_TOLERANCE_MILLIMES) {
          return {
            kind: "validation",
            error: `Valeur des points (${redemptionValue}) différente du montant payé (${p.amount})`,
          };
        }
      } catch (err) {
        if (err instanceof RedemptionError) {
          return { kind: "validation", error: err.message };
        }
        throw err;
      }
    }
  }

  // Cash-payment sessions: link CASH payments to the cashier's currently-open
  // drawer session, if any. Offline syncs do their own resolution further
  // down (the original session may have closed before the sync happened).
  let openDrawerId: string | null = null;
  if (!fromSync) {
    const open = await findOpenSession(employeeId);
    openDrawerId = open?.id ?? null;
  } else {
    // For offline syncs, find the session that was open at the sale's
    // createdAt timestamp. If none, leave null and the sync-issues page
    // will surface it as "Paiement sans session".
    const saleDate = payload.createdAt ? new Date(payload.createdAt) : new Date();
    const session = await prisma.cashDrawerSession.findFirst({
      where: {
        employeeId,
        openedAt: { lte: saleDate },
        OR: [{ closedAt: null }, { closedAt: { gte: saleDate } }],
      },
      orderBy: { openedAt: "desc" },
    });
    openDrawerId = session?.id ?? null;
  }

  // Begin the persistence transaction.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency re-check inside the transaction.
      if (payload.offlineId) {
        const existing = await tx.sale.findUnique({
          where: { offlineId: payload.offlineId },
          select: { id: true, receiptNumber: true },
        });
        if (existing) {
          return {
            saleId: existing.id,
            receiptNumber: existing.receiptNumber,
            duplicate: true,
            rewards: { earned: 0, redeemed: 0, welcomeBonus: 0, birthdayBonus: 0 },
          };
        }
      }

      // Decrement stock for product lines.
      const stockMovementsToCreate: Array<{
        productId: string;
        delta: number;
        requiresReview: boolean;
      }> = [];
      for (const line of resolved) {
        if (line.kind !== "PRODUCT" || !line.productId) continue;
        const product = await tx.product.findUnique({
          where: { id: line.productId },
          select: { stockQuantity: true },
        });
        if (!product) continue;
        const newStock = product.stockQuantity - line.quantity;
        const requiresReview = newStock < 0;
        if (requiresReview) {
          conflicts.push({
            type: "stock_negative",
            productId: line.productId,
            quantity: line.quantity,
          });
        }
        await tx.product.update({
          where: { id: line.productId },
          data: { stockQuantity: newStock },
        });
        stockMovementsToCreate.push({
          productId: line.productId,
          delta: -line.quantity,
          requiresReview,
        });
      }

      const receiptDate = payload.createdAt ? new Date(payload.createdAt) : new Date();
      const receiptNumber = await nextReceiptNumber(tx, providerId, receiptDate);

      const sale = await tx.sale.create({
        data: {
          providerId,
          customerId,
          employeeId,
          bookingId: payload.bookingId ?? null,
          receiptNumber,
          status: "PAID",
          subtotal: totals.subtotal,
          discountAmount: totals.saleDiscountAmount,
          discountIsPercent: payload.saleDiscount?.isPercent ?? false,
          discountValue: payload.saleDiscount?.value ?? null,
          taxTotal: totals.taxTotal,
          tipTotal: totals.tipTotal,
          total: totals.total,
          notes: payload.notes ?? null,
          offlineId: payload.offlineId ?? null,
          syncedAt: fromSync ? new Date() : null,
          syncConflicts: conflicts.length > 0 ? (conflicts as unknown as Prisma.InputJsonValue) : undefined,
          closedAt: receiptDate,
          createdAt: receiptDate,
          items: {
            create: resolved.map((line, i) => ({
              kind: line.kind,
              offerId: line.offerId,
              productId: line.productId,
              assignedEmployeeId: line.assignedEmployeeId,
              nameSnapshot: line.nameSnapshot,
              priceSnapshot: line.priceSnapshot,
              taxRateSnapshot: line.taxRateSnapshot,
              quantity: line.quantity,
              discountAmount: totals.lines[i].discountAmount,
              discountIsPercent: line.discount?.isPercent ?? false,
              discountValue: line.discount?.value ?? null,
              lineSubtotal: totals.lines[i].lineSubtotal,
              lineTaxAmount: totals.lines[i].lineTaxAmount,
              lineTotal: totals.lines[i].lineTotal,
            })),
          },
          payments: {
            create: payload.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference ?? null,
              // Link CASH payments to the cashier's open drawer session if any.
              // Card / transfer / other are not affected by drawer reconciliation.
              ...(p.method === "CASH" && openDrawerId
                ? { cashDrawerSessionId: openDrawerId }
                : {}),
            })),
          },
          tipAllocations:
            tipAllocs.length > 0
              ? {
                  create: tipAllocs.map((t) => ({
                    employeeId: t.employeeId,
                    amount: t.amount,
                  })),
                }
              : undefined,
        },
      });

      // ----- Booking ↔ Sale linkage -----
      // If the sale references a booking, mark it COMPLETED and ensure the
      // sale.bookingId is set. Otherwise, auto-create a phantom Booking so
      // analytics + the calendar see this transaction.
      if (payload.bookingId) {
        await tx.booking.update({
          where: { id: payload.bookingId },
          data: { status: "COMPLETED" },
        });
      } else {
        // Compute end time from sum of service durations (default 30 min).
        let durationMin = 0;
        for (const line of resolved) {
          if (line.kind !== "SERVICE" || !line.offerId) continue;
          const offer = await tx.offer.findUnique({
            where: { id: line.offerId },
            select: { durationMinutes: true },
          });
          if (offer) durationMin += offer.durationMinutes * line.quantity;
        }
        if (durationMin === 0) durationMin = 30;

        const saleDate = payload.createdAt ? new Date(payload.createdAt) : new Date();

        // Determine clientId: the customer's linked User if present, else
        // the provider's own User.
        let phantomClientId: string | null = null;
        if (customerId) {
          const c = await tx.customer.findUnique({
            where: { id: customerId },
            select: { userId: true },
          });
          phantomClientId = c?.userId ?? null;
        }
        if (!phantomClientId) {
          const provider = await tx.providerProfile.findUnique({
            where: { id: providerId },
            select: { userId: true },
          });
          phantomClientId = provider?.userId ?? null;
        }

        // Most-common assigned employee on the lines (or null).
        const assignmentCounts = new Map<string, number>();
        for (const line of resolved) {
          if (!line.assignedEmployeeId) continue;
          assignmentCounts.set(
            line.assignedEmployeeId,
            (assignmentCounts.get(line.assignedEmployeeId) ?? 0) + 1,
          );
        }
        let assignedEmpId: string | null = null;
        for (const [eid, cnt] of assignmentCounts) {
          if (!assignedEmpId || cnt > (assignmentCounts.get(assignedEmpId) ?? 0)) {
            assignedEmpId = eid;
          }
        }

        if (!phantomClientId) {
          // No clientId resolvable (deleted user + provider with no
          // userId — extremely rare). The sale persists, but it won't
          // appear in the calendar or analytics. Flag the sale row so
          // /pos/sync-issues surfaces it for an owner to investigate.
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              syncConflicts: [
                ...(conflicts as object[]),
                { type: "phantom_booking_skipped" },
              ] as Prisma.InputJsonValue,
            },
          });
          console.warn(
            `[pos-sale-create] phantom booking skipped for sale ${sale.id}: no clientId resolvable`,
          );
        } else {
          const phantomBooking = await tx.booking.create({
            data: {
              clientId: phantomClientId,
              customerId: customerId,
              walkIn: true,
              createdViaPos: true,
              phantom: true,
              assignedEmployeeId: assignedEmpId,
              status: "COMPLETED",
              totalPrice: totals.total,
              createdAt: saleDate,
            },
          });
          await tx.sale.update({
            where: { id: sale.id },
            data: { bookingId: phantomBooking.id },
          });
        }
      }

      // ----- Reward Points -----
      // Apply redemption(s) first (decrements wallet, creates REDEEM_PURCHASE),
      // then earnings (computeEarnedPoints already excludes the loyalty-paid
      // share so points don't beget points).
      let rewardsResult: {
        earned: number;
        redeemed: number;
        welcomeBonus: number;
        birthdayBonus: number;
      } = { earned: 0, redeemed: 0, welcomeBonus: 0, birthdayBonus: 0 };
      if (customerId) {
        for (const p of loyaltyPayments) {
          if (!p.walletId || !p.pointsRedeemed) continue;
          await applySaleRedemption(tx, sale.id, p.walletId, p.pointsRedeemed);
          rewardsResult.redeemed += p.pointsRedeemed;
        }
        const earnings = await applySaleEarnings(tx, sale.id);
        rewardsResult = {
          ...rewardsResult,
          earned: earnings.earned,
          welcomeBonus: earnings.welcomeBonus,
          birthdayBonus: earnings.birthdayBonus,
        };
      }

      // Create stock movements pointing back at this sale.
      // SYNC_NEGATIVE is reserved for offline syncs that drove stock below
      // zero. Online sales that go negative are still flagged for review,
      // but their reason stays "SALE" so the sync-issues dashboard isn't
      // polluted by normal-flow transactions.
      if (stockMovementsToCreate.length > 0) {
        await tx.stockMovement.createMany({
          data: stockMovementsToCreate.map((m) => ({
            productId: m.productId,
            delta: m.delta,
            reason: m.requiresReview && fromSync ? "SYNC_NEGATIVE" : "SALE",
            saleId: sale.id,
            employeeId,
            requiresReview: m.requiresReview,
          })),
        });
      }

      return { saleId: sale.id, receiptNumber, duplicate: false, rewards: rewardsResult };
    });

    // Fire-and-forget loyalty notification email. We do this AFTER the
    // transaction so SMTP latency doesn't slow down the sale, and any
    // failure just logs to the console without rolling back the sale.
    if (!result.duplicate && result.rewards.earned + result.rewards.welcomeBonus + result.rewards.birthdayBonus > 0 && customerId) {
      void (async () => {
        try {
          const [customer, provider, wallet] = await Promise.all([
            prisma.customer.findUnique({
              where: { id: customerId },
              select: { email: true, firstName: true, lastName: true },
            }),
            prisma.providerProfile.findUnique({
              where: { id: providerId },
              select: { salonName: true },
            }),
            (prisma as never as {
              rewardWallet: { findFirst: (args: unknown) => Promise<{ balance: number } | null> };
            }).rewardWallet.findFirst({
              where: { providerId, customerId },
              select: { balance: true },
            }) as Promise<{ balance: number } | null>,
          ]);
          if (!customer?.email || !provider) return;
          const fullName = `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim();
          await sendLoyaltyEarnedEmail(
            customer.email,
            fullName,
            provider.salonName,
            result.rewards.earned + result.rewards.welcomeBonus + result.rewards.birthdayBonus,
            wallet?.balance ?? 0,
            {
              welcome: result.rewards.welcomeBonus,
              birthday: result.rewards.birthdayBonus,
            },
          );
        } catch (err) {
          console.error("[loyalty-email] failed:", err);
        }
      })();
    }

    return result.duplicate
      ? { kind: "duplicate", saleId: result.saleId, receiptNumber: result.receiptNumber }
      : {
          kind: "ok",
          saleId: result.saleId,
          receiptNumber: result.receiptNumber,
          status: "PAID",
          rewards: result.rewards,
        };
  } catch (err) {
    return {
      kind: "validation",
      error: err instanceof Error ? err.message : "Erreur de transaction",
    };
  }
}
