import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { parseRange, previousRange } from "@/lib/analytics-range";
import { consoliderRevenu, ticketMoyen } from "@/lib/revenu-salon";
import { STATUTS_VENTE_REALISEE } from "@/lib/statut-vente";
import { roundMillime } from "@/lib/money";


async function summarize(providerId: string, from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      providerId,
      status: { in: [...STATUTS_VENTE_REALISEE] },
      closedAt: { gte: from, lte: to },
    },
    select: { id: true, total: true },
  });

  // Les rendez-vous termines comptent aussi : sans le module caisse, aucune
  // vente ne peut exister (POST /api/pos/sales repond 403) et le salon voyait
  // « 0 TND » alors qu'il travaillait. `consoliderRevenu` ecarte ceux qui
  // portent deja une vente, pour ne pas compter deux fois la meme prestation.
  // `qrVerifiedAt` et non `createdAt` : ce qui compte est le jour de la
  // VISITE, pas celui de la reservation. Une cliente qui reserve lundi pour
  // vendredi doit compter dans la recette de vendredi.
  const rdvTermines = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      items: { some: { offer: { providerId } } },
      qrVerifiedAt: { gte: from, lte: to },
    },
    select: { totalPrice: true, sale: { select: { id: true } } },
  });

  const refunds = await prisma.refund.findMany({
    where: {
      sale: { providerId },
      createdAt: { gte: from, lte: to },
    },
    select: { totalAmount: true },
  });

  const revenu = consoliderRevenu(
    sales.map((s) => ({ total: String(s.total) })),
    rdvTermines.map((b) => ({
      totalPrice: String(b.totalPrice),
      aUneVente: b.sale !== null,
    })),
    refunds.map((r) => ({ totalAmount: String(r.totalAmount) })),
  );

  const newCustomers = await prisma.customer.count({
    where: { firstSalonId: providerId, createdAt: { gte: from, lte: to } },
  });

  return { ...revenu, newCustomers };
}

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("analytics.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { from, to } = parseRange(req.nextUrl.searchParams);
  const { prevFrom, prevTo } = previousRange(from, to);

  const [current, previous] = await Promise.all([
    summarize(employee.providerId, from, to),
    summarize(employee.providerId, prevFrom, prevTo),
  ]);

  // averageTicket = netRevenue / paidCount (current period only, no delta dependency).
  const avgTicket = ticketMoyen(current);

  // Credits : deux chiffres qui ne se lisent PAS pareil.
  //  - « en cours » est un STOCK : ce que les clientes doivent a cet instant,
  //    quelle que soit la periode affichee ;
  //  - « dettes effacees » est un FLUX : ce que le salon a abandonne pendant
  //    la periode. `detteEffaceeMontant` et non `amountDue`, qui vaut 0 apres
  //    effacement.
  // Le chiffre d'affaires, lui, compte deja les ventes a credit en entier.
  const [enCours, effacees] = await Promise.all([
    prisma.sale.aggregate({
      where: { providerId: employee.providerId, status: "CREDIT", amountDue: { gt: 0 } },
      _sum: { amountDue: true },
    }),
    prisma.sale.aggregate({
      where: { providerId: employee.providerId, detteEffaceeAt: { gte: from, lte: to } },
      _sum: { detteEffaceeMontant: true },
    }),
  ]);

  return Response.json({
    range: { from, to },
    current: { ...current, avgTicket },
    previous,
    credits: {
      enCours: roundMillime(enCours._sum.amountDue ?? 0),
      dettesEffacees: roundMillime(effacees._sum.detteEffaceeMontant ?? 0),
    },
  });
}
