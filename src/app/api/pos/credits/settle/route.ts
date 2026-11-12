import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { findOpenSession } from "@/lib/cash-drawer";
import { refusVenteSansTiroir } from "@/lib/caisse-ouverte";
import { repartirVersement } from "@/lib/credit";
import { fromMillimes, toMillimes } from "@/lib/money";
import { hasFeature } from "@/lib/plan-serveur";
import { applySaleEarnings } from "@/lib/rewards/earn";

type Body = {
  customerId?: string;
  amount?: string;
  method?: string;
  reference?: string | null;
  saleIds?: string[];
};

const METHODES = ["CASH", "CARD", "TRANSFER"] as const;
type Methode = (typeof METHODES)[number];

/** Une autre caisse a touche ce credit pendant qu'on le reglait. */
class CreditModifie extends Error {}

/**
 * POST /api/pos/credits/settle — encaisser tout ou partie d'un credit.
 *
 * `pos.sell` : regler un credit, c'est encaisser.
 *
 * LE VERSEMENT EST DATE DU JOUR OU L'ARGENT EST RECU, et rattache au tiroir
 * ouvert MAINTENANT. C'est ce qui le fait compter dans la caisse d'aujourd'hui
 * et non dans celle du jour de la vente : l'attendu en caisse se calcule sur
 * les `Payment` de la session (voir cash-drawer.ts).
 *
 * CONCURRENCE. Deux tablettes peuvent ouvrir la meme cliente. Chaque vente est
 * mise a jour a CONDITION que son reste du n'ait pas change depuis la lecture
 * (`updateMany where amountDue = lu`). Sous PostgreSQL, la seconde mise a jour
 * attend le verrou de ligne de la premiere, relit la condition et ne touche
 * plus aucune ligne : on annule alors toute la transaction. Sans cela, deux
 * versements de 65 DT solderaient deux fois le meme credit de 65 DT.
 */
export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.sell");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.customerId || typeof body.amount !== "string") {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }
  if (!METHODES.includes(body.method as Methode)) {
    return Response.json({ error: "Mode de paiement invalide" }, { status: 400 });
  }
  const methode = body.method as Methode;
  let montantM: number;
  try {
    montantM = toMillimes(body.amount);
  } catch {
    return Response.json({ error: "Montant invalide" }, { status: 400 });
  }
  const providerId = employee.providerId;

  // Especes sans tiroir ouvert : meme refus qu'une vente en especes, pour la
  // meme raison — cet argent n'apparaitrait dans aucun rapport de fin de
  // journee.
  const tiroir = methode === "CASH" ? await findOpenSession(providerId) : null;
  const refus = refusVenteSansTiroir([methode], tiroir !== null, false);
  if (refus) return Response.json({ error: refus.message }, { status: refus.status });

  const fideliteActive = await hasFeature(providerId, "FIDELITE");
  const maintenant = new Date();

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      const credits = await tx.sale.findMany({
        where: {
          providerId,
          customerId: body.customerId,
          status: "CREDIT",
          amountDue: { gt: 0 },
          ...(Array.isArray(body.saleIds) && body.saleIds.length > 0
            ? { id: { in: body.saleIds } }
            : {}),
        },
        select: { id: true, receiptNumber: true, createdAt: true, amountDue: true },
      });
      if (Array.isArray(body.saleIds) && body.saleIds.length > 0 && credits.length !== body.saleIds.length) {
        throw new CreditModifie();
      }

      const repartition = repartirVersement({
        montant: fromMillimes(montantM),
        credits: credits.map((c) => ({ saleId: c.id, createdAt: c.createdAt, amountDue: c.amountDue })),
      });
      if (!repartition.ok) return { refus: repartition.erreur } as const;

      const parId = new Map(credits.map((c) => [c.id, c]));
      let gagnes = 0;
      for (const imp of repartition.imputations) {
        const vente = parId.get(imp.saleId)!;
        const maj = await tx.sale.updateMany({
          where: { id: imp.saleId, status: "CREDIT", amountDue: vente.amountDue },
          data: {
            amountDue: imp.resteApres,
            ...(imp.soldee ? { status: "PAID" as const, creditSettledAt: maintenant } : {}),
          },
        });
        if (maj.count !== 1) throw new CreditModifie();

        await tx.payment.create({
          data: {
            saleId: imp.saleId,
            method: methode,
            amount: imp.montantImpute,
            reference: body.reference?.trim() || null,
            cashDrawerSessionId: methode === "CASH" ? tiroir?.id ?? null : null,
            isCreditSettlement: true,
            receivedByEmployeeId: employee.id,
            createdAt: maintenant,
          },
        });

        // Les points arrivent au reglement COMPLET, avec le calcul d'une vente
        // normale. `applySaleEarnings` est idempotent par vente.
        if (imp.soldee && fideliteActive) {
          const e = await applySaleEarnings(tx, imp.saleId);
          gagnes += e.earned + e.welcomeBonus + e.birthdayBonus;
        }
      }

      const resteTotal = await tx.sale.aggregate({
        where: { providerId, customerId: body.customerId, status: "CREDIT", amountDue: { gt: 0 } },
        _sum: { amountDue: true },
      });

      return {
        reglement: {
          date: maintenant.toISOString(),
          montant: fromMillimes(montantM),
          methode,
          ventes: repartition.imputations.map((imp) => ({
            saleId: imp.saleId,
            receiptNumber: parId.get(imp.saleId)!.receiptNumber,
            montantImpute: imp.montantImpute,
            resteApres: imp.resteApres,
            soldee: imp.soldee,
          })),
          resteDuApres: fromMillimes(toMillimes(resteTotal._sum.amountDue ?? 0)),
          pointsGagnes: gagnes,
        },
      } as const;
    });

    if ("refus" in resultat) {
      return Response.json({ error: resultat.refus }, { status: 422 });
    }
    return Response.json(resultat, { status: 201 });
  } catch (err) {
    if (err instanceof CreditModifie) {
      return Response.json(
        { error: "Ce crédit vient d'être modifié sur une autre caisse. Rechargez la liste et recommencez." },
        { status: 409 },
      );
    }
    throw err;
  }
}
