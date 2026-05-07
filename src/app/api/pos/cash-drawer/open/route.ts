import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { findOpenSession } from "@/lib/cash-drawer";

type Body = { openingFloat?: string | number; openingNotes?: string | null };

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const openingFloat = Number(body?.openingFloat ?? 0);
  if (!Number.isFinite(openingFloat) || openingFloat < 0) {
    return Response.json({ error: "Fond de caisse invalide" }, { status: 400 });
  }

  const existing = await findOpenSession(employee.id);
  if (existing) {
    return Response.json(
      { error: "Une session est déjà ouverte", session: existing },
      { status: 409 },
    );
  }

  const session = await prisma.cashDrawerSession.create({
    data: {
      providerId: employee.providerId,
      employeeId: employee.id,
      openingFloat,
      openingNotes: body?.openingNotes ?? null,
    },
  });
  return Response.json(session, { status: 201 });
}
