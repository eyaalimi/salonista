import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const session = await prisma.cashDrawerSession.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, displayName: true, role: true } },
      payments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          method: true,
          amount: true,
          reference: true,
          createdAt: true,
          sale: { select: { id: true, receiptNumber: true } },
        },
      },
    },
  });
  if (!session || session.providerId !== employee.providerId) {
    return Response.json({ error: "Session introuvable" }, { status: 404 });
  }
  return Response.json(session);
}
