import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail, sendNewBookingToProvider } from "@/lib/mail";
import { formatHeure } from "@/lib/datetime";

// New input shape: an ordered list of offer IDs and a single starting time.
// The server allocates consecutive slots back-to-back for each offer.
type BookingPayload = {
  offerIds: string[];
  startTime: string; // ISO
  notes?: string;
  trackingToken?: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const { offerIds, startTime, notes, trackingToken } = (await req.json()) as BookingPayload;

  if (!Array.isArray(offerIds) || offerIds.length === 0) {
    return NextResponse.json({ error: "Au moins une offre requise" }, { status: 400 });
  }
  const start = new Date(startTime);
  if (isNaN(start.getTime())) {
    return NextResponse.json({ error: "Heure de début invalide" }, { status: 400 });
  }
  if (start.getTime() < Date.now()) {
    return NextResponse.json({ error: "Créneau expiré" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Load all offers in the cart and check they belong to the same provider
      const offers = await tx.offer.findMany({ where: { id: { in: offerIds } } });
      if (offers.length !== offerIds.length) {
        throw new Error("Une ou plusieurs offres sont introuvables");
      }
      const offerMap = new Map(offers.map((o) => [o.id, o]));
      const providerIds = new Set(offers.map((o) => o.providerId));
      if (providerIds.size > 1) {
        throw new Error("Toutes les offres doivent appartenir au même salon");
      }
      for (const o of offers) {
        if (!o.active) throw new Error(`Offre « ${o.title} » inactive`);
      }

      let totalPrice = 0;
      const itemRows: { offerId: string; slotId: string; unitPrice: number }[] = [];

      // Walk the cart: for each offer, find a slot starting at the running cursor time
      let cursor = start.getTime();

      for (const offerId of offerIds) {
        const offer = offerMap.get(offerId)!;
        const slot = await tx.timeSlot.findFirst({
          where: { offerId, startTime: new Date(cursor) },
        });
        if (!slot) {
          throw new Error(
            `Aucun créneau pour « ${offer.title} » à ${formatHeure(new Date(cursor))}`
          );
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

      const booking = await tx.booking.create({
        data: {
          clientId: session.user.id,
          totalPrice,
          notes: notes || null,
          items: { create: itemRows },
        },
      });

      // Tracking attribution: the tracking link is bound to a CollaborationOffer.
      // The commission % comes from the parent CollaborationRequest.
      // Only the cart items matching the linked offer earn the influencer their %.
      const PLATFORM_PCT = 0.1;
      let influencerAmount = 0;
      let providerAmount = 0;

      if (trackingToken) {
        const link = await tx.trackingLink.findUnique({
          where: { token: trackingToken },
          include: { collaborationOffer: { include: { collab: true } } },
        });
        if (link && link.collaborationOffer && link.collaborationOffer.collab.status === "ACCEPTED") {
          // Find the cart row that matches the linked offer
          const matchingItem = itemRows.find((r) => r.offerId === link.offerId);
          if (matchingItem) {
            const collab = link.collaborationOffer.collab;
            const pct = Number(collab.commissionPct) / 100;
            influencerAmount = matchingItem.unitPrice * pct;

            const click = await tx.click.findFirst({
              where: { trackingLinkId: link.id, converted: false, bookingId: null },
              orderBy: { clickedAt: "desc" },
            });
            if (click) {
              await tx.click.update({
                where: { id: click.id },
                data: { converted: true, bookingId: booking.id },
              });
            }
            await tx.trackingLink.update({
              where: { id: link.id },
              data: { conversionsCount: { increment: 1 } },
            });
            await tx.influencerProfile.update({
              where: { id: link.influencerId },
              data: { pendingBalance: { increment: influencerAmount } },
            });
          }
        }
      }

      const platformAmount = totalPrice * PLATFORM_PCT;
      providerAmount = totalPrice - influencerAmount - platformAmount;

      await tx.commission.create({
        data: {
          bookingId: booking.id,
          providerAmount,
          influencerAmount: influencerAmount > 0 ? influencerAmount : null,
          platformAmount,
        },
      });

      return booking;
    });

    // Emails (non-blocking)
    const full = await prisma.booking.findUnique({
      where: { id: result.id },
      include: {
        client: { select: { name: true, email: true } },
        items: {
          include: {
            offer: { include: { provider: { select: { salonName: true, userId: true } } } },
            slot: true,
          },
        },
      },
    });

    if (full) {
      const firstItem = full.items[0];
      const dateStr = new Date(firstItem.slot.startTime).toLocaleDateString("fr-TN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const offerTitles = full.items.map((i) => i.offer.title).join(", ");

      sendBookingConfirmationEmail(full.client.email, {
        clientName: full.client.name || "",
        offerTitle: offerTitles,
        salonName: firstItem.offer.provider.salonName,
        date: dateStr,
        price: Number(full.totalPrice).toFixed(0),
      }).catch(console.error);

      const providerUser = await prisma.user.findUnique({
        where: { id: firstItem.offer.provider.userId },
        select: { email: true },
      });
      if (providerUser) {
        sendNewBookingToProvider(providerUser.email, {
          salonName: firstItem.offer.provider.salonName,
          clientName: full.client.name || full.client.email,
          offerTitle: offerTitles,
          date: dateStr,
          price: Number(full.totalPrice).toFixed(0),
        }).catch(console.error);
      }
    }

    const response = NextResponse.json(result, { status: 201 });
    response.cookies.set("tracking_ref", "", { maxAge: 0, path: "/" });
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur lors de la réservation";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          offer: { include: { provider: { select: { salonName: true, city: true } } } },
          slot: true,
        },
      },
      commission: { select: { influencerAmount: true } },
    },
  });

  return NextResponse.json(bookings);
}
