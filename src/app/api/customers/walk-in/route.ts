import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type Body = { firstName?: string };

// Walk-in (passager) customer: created with no phone/email. We satisfy the
// schema's @unique phone constraint with a synthetic placeholder that cannot
// collide with a real Tunisian number ("walk-in-<cuid>").
export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.sell");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const firstName = body?.firstName?.trim() || "Client passager";

  const placeholder = `walk-in-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

  const created = await prisma.customer.create({
    data: {
      phone: placeholder,
      firstName,
      lastName: null,
      email: null,
      firstSalonId: employee.providerId,
    },
  });

  return Response.json(created, { status: 201 });
}
