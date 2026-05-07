import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("bookings.cancel");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { items: { include: { slot: true, offer: { select: { providerId: true } } } } },
  });
  if (!booking) {
    return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  }

  const owns = booking.items.some((it) => it.offer.providerId === employee.providerId);
  if (!owns) {
    return Response.json({ error: "Réservation introuvable" }, { status: 404 });
  }
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    return Response.json({ error: "Réservation déjà clôturée" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    // Free the slots.
    for (const item of booking.items) {
      if (item.slot.bookedCount > 0) {
        await tx.timeSlot.update({
          where: { id: item.slot.id },
          data: { bookedCount: { decrement: 1 } },
        });
      }
    }
    await tx.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  });

  return Response.json({ ok: true });
}
