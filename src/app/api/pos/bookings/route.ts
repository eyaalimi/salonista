import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireEmployee, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  // Pas de garde de module ici : les rendez-vous sont du metier, pas de la
  // caisse. Une reservation prise par une cliente sur la marketplace doit
  // apparaitre dans le calendrier du salon meme sans le module caisse — sinon
  // le salon ne voit jamais la cliente qu'il doit recevoir.
  if (!employee.permissions["bookings.view"]) {
    return Response.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const fromStr = params.get("from");
  const toStr = params.get("to");
  const employeeId = params.get("employeeId");
  const includePhantom = params.get("includePhantom") === "1";

  const from = fromStr ? new Date(fromStr) : new Date();
  const to = toStr ? new Date(toStr) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Bookings for this provider in the time window. We match either by:
  //   - Booking.assignedEmployeeId belonging to this provider's employees
  //   - Any BookingItem on an offer owned by this provider, with a slot in the range
  // The latter catches public-flow bookings (where assignedEmployeeId is null).
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        {
          items: {
            some: {
              offer: { providerId: employee.providerId },
              slot: { startTime: { gte: from, lte: to } },
            },
          },
        },
        {
          assignedEmployee: { providerId: employee.providerId },
          createdAt: { gte: from, lte: to },
        },
      ],
      ...(employeeId ? { assignedEmployeeId: employeeId } : {}),
      ...(includePhantom ? {} : { phantom: false }),
    },
    include: {
      items: {
        include: {
          offer: { select: { id: true, title: true, durationMinutes: true } },
          slot: { select: { id: true, startTime: true, endTime: true } },
        },
      },
      customer: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      // Une reservation prise sur la marketplace n'a pas de `customer` (fiche
      // client du salon) : la personne est le `client`, un User. Sans cette
      // relation le calendrier affichait « Sans client » pour toute
      // reservation venue du site.
      client: { select: { id: true, name: true, email: true, phone: true } },
      assignedEmployee: { select: { id: true, displayName: true } },
      sale: { select: { id: true, receiptNumber: true, status: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });
  return Response.json(bookings);
}

type CreateBody = {
  customerId?: string | null;
  walkIn?: boolean;
  startTime: string;
  offerIds?: string[];
  durationMinutes?: number;
  assignedEmployeeId?: string | null;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("bookings.create");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  // Voir le GET : prendre un rendez-vous releve du metier, pas de la caisse.

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body || !body.startTime) {
    return Response.json({ error: "startTime requis" }, { status: 400 });
  }
  const start = new Date(body.startTime);
  if (Number.isNaN(start.getTime())) {
    return Response.json({ error: "startTime invalide" }, { status: 400 });
  }

  const isWalkIn = !!body.walkIn;
  const offerIds = body.offerIds ?? [];

  // Resolve owning client User: POS-created bookings still need a clientId
  // (the schema requires it). Use the customer's linked User if present,
  // otherwise the provider's own User as a fallback (so we never block).
  let clientUserId: string | null = null;
  if (body.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { userId: true },
    });
    clientUserId = customer?.userId ?? null;
  }
  if (!clientUserId) {
    const provider = await prisma.providerProfile.findUnique({
      where: { id: employee.providerId },
      select: { userId: true },
    });
    clientUserId = provider?.userId ?? null;
  }
  if (!clientUserId) {
    return Response.json({ error: "Impossible de résoudre le client" }, { status: 500 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let totalPrice = 0;
      const itemRows: { offerId: string; slotId: string; unitPrice: number }[] = [];
      let endTime = start;

      // Walk-ins: no slot reservation, no items.
      if (!isWalkIn && offerIds.length > 0) {
        const offers = await tx.offer.findMany({ where: { id: { in: offerIds } } });
        if (offers.length !== offerIds.length) {
          throw new Error("Une ou plusieurs offres sont introuvables");
        }
        const offerMap = new Map(offers.map((o) => [o.id, o]));
        for (const o of offers) {
          if (o.providerId !== employee.providerId) {
            throw new Error("Offre d'un autre salon");
          }
        }

        let cursor = start.getTime();
        for (const offerId of offerIds) {
          const offer = offerMap.get(offerId)!;
          const slot = await tx.timeSlot.findFirst({
            where: { offerId, startTime: new Date(cursor) },
          });
          if (!slot) {
            throw new Error(`Aucun créneau pour « ${offer.title} » à ${new Date(cursor).toLocaleTimeString("fr-FR")}`);
          }
          if (slot.bookedCount >= slot.capacity) {
            throw new Error(`Créneau complet pour « ${offer.title} »`);
          }
          await tx.timeSlot.update({
            where: { id: slot.id },
            data: { bookedCount: { increment: 1 } },
          });
          const unitPrice = Number(offer.discountPrice);
          totalPrice += unitPrice;
          itemRows.push({ offerId: offer.id, slotId: slot.id, unitPrice });
          cursor += offer.durationMinutes * 60_000;
        }
        endTime = new Date(cursor);
      } else if (isWalkIn) {
        const dur = body.durationMinutes ?? 30;
        endTime = new Date(start.getTime() + dur * 60_000);
      }

      const booking = await tx.booking.create({
        data: {
          clientId: clientUserId,
          customerId: body.customerId ?? null,
          walkIn: isWalkIn,
          createdViaPos: true,
          phantom: false,
          assignedEmployeeId: body.assignedEmployeeId ?? employee.id,
          status: "CONFIRMED",
          totalPrice,
          notes: body.notes ?? null,
          ...(itemRows.length > 0 ? { items: { create: itemRows } } : {}),
        },
        include: {
          items: { include: { offer: true, slot: true } },
          customer: true,
          assignedEmployee: { select: { id: true, displayName: true } },
        },
      });

      // Phase-2-style platform commission so analytics aggregates remain consistent.
      if (totalPrice > 0) {
        await tx.commission.create({
          data: {
            bookingId: booking.id,
            providerAmount: totalPrice * 0.9,
            platformAmount: totalPrice * 0.1,
          },
        });
      }

      return { booking, endTime };
    });

    return Response.json(result.booking, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return Response.json({ error: msg }, { status: 400 });
  }
}
