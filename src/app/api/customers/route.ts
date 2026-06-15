import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";
import { requirePermission, toResponse } from "@/lib/employee-session";

type CreateBody = {
  phone?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  birthday?: string;
};

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("customers.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.phone) {
    return Response.json({ error: "Numéro de téléphone requis" }, { status: 400 });
  }
  const phone = tryNormalizePhone(body.phone);
  if (!phone) {
    return Response.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }

  const providerId = employee.providerId;
  const existing = await prisma.customer.findUnique({ where: { phone } });

  if (existing) {
    // A phone number identifies one person across all salons. Whether they
    // first registered here or elsewhere, the salon can still encaisser them.
    // Return the existing record so the caller can attach it to a sale.
    return Response.json(existing, { status: 200 });
  }

  let birthday: Date | undefined;
  if (body.birthday) {
    const parsed = new Date(body.birthday);
    if (Number.isNaN(parsed.getTime())) {
      return Response.json({ error: "Date de naissance invalide" }, { status: 400 });
    }
    birthday = parsed;
  }

  const created = await prisma.customer.create({
    data: {
      phone,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      email: body.email ?? null,
      birthday: birthday ?? null,
      firstSalonId: providerId,
    },
  });

  return Response.json(created, { status: 201 });
}
