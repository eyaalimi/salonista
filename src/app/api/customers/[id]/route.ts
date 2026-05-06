import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type UpdateBody = {
  firstName?: string;
  lastName?: string;
  email?: string;
  birthday?: string | null;
  notes?: string;
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
    const restricted =
      "email" in body || "birthday" in body || "notes" in body;
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
