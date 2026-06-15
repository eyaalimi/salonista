/**
 * Unified onboarding PATCH endpoint.
 *
 * Each wizard step calls this with the delta it controls. The endpoint is
 * idempotent — the user can navigate back and forward without creating
 * duplicates. The full body is optional; only the fields present are written.
 *
 * Persistence model:
 * - step1 fields → ProviderProfile columns directly.
 * - step2 services → Offer rows (created or updated by title within provider).
 * - step3 products → Product rows (created or updated by name within provider).
 * - step4 loyalty → RewardProgram (upsert).
 * - step5 team → SalonEmployee rows.
 */

import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { mergePermissions } from "@/lib/permissions";

type Step1 = {
  salonName?: string;
  phone?: string;
  address?: string;
  city?: string;
  category?: string;
  matriculeFiscal?: string;
  logoUrl?: string;
};

type Step2Service = {
  title: string;
  durationMinutes: number;
  price: string;
  taxRate?: string;
  photoUrl?: string | null;
};

type Step3Product = {
  name: string;
  category?: string;
  salePrice: string;
  stockQuantity: number;
  photoUrl?: string | null;
};

type Step4Loyalty = {
  enabled?: boolean;
  pointsPerDinar?: number; // e.g. 1 point per X DT (we store inverse)
  dinarPerPoint?: string; // 1 point = Y DT redeemable
  minPointsToRedeem?: number;
};

type Step5Employee = {
  displayName: string;
  pin: string; // 4 digits
  role?: "MANAGER" | "CASHIER" | "STYLIST";
};

type Body = {
  step1?: Step1;
  step2?: { services: Step2Service[] };
  step3?: { products: Step3Product[]; skipped?: boolean };
  step4?: Step4Loyalty;
  step5?: { employees: Step5Employee[] };
  finish?: boolean;
};

export async function PATCH(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (employee.role !== "OWNER") {
    return Response.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: "Corps vide" }, { status: 400 });

  const providerId = employee.providerId;

  // --- Step 1: salon info ---------------------------------------------------
  if (body.step1) {
    const data: Record<string, unknown> = {};
    const s = body.step1;
    if (typeof s.salonName === "string" && s.salonName.trim()) data.salonName = s.salonName.trim();
    if (typeof s.phone === "string") data.phone = s.phone.trim() || null;
    if (typeof s.address === "string") data.address = s.address.trim() || null;
    if (typeof s.city === "string") data.city = s.city.trim() || null;
    if (typeof s.category === "string") data.category = s.category;
    if (typeof s.matriculeFiscal === "string") {
      data.matriculeFiscal = s.matriculeFiscal.trim() || null;
    }
    if (typeof s.logoUrl === "string" && s.logoUrl.trim()) {
      // photos[0] is conventionally the salon logo. Replace existing logo.
      data.photos = [s.logoUrl.trim()];
    }
    if (Object.keys(data).length > 0) {
      await (prisma as never as {
        providerProfile: { update: (a: unknown) => Promise<unknown> };
      }).providerProfile.update({
        where: { id: providerId },
        data,
      });
    }
  }

  // --- Step 2: services (Offer rows) ---------------------------------------
  if (body.step2?.services) {
    for (const svc of body.step2.services) {
      const price = svc.price;
      const dur = svc.durationMinutes;
      if (!svc.title || !dur || !price) continue;

      // Upsert by (providerId, title) — there is no unique constraint, so
      // emulate it with findFirst + create/update.
      const existing = await prisma.offer.findFirst({
        where: { providerId, title: svc.title },
        select: { id: true },
      });
      const data = {
        title: svc.title,
        durationMinutes: dur,
        discountPrice: price,
        originalPrice: price,
        taxRate: svc.taxRate ?? "19.00",
        providerId,
        category: "AUTRE" as const,
        description: "",
        publishedToMarketplace: false,
        photos: svc.photoUrl ? [svc.photoUrl] : [],
      };
      if (existing) {
        await (prisma as never as {
          offer: { update: (a: unknown) => Promise<unknown> };
        }).offer.update({ where: { id: existing.id }, data });
      } else {
        await (prisma as never as {
          offer: { create: (a: unknown) => Promise<unknown> };
        }).offer.create({ data });
      }
    }
  }

  // --- Step 3: products -----------------------------------------------------
  if (body.step3?.products) {
    for (const p of body.step3.products) {
      if (!p.name || !p.salePrice) continue;
      const existing = await prisma.product.findFirst({
        where: { providerId, name: p.name },
        select: { id: true },
      });
      const sku = `SKU-${p.name.slice(0, 6).toUpperCase().replace(/\s/g, "")}-${Date.now().toString(36).slice(-4)}`;
      const data: Record<string, unknown> = {
        providerId,
        name: p.name,
        category: p.category ?? null,
        sku: existing ? undefined : sku,
        salePrice: p.salePrice,
        purchasePrice: p.salePrice,
        taxRate: "19.00",
        stockQuantity: p.stockQuantity ?? 0,
      };
      if (p.photoUrl) data.photo = p.photoUrl;
      if (existing) {
        await (prisma as never as {
          product: { update: (a: unknown) => Promise<unknown> };
        }).product.update({ where: { id: existing.id }, data });
      } else {
        await (prisma as never as {
          product: { create: (a: unknown) => Promise<unknown> };
        }).product.create({ data });
      }
    }
  }

  // --- Step 4: loyalty / reward program ------------------------------------
  if (body.step4) {
    const program = body.step4;
    const existing = await (prisma as never as {
      rewardProgram: {
        findUnique: (a: unknown) => Promise<{ id: string } | null>;
      };
    }).rewardProgram.findUnique({
      where: { providerId },
    });
    const data = {
      providerId,
      active: program.enabled ?? true,
      pointsPerDinar: program.pointsPerDinar
        ? (1 / program.pointsPerDinar).toFixed(3) // store as points per DT
        : "1.000",
      dinarPerPoint: program.dinarPerPoint ?? "0.100",
      minPointsToRedeem: program.minPointsToRedeem ?? 100,
    };
    if (existing) {
      await (prisma as never as {
        rewardProgram: { update: (a: unknown) => Promise<unknown> };
      }).rewardProgram.update({ where: { providerId }, data });
    } else {
      await (prisma as never as {
        rewardProgram: { create: (a: unknown) => Promise<unknown> };
      }).rewardProgram.create({ data });
    }
  }

  // --- Step 5: team ---------------------------------------------------------
  if (body.step5?.employees) {
    for (const emp of body.step5.employees) {
      if (!emp.displayName || !/^\d{4}$/.test(emp.pin)) continue;
      const pinHash = await hash(emp.pin, 10);
      const role = emp.role ?? "CASHIER";
      const existing = await prisma.salonEmployee.findFirst({
        where: { providerId, displayName: emp.displayName },
        select: { id: true },
      });
      const data = {
        providerId,
        displayName: emp.displayName,
        pinHash,
        role,
        permissions: mergePermissions(role, undefined) as never,
      };
      if (existing) {
        await prisma.salonEmployee.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.salonEmployee.create({ data });
      }
    }
  }

  // --- Finish: mark onboarding done ----------------------------------------
  if (body.finish) {
    await (prisma as never as {
      providerProfile: { update: (a: unknown) => Promise<unknown> };
    }).providerProfile.update({
      where: { id: providerId },
      data: { onboardingDismissedAt: new Date() },
    });
  }

  return Response.json({ ok: true });
}
