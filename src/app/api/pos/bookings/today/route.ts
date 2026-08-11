import { prisma } from "@/lib/prisma";
import { requireEmployee, toResponse } from "@/lib/employee-session";
import { requireModule } from "@/lib/modules";

export async function GET() {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Coarse filter: any booking of this provider that either has a slot today
  // OR was created today (walk-ins/no-slot cases). Filtering by createdAt
  // alone excluded bookings created yesterday for today — they never showed
  // up in the "RDV aujourd'hui" panel.
  const bookings = await prisma.booking.findMany({
    where: {
      phantom: false,
      items: { some: { offer: { providerId: employee.providerId } } },
      OR: [
        { items: { some: { slot: { startTime: { gte: today, lt: tomorrow } } } } },
        { createdAt: { gte: today, lt: tomorrow } },
      ],
    },
    include: {
      customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
      items: {
        include: {
          slot: { select: { startTime: true, endTime: true } },
          offer: { select: { id: true, title: true, durationMinutes: true, discountPrice: true, taxRate: true } },
        },
      },
      sale: { select: { id: true } },
    },
  });

  // Refine: keep only bookings whose first slot (or createdAt fallback for
  // walk-ins) falls in today's calendar day.
  const startOfDay = today.getTime();
  const endOfDay = tomorrow.getTime();

  const todays = bookings.filter((b) => {
    const start = b.items[0]?.slot?.startTime?.getTime() ?? b.createdAt.getTime();
    return start >= startOfDay && start < endOfDay;
  });

  todays.sort((a, b) => {
    const sa = a.items[0]?.slot?.startTime?.getTime() ?? a.createdAt.getTime();
    const sb = b.items[0]?.slot?.startTime?.getTime() ?? b.createdAt.getTime();
    return sa - sb;
  });

  return Response.json({
    bookings: todays.map((b) => {
      const start = b.items[0]?.slot?.startTime ?? b.createdAt;
      const lastSlotEnd = b.items.reduce<Date | null>((latest, it) => {
        const end = it.slot?.endTime;
        if (!end) return latest;
        return !latest || end > latest ? end : latest;
      }, null);
      return {
        id: b.id,
        startTime: start,
        endTime: lastSlotEnd,
        status: b.status,
        saleId: b.sale?.id ?? null,
        customer: b.customer,
        items: b.items.map((it) => ({
          offerId: it.offer.id,
          name: it.offer.title,
          duration: it.offer.durationMinutes,
          price: String(it.offer.discountPrice),
          taxRate: String(it.offer.taxRate),
        })),
      };
    }),
  });
}
