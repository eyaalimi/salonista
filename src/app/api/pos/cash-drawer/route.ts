import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const params = req.nextUrl.searchParams;
  const fromStr = params.get("from");
  const toStr = params.get("to");
  const employeeId = params.get("employeeId");

  const where: Record<string, unknown> = { providerId: employee.providerId };
  if (fromStr || toStr) {
    where.openedAt = {
      ...(fromStr ? { gte: new Date(fromStr) } : {}),
      ...(toStr ? { lte: new Date(toStr) } : {}),
    };
  }
  if (employeeId) where.employeeId = employeeId;

  const sessions = await prisma.cashDrawerSession.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: 200,
    include: {
      employee: { select: { id: true, displayName: true, role: true } },
    },
  });
  return Response.json(sessions);
}
