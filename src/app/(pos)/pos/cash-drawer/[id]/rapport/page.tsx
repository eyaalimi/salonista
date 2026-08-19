import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/client";
import { ZReportPrintFrame } from "@/components/pos/thermal/z-report-content";
import { ModuleGate } from "@/components/module-gate";

export const dynamic = "force-dynamic";

export default async function ZReportPage({ params }: { params: Promise<{ id: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["pos.cash_drawer"]) redirect("/pos/calendar");

  const { id } = await params;

  const session = await prisma.cashDrawerSession.findUnique({
    where: { id },
    include: { employee: { select: { displayName: true } } },
  });
  if (!session || session.providerId !== employee.providerId) notFound();

  const provider = await prisma.providerProfile.findUnique({
    where: { id: session.providerId },
    select: {
      salonName: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
      receiptFooter: true,
    },
  });

  const closedAt = session.closedAt ?? new Date();
  const windowFilter = { gte: session.openedAt, lte: closedAt };

  const [salesAgg, refundsAllAgg, refundsCashAgg, paymentsByMethod, taxGroups, expenses] = await Promise.all([
    prisma.sale.aggregate({
      where: { providerId: session.providerId, status: "PAID", closedAt: windowFilter },
      _count: true,
      _sum: { total: true, discountAmount: true, tipTotal: true },
    }),
    prisma.refund.aggregate({
      where: { sale: { providerId: session.providerId }, createdAt: windowFilter },
      _sum: { totalAmount: true },
    }),
    prisma.refund.aggregate({
      where: { sale: { providerId: session.providerId }, createdAt: windowFilter, refundMethod: "CASH" },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { cashDrawerSessionId: id },
      _sum: { amount: true },
    }),
    prisma.saleItem.groupBy({
      by: ["taxRateSnapshot"],
      where: { sale: { providerId: session.providerId, status: "PAID", closedAt: windowFilter } },
      _sum: { lineSubtotal: true, lineTaxAmount: true },
    }),
    (prisma as never as {
      cashDrawerExpense: {
        findMany: (a: unknown) => Promise<Array<{ id: string; amount: string | number; reason: string; category: string }>>;
      };
    }).cashDrawerExpense.findMany({
      where: { cashDrawerSessionId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const data = {
    provider,
    sessionNumber: session.id.slice(-4).toUpperCase(),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openedBy: session.employee.displayName,
    salesCount: salesAgg._count,
    grossTotal: String(salesAgg._sum.total ?? "0.000"),
    discountsTotal: String(salesAgg._sum.discountAmount ?? "0.000"),
    tipsTotal: String(salesAgg._sum.tipTotal ?? "0.000"),
    refundsTotal: String(refundsAllAgg._sum.totalAmount ?? "0.000"),
    refundsCashTotal: String(refundsCashAgg._sum.totalAmount ?? "0.000"),
    paymentsByMethod: paymentsByMethod.map((p) => ({
      method: p.method,
      amount: String(p._sum.amount ?? "0.000"),
    })),
    taxBreakdown: taxGroups.map((t) => ({
      rate: String(t.taxRateSnapshot),
      base: String(t._sum.lineSubtotal ?? "0.000"),
      tax: String(t._sum.lineTaxAmount ?? "0.000"),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      amount: String(e.amount),
      reason: e.reason,
      category: e.category,
    })),
    expensesTotal: expenses
      .reduce((s, e) => s.add(new Decimal(String(e.amount))), new Decimal(0))
      .toFixed(3),
    openingFloat: String(session.openingFloat),
    expectedCash: session.expectedCash ? String(session.expectedCash) : null,
    closingCount: session.closingCount ? String(session.closingCount) : null,
    variance: session.variance ? String(session.variance) : null,
  };

  return (
    <ModuleGate module="POS" providerId={employee.providerId}>
      <ZReportPrintFrame data={data} />
    </ModuleGate>
  );
}
