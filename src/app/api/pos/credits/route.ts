import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import {
  correspondRecherche,
  filtrerCredits,
  grouperCreditsParCliente,
  totauxCredits,
  type FiltreCredits,
} from "@/lib/credit";

/**
 * GET /api/pos/credits?filtre=retard|semaine&q=…
 *
 * Les ventes a credit du salon, une ligne par cliente.
 *
 * Lecture : `customers.view` (une permission de LECTURE, donc ouverte a la vue
 * « voir comme le salon » du superadmin), PLUS `pos.sell` ou `pos.credit`
 * verifies a la main. Demander directement `pos.sell` a `requirePermission`
 * bloquerait cette vue, qui refuse toute permission d'ecriture.
 */
export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (!employee.permissions["pos.sell"] && !employee.permissions["pos.credit"]) {
    return Response.json({ error: "Permission insuffisante" }, { status: 403 });
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const filtreBrut = req.nextUrl.searchParams.get("filtre");
  const filtre: FiltreCredits =
    filtreBrut === "retard" || filtreBrut === "semaine" ? filtreBrut : "toutes";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const ventes = await prisma.sale.findMany({
    where: {
      providerId: employee.providerId,
      status: "CREDIT",
      amountDue: { gt: 0 },
      customerId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      customerId: true,
      receiptNumber: true,
      createdAt: true,
      total: true,
      amountDue: true,
      dueDate: true,
      items: { select: { nameSnapshot: true, quantity: true } },
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });

  const maintenant = new Date();
  const clientesParId = new Map(
    ventes.filter((v) => v.customer).map((v) => [v.customer!.id, v.customer!]),
  );
  const groupes = grouperCreditsParCliente(
    ventes.map((v) => ({
      id: v.id,
      customerId: v.customerId as string,
      receiptNumber: v.receiptNumber,
      createdAt: v.createdAt,
      total: v.total,
      amountDue: v.amountDue,
      dueDate: v.dueDate,
      resume: v.items
        .map((i) => (i.quantity > 1 ? `${i.nameSnapshot} ×${i.quantity}` : i.nameSnapshot))
        .join(", "),
    })),
    maintenant,
  );

  // Les tuiles de tete portent sur TOUT le salon, avant filtre et recherche.
  const totaux = totauxCredits(groupes);

  const visibles = filtrerCredits(groupes, filtre, maintenant).filter((g) => {
    const c = clientesParId.get(g.customerId);
    return c ? correspondRecherche(c, q) : false;
  });

  return Response.json({
    totaux,
    clientes: visibles.map((g) => ({
      customer: clientesParId.get(g.customerId),
      totalDu: g.totalDu,
      plusAncienne: g.plusAncienne.toISOString(),
      dueDateLaPlusProche: g.dueDateLaPlusProche?.toISOString() ?? null,
      enRetard: g.enRetard,
      ventes: g.ventes.map((v) => ({
        id: v.id,
        receiptNumber: v.receiptNumber,
        createdAt: v.createdAt.toISOString(),
        total: v.total,
        amountDue: v.amountDue,
        dueDate: v.dueDate?.toISOString() ?? null,
        enRetard: v.enRetard,
        resume: v.resume,
      })),
    })),
  });
}
