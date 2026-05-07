import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  if (employee.role !== "OWNER" && employee.role !== "MANAGER") {
    return Response.json(
      { error: "Réservé aux propriétaires/managers" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const session = await prisma.cashDrawerSession.findUnique({ where: { id } });
  if (!session || session.providerId !== employee.providerId) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  if (session.status !== "CLOSED") {
    return Response.json(
      { error: "La session doit être fermée avant rapprochement" },
      { status: 409 },
    );
  }
  const updated = await prisma.cashDrawerSession.update({
    where: { id },
    data: { status: "RECONCILED", reconciledAt: new Date() },
  });
  return Response.json(updated);
}
