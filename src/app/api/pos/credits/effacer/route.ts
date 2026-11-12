import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { lireMotifEffacement } from "@/lib/credit";
import { fromMillimes, toMillimes } from "@/lib/money";

type Body = { customerId?: string; motif?: string; saleIds?: string[] };

class CreditModifie extends Error {}

/**
 * POST /api/pos/credits/effacer — abandonner la dette d'une cliente.
 *
 * `pos.void` (proprietaire et gerante) : c'est renoncer a de l'argent.
 *
 * La vente RESTE CREDIT, son reste du passe a 0 : la prestation a bien ete
 * vendue (le chiffre d'affaires la compte), seul l'argent manque. Elle sort
 * de la page Credits puisque celle-ci ne liste que `amountDue > 0`.
 *
 * Aucun point fidelite n'est accorde : les points ne naissent qu'au passage a
 * PAID, et une dette effacee n'y passe jamais.
 *
 * Le salon n'a pas de journal d'actions : les trois champs `detteEffacee*`
 * (quand, pourquoi, par qui) et le montant fige sont la trace. Meme garde de
 * concurrence que le reglement : une vente reglee entre-temps sur une autre
 * caisse n'est pas effacee.
 */
export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.void");
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
  if (!body?.customerId) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }
  const motif = lireMotifEffacement(body.motif);
  if (!motif.ok) return Response.json({ error: motif.erreur }, { status: 422 });

  const providerId = employee.providerId;
  const maintenant = new Date();

  try {
    const efface = await prisma.$transaction(async (tx) => {
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
        select: { id: true, amountDue: true },
      });
      if (credits.length === 0) return null;

      let totalM = 0;
      for (const c of credits) {
        const maj = await tx.sale.updateMany({
          where: { id: c.id, status: "CREDIT", amountDue: c.amountDue },
          data: {
            amountDue: "0",
            detteEffaceeAt: maintenant,
            detteEffaceeMotif: motif.motif,
            detteEffaceeMontant: c.amountDue,
            detteEffaceeParId: employee.id,
          },
        });
        if (maj.count !== 1) throw new CreditModifie();
        totalM += toMillimes(c.amountDue);
      }
      return { ventes: credits.length, montant: fromMillimes(totalM) };
    });

    if (!efface) {
      return Response.json({ error: "Cette cliente n'a aucun crédit en cours." }, { status: 404 });
    }
    return Response.json(efface);
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
