import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

const VALID_CATEGORIES = [
  "FOURNISSEUR",
  "LIVRAISON",
  "AVANCE_SALAIRE",
  "ENTRETIEN",
  "AUTRE",
] as const;

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as
    | { amount?: number | string; reason?: string; category?: string }
    | null;
  const amount = Number(body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return Response.json({ error: "Montant invalide (1 à 10 000 DT)" }, { status: 400 });
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return Response.json({ error: "Motif requis" }, { status: 400 });
  const category = VALID_CATEGORIES.includes(body?.category as never)
    ? body!.category!
    : "AUTRE";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const session = await tx.cashDrawerSession.findFirst({
        where: { providerId: employee.providerId, status: "OPEN" },
        select: { id: true },
      });
      if (!session) throw new Error("NO_OPEN_SESSION");
      return (tx as never as {
        cashDrawerExpense: { create: (a: unknown) => Promise<unknown> };
      }).cashDrawerExpense.create({
        data: {
          cashDrawerSessionId: session.id,
          employeeId: employee.id,
          amount: amount.toFixed(3),
          reason,
          category,
        },
      });
    });
    return Response.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_OPEN_SESSION") {
      return Response.json({ error: "Aucune caisse ouverte" }, { status: 409 });
    }
    throw err;
  }
}

export async function GET() {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const session = await prisma.cashDrawerSession.findFirst({
    where: { providerId: employee.providerId, status: "OPEN" },
    select: { id: true },
  });
  if (!session) return Response.json({ sessionId: null, expenses: [], total: "0.000" });

  const expenses = await (prisma as never as {
    cashDrawerExpense: {
      findMany: (a: unknown) => Promise<
        Array<{
          id: string;
          amount: string | number;
          reason: string;
          category: string;
          createdAt: Date;
          employee: { displayName: string };
        }>
      >;
    };
  }).cashDrawerExpense.findMany({
    where: { cashDrawerSessionId: session.id },
    orderBy: { createdAt: "asc" },
    include: { employee: { select: { displayName: true } } },
  });
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(3);
  return Response.json({ sessionId: session.id, expenses, total });
}
