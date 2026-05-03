import { prisma } from "@/lib/prisma";
import { generateSlots, isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";

const DAYS_AHEAD = 30;

/**
 * Regenerate the slot grid for a single offer over the next DAYS_AHEAD days,
 * based on the provider's opening hours and the offer's durationMinutes.
 *
 * Logic:
 * - Read current slots for this offer from now.
 * - Compute desired slots from opening hours + duration.
 * - Insert missing slots; delete future slots that no longer match the grid AND have zero bookings.
 * - Slots with bookedCount > 0 are preserved even if no longer aligned (so we don't break existing bookings).
 */
export async function regenerateOfferSlots(offerId: string): Promise<{ added: number; removed: number }> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { provider: { select: { openingHours: true } } },
  });
  if (!offer) return { added: 0, removed: 0 };

  const hoursRaw = offer.provider.openingHours;
  if (!isValidOpeningHours(hoursRaw)) return { added: 0, removed: 0 };
  const hours = hoursRaw as OpeningHours;

  const desired = generateSlots(hours, new Date(), DAYS_AHEAD, offer.durationMinutes);
  const desiredKeys = new Set(desired.map((s) => s.startTime.getTime()));

  const existing = await prisma.timeSlot.findMany({
    where: { offerId, startTime: { gte: new Date() } },
  });

  // Remove future slots that no longer match the grid AND have no bookings
  const toRemove = existing.filter(
    (s) => s.bookedCount === 0 && !desiredKeys.has(s.startTime.getTime())
  );

  // Add missing slots
  const existingKeys = new Set(existing.map((s) => s.startTime.getTime()));
  const toAdd = desired.filter((s) => !existingKeys.has(s.startTime.getTime()));

  if (toRemove.length > 0) {
    await prisma.timeSlot.deleteMany({
      where: { id: { in: toRemove.map((s) => s.id) } },
    });
  }
  if (toAdd.length > 0) {
    await prisma.timeSlot.createMany({
      data: toAdd.map((s) => ({
        offerId,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: 1,
      })),
    });
  }

  return { added: toAdd.length, removed: toRemove.length };
}

/**
 * Regenerate slots for ALL offers of a provider — call after opening hours change.
 */
export async function regenerateAllProviderSlots(providerId: string): Promise<void> {
  const offers = await prisma.offer.findMany({
    where: { providerId, active: true },
    select: { id: true },
  });
  for (const offer of offers) {
    await regenerateOfferSlots(offer.id);
  }
}
