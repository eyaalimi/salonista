import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { addMoney } from "@/lib/money";
import { Decimal } from "@prisma/client/runtime/client";
import { expectedCash, variance } from "@/lib/drawer-math";

type Body = {
  closingCount?: string | number;
  closingNotes?: string | null;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  const closing = Number(body?.closingCount ?? -1);
  if (!Number.isFinite(closing) || closing < 0) {
    return Response.json({ error: "Comptage invalide" }, { status: 400 });
  }

  // Status + ownership pre-check (cheap, no lock yet).
  const head = await prisma.cashDrawerSession.findUnique({
    where: { id },
    select: { providerId: true, status: true, employeeId: true },
  });
  if (!head || head.providerId !== employee.providerId) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  if (head.status !== "OPEN") {
    return Response.json({ error: "Session déjà fermée" }, { status: 409 });
  }
  if (
    head.employeeId !== employee.id &&
    employee.role !== "OWNER" &&
    employee.role !== "MANAGER"
  ) {
    return Response.json(
      { error: "Seul l'employé qui a ouvert la caisse peut la fermer" },
      { status: 403 },
    );
  }

  const closingStr = closing.toFixed(3);

  // The expected-cash computation and the session update MUST happen in
  // the same transaction. Otherwise a CASH payment landing between the
  // computation and the update would inflate the real drawer without
  // being counted, leaving a phantom variance baked into the closed row.
  try {
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.cashDrawerSession.findUnique({
        where: { id },
        select: { openingFloat: true, openedAt: true, employeeId: true, status: true },
      });
      if (!session) throw new Error("NOT_FOUND");
      if (session.status !== "OPEN") throw new Error("ALREADY_CLOSED");

      const cashPayments = await tx.payment.findMany({
        where: { cashDrawerSessionId: id, method: "CASH" },
        select: { amount: true },
      });
      const cashSalesTotal = cashPayments.reduce(
        (s, p) => addMoney(s, String(p.amount)),
        "0.000",
      );

      const refunds = await tx.refund.findMany({
        where: {
          refundMethod: "CASH",
          employeeId: session.employeeId,
          createdAt: { gte: session.openedAt },
        },
        select: { totalAmount: true },
      });
      const cashRefundsTotal = refunds.reduce(
        (s, r) => addMoney(s, String(r.totalAmount)),
        "0.000",
      );

      const expensesAgg = await (tx as never as {
        cashDrawerExpense: {
          aggregate: (a: unknown) => Promise<{ _sum: { amount: { toString: () => string } | null } }>;
        };
      }).cashDrawerExpense.aggregate({
        where: { cashDrawerSessionId: id },
        _sum: { amount: true },
      });
      const expensesTotal = expensesAgg._sum.amount ? String(expensesAgg._sum.amount) : "0.000";

      const expected = expectedCash({
        openingFloat: new Decimal(String(session.openingFloat)),
        cashSales: new Decimal(cashSalesTotal),
        cashRefunds: new Decimal(cashRefundsTotal),
        expenses: new Decimal(expensesTotal),
      });
      const varianceVal = variance(expected, new Decimal(closingStr));

      const updated = await tx.cashDrawerSession.update({
        where: { id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closingCount: closingStr,
          expectedCash: expected.toFixed(3),
          variance: varianceVal.toFixed(3),
          closingNotes: body?.closingNotes ?? null,
        },
      });

      return {
        session: updated,
        summary: {
          openingFloat: String(session.openingFloat),
          cashSalesCount: cashPayments.length,
          cashSalesTotal,
          cashRefundsCount: refunds.length,
          cashRefundsTotal,
          expensesTotal,
          expectedCash: expected.toFixed(3),
          closingCount: closingStr,
          variance: varianceVal.toFixed(3),
        },
      };
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (msg === "NOT_FOUND") return Response.json({ error: "Session introuvable" }, { status: 404 });
    if (msg === "ALREADY_CLOSED")
      return Response.json({ error: "Session déjà fermée" }, { status: 409 });
    return Response.json({ error: msg }, { status: 500 });
  }
}
