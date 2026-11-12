import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type UpdateBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthday?: string | null;
  notes?: string;
  promosAcceptees?: boolean;
};

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("customers.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    return Response.json({ error: "Client introuvable" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) {
    return Response.json({ error: "Corps de requête requis" }, { status: 400 });
  }

  const isOwn = customer.firstSalonId === employee.providerId;
  if (!isOwn) {
    // External salons may still update name fields IF they have a relationship
    // (a booking with this customer at one of their offers). Otherwise the
    // requester has no business editing the row at all.
    const hasBookingHere = await prisma.booking.findFirst({
      where: {
        customerId: customer.id,
        items: { some: { offer: { providerId: employee.providerId } } },
      },
      select: { id: true },
    });
    if (!hasBookingHere) {
      return Response.json({ error: "Client introuvable" }, { status: 404 });
    }
  }

  if (!isOwn) {
    const restricted =
      "email" in body || "birthday" in body || "notes" in body || "promosAcceptees" in body;
    if (restricted) {
      return Response.json(
        {
          error:
            "Modification limitée — ce client a été enregistré par un autre salon",
        },
        { status: 403 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (body.firstName !== undefined) data.firstName = body.firstName;
  if (body.lastName !== undefined) data.lastName = body.lastName;
  if (isOwn) {
    if (body.email !== undefined) data.email = body.email;
    if (body.notes !== undefined) data.notes = body.notes;
    // Le refus est date : il dit QUAND la cliente a demande a ne plus
    // recevoir. Recocher la case efface la date.
    if (typeof body.promosAcceptees === "boolean" && body.promosAcceptees !== customer.promosAcceptees) {
      data.promosAcceptees = body.promosAcceptees;
      data.promosRefuseesAt = body.promosAcceptees ? null : new Date();
    }
    if (body.birthday !== undefined) {
      if (body.birthday === null || body.birthday === "") {
        data.birthday = null;
      } else {
        const parsed = new Date(body.birthday);
        if (Number.isNaN(parsed.getTime())) {
          return Response.json({ error: "Date de naissance invalide" }, { status: 400 });
        }
        data.birthday = parsed;
      }
    }
  }

  const updated = await prisma.customer.update({ where: { id }, data });
  return Response.json(updated);
}
