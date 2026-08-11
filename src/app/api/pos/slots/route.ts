/**
 * Available slots for a set of consecutive services on a given day.
 *
 * Given ?offerIds=a,b,c&date=YYYY-MM-DD, returns the list of possible start
 * times where all offers can be booked back-to-back. A candidate startTime
 * is valid iff:
 *  - Offer[0] has a free slot at `startTime`
 *  - Offer[1] has a free slot at `startTime + offer[0].duration`
 *  - Offer[2] has a free slot at `startTime + sum(prior durations)`
 *  - …and so on.
 *
 * Only slots with bookedCount < capacity are considered free.
 *
 * Returns: { slots: Array<{ startTime: string; endTime: string }> }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requireEmployee();
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }
  if (!employee.permissions["bookings.view"]) {
    return Response.json({ error: "Permission insuffisante" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const offerIdsRaw = params.get("offerIds");
  const dateRaw = params.get("date");
  if (!offerIdsRaw || !dateRaw) {
    return Response.json({ error: "offerIds et date requis" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    return Response.json({ error: "date invalide (YYYY-MM-DD)" }, { status: 400 });
  }

  const offerIds = offerIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (offerIds.length === 0) {
    return Response.json({ slots: [] });
  }

  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds }, providerId: employee.providerId },
    select: { id: true, durationMinutes: true },
  });
  if (offers.length !== offerIds.length) {
    return Response.json({ error: "Une ou plusieurs offres sont introuvables" }, { status: 404 });
  }
  const offerById = new Map(offers.map((o) => [o.id, o]));

  // Local day window — TimeSlot.startTime is stored as UTC but was generated
  // from provider-local hours; we widen to cover the whole calendar day.
  const [y, m, d] = dateRaw.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  const firstOfferId = offerIds[0];
  const firstOffer = offerById.get(firstOfferId)!;

  const firstSlots = await prisma.timeSlot.findMany({
    where: {
      offerId: firstOfferId,
      startTime: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { startTime: "asc" },
  });

  // Fast path: single offer — filter free slots and return.
  if (offerIds.length === 1) {
    const now = Date.now();
    const out = firstSlots
      .filter((s) => s.bookedCount < s.capacity && s.startTime.getTime() > now)
      .map((s) => ({
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      }));
    return Response.json({ slots: out });
  }

  // Multi-offer chain: for each candidate first-slot start, verify every
  // subsequent offer has a free slot at the cumulative offset.
  // Load ALL candidate slots for the tail offers in one shot to avoid N+M
  // roundtrips inside the loop.
  const tailOfferIds = offerIds.slice(1);
  const tailSlots = await prisma.timeSlot.findMany({
    where: {
      offerId: { in: tailOfferIds },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    select: { offerId: true, startTime: true, bookedCount: true, capacity: true },
  });
  // Index: `${offerId}|${startTimeMs}` -> free?
  const tailIndex = new Map<string, boolean>();
  for (const s of tailSlots) {
    tailIndex.set(
      `${s.offerId}|${s.startTime.getTime()}`,
      s.bookedCount < s.capacity,
    );
  }

  const out: Array<{ startTime: string; endTime: string }> = [];
  const now = Date.now();
  for (const first of firstSlots) {
    if (first.bookedCount >= first.capacity) continue;
    if (first.startTime.getTime() <= now) continue;
    let cursor = first.startTime.getTime() + firstOffer.durationMinutes * 60_000;
    let allFit = true;
    for (const oid of tailOfferIds) {
      const key = `${oid}|${cursor}`;
      if (!tailIndex.get(key)) {
        allFit = false;
        break;
      }
      cursor += offerById.get(oid)!.durationMinutes * 60_000;
    }
    if (allFit) {
      out.push({
        startTime: first.startTime.toISOString(),
        endTime: new Date(cursor).toISOString(),
      });
    }
  }

  return Response.json({ slots: out });
}
