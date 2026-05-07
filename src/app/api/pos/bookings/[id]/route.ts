import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireEmployee, toResponse } from "@/lib/employee-session";

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
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      items: { include: { offer: true, slot: true } },
      customer: true,
      assignedEmployee: { select: { id: true, displayName: true } },
      sale: { select: { id: true, receiptNumber: true, status: true } },
      client: { select: { name: true, email: true } },
    },
  });
  if (!booking) return Response.json({ error: "Réservation introuvable" }, { status: 404 });

  // Verify the booking belongs to the requesting salon: at least one item's
  // offer must belong to this provider, OR the assignedEmployee is from
  // this provider.
  const fromThisSalon =
    booking.assignedEmployee?.id === employee.id ||
    booking.items.some((it) => it.offer.providerId === employee.providerId) ||
    (booking.assignedEmployee &&
      (await prisma.salonEmployee.count({
        where: { id: booking.assignedEmployee.id, providerId: employee.providerId },
      })) > 0);
  if (!fromThisSalon) {
    return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  }
  return Response.json(booking);
}

type UpdateBody = {
  notes?: string | null;
  assignedEmployeeId?: string | null;
};

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("bookings.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) return Response.json({ error: "Corps requis" }, { status: 400 });

  // Verify ownership.
  const existing = await prisma.booking.findUnique({
    where: { id },
    include: { items: { include: { offer: { select: { providerId: true } } } } },
  });
  if (!existing) return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  const owns = existing.items.some((it) => it.offer.providerId === employee.providerId);
  if (!owns) {
    // Fallback: assigned employee belongs to provider.
    if (!existing.assignedEmployeeId) {
      return Response.json({ error: "Réservation introuvable" }, { status: 404 });
    }
    const ok = await prisma.salonEmployee.count({
      where: { id: existing.assignedEmployeeId, providerId: employee.providerId },
    });
    if (ok === 0) return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.assignedEmployeeId !== undefined) data.assignedEmployeeId = body.assignedEmployeeId;

  const updated = await prisma.booking.update({ where: { id }, data });
  return Response.json(updated);
}
