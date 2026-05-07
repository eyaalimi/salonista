import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { computeSummary } from "@/lib/cash-drawer";
import { subMoney } from "@/lib/money";

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

  const session = await prisma.cashDrawerSession.findUnique({ where: { id } });
  if (!session || session.providerId !== employee.providerId) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  if (session.status !== "OPEN") {
    return Response.json({ error: "Session déjà fermée" }, { status: 409 });
  }
  // Only the opener (or OWNER/MANAGER) may close.
  if (
    session.employeeId !== employee.id &&
    employee.role !== "OWNER" &&
    employee.role !== "MANAGER"
  ) {
    return Response.json(
      { error: "Seul l'employé qui a ouvert la caisse peut la fermer" },
      { status: 403 },
    );
  }

  const summary = await computeSummary(id);
  if (!summary) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  const closingStr = closing.toFixed(3);
  const variance = subMoney(closingStr, summary.expectedCash);

  const updated = await prisma.cashDrawerSession.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closingCount: closingStr,
      expectedCash: summary.expectedCash,
      variance,
      closingNotes: body?.closingNotes ?? null,
    },
  });

  return Response.json({ session: updated, summary: { ...summary, closingCount: closingStr, variance } });
}
