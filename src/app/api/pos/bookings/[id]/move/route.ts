import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type Body = { newStartTime: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let employee;
  try {
    employee = await requirePermission("bookings.edit");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.newStartTime) {
    return Response.json({ error: "newStartTime requis" }, { status: 400 });
  }
  const newStart = new Date(body.newStartTime);
  if (Number.isNaN(newStart.getTime())) {
    return Response.json({ error: "newStartTime invalide" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { items: { include: { offer: true, slot: true } } },
  });
  if (!booking) return Response.json({ error: "Réservation introuvable" }, { status: 404 });

  const owns = booking.items.some((it) => it.offer.providerId === employee.providerId);
  if (!owns) return Response.json({ error: "Réservation introuvable" }, { status: 404 });

  if (booking.walkIn) {
    return Response.json(
      { error: "Les walk-ins ne peuvent pas être déplacés" },
      { status: 400 },
    );
  }
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    return Response.json({ error: "Réservation clôturée" }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      let cursor = newStart.getTime();
      // Allocate fresh slots for each item starting at the new cursor.
      const newAllocations: Array<{ itemId: string; oldSlotId: string; newSlotId: string }> = [];
      for (const item of booking.items) {
        const newSlot = await tx.timeSlot.findFirst({
          where: { offerId: item.offerId, startTime: new Date(cursor) },
        });
        if (!newSlot) {
          throw new Error(
            `Aucun créneau pour « ${item.offer.title} » à ${new Date(cursor).toLocaleTimeString("fr-FR")}`,
          );
        }
        if (newSlot.bookedCount >= newSlot.capacity && newSlot.id !== item.slotId) {
          throw new Error(`Créneau complet pour « ${item.offer.title} »`);
        }
        newAllocations.push({ itemId: item.id, oldSlotId: item.slotId, newSlotId: newSlot.id });
        cursor += item.offer.durationMinutes * 60_000;
      }

      // Free old slots and reserve new ones.
      for (const alloc of newAllocations) {
        if (alloc.oldSlotId === alloc.newSlotId) continue;
        await tx.timeSlot.update({
          where: { id: alloc.oldSlotId },
          data: { bookedCount: { decrement: 1 } },
        });
        await tx.timeSlot.update({
          where: { id: alloc.newSlotId },
          data: { bookedCount: { increment: 1 } },
        });
        await tx.bookingItem.update({
          where: { id: alloc.itemId },
          data: { slotId: alloc.newSlotId },
        });
      }
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 400 });
  }
}
