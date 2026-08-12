import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { findConflicts } from "@/lib/booking-conflicts";

/**
 * Rendez-vous deja pris qui tomberaient hors des horaires proposes.
 *
 * Lecture seule : aucun effet de bord, appelable avant chaque enregistrement.
 * On interroge TimeSlot (qui porte startTime et bookedCount) plutot que
 * Booking : plus direct, et evite de joindre trois tables.
 */
export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const raw = req.nextUrl.searchParams.get("openingHours");
  if (!raw) {
    return NextResponse.json({ error: "Horaires manquants" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Horaires illisibles" }, { status: 400 });
  }
  if (!isValidOpeningHours(parsed)) {
    return NextResponse.json({ error: "Horaires d'ouverture invalides" }, { status: 400 });
  }

  const booked = await prisma.timeSlot.findMany({
    where: {
      startTime: { gte: new Date() },
      bookedCount: { gt: 0 },
      offer: { providerId: employee.providerId },
    },
    select: { startTime: true, offer: { select: { title: true } } },
  });

  const conflicts = findConflicts(
    booked.map((s) => ({ startTime: s.startTime, offerTitle: s.offer.title })),
    parsed as OpeningHours,
  );

  return NextResponse.json({
    conflicts: conflicts.map((c) => ({
      startTime: c.startTime.toISOString(),
      offerTitle: c.offerTitle,
    })),
  });
}
