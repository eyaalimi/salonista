import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { computeSummary } from "@/lib/cash-drawer";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const session = await prisma.cashDrawerSession.findUnique({
    where: { id },
    select: { providerId: true },
  });
  if (!session || session.providerId !== employee.providerId) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  const summary = await computeSummary(id);
  return Response.json(summary);
}
