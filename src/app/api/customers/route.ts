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

  /*
   * La recherche est BORNEE AU SALON. Auparavant elle portait sur le seul
   * telephone, globalement unique : un salon qui saisissait le numero d'une
   * cliente venue d'ailleurs recevait la fiche de l'autre salon, deja remplie
   * a un autre nom. Une cliente frequente plusieurs salons — chacun tient sa
   * propre fiche.
   */
  const existing = await prisma.customer.findFirst({
    where: { phone, firstSalonId: providerId },
  });

  if (existing) {
    // Deja connue ICI : on rend sa fiche plutot que d'en creer une seconde.
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
