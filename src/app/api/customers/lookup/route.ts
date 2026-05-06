import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";
import { requirePermission, toResponse } from "@/lib/employee-session";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("customers.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const phoneRaw = req.nextUrl.searchParams.get("phone");
  if (!phoneRaw) {
    return Response.json({ error: "Numéro de téléphone requis" }, { status: 400 });
  }
  const phone = tryNormalizePhone(phoneRaw);
  if (!phone) {
    return Response.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) {
    return Response.json({ found: false });
  }

  const providerId = employee.providerId;

  let isOwn = customer.firstSalonId === providerId;
  if (!isOwn) {
    const hasBookingHere = await prisma.booking.findFirst({
      where: {
        customerId: customer.id,
        items: { some: { offer: { providerId } } },
      },
      select: { id: true },
    });
    if (hasBookingHere) isOwn = true;
  }

  if (!isOwn) {
    return Response.json({
      found: true,
      scope: "external",
      customer: {
        id: customer.id,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
    select: {
      totalPrice: true,
      createdAt: true,
      items: {
        select: { slot: { select: { startTime: true } } },
        orderBy: { slot: { startTime: "desc" } },
        take: 1,
      },
    },
  });

  let lifetimeSpendMillimes = 0; // sum in millimes (3-decimal Tunisian dinar)
  let lastVisitAt: Date | null = null;
  for (const b of bookings) {
    lifetimeSpendMillimes += Math.round(Number(b.totalPrice) * 1000);
    const last = b.items[0]?.slot.startTime;
    if (last && (!lastVisitAt || last > lastVisitAt)) {
      lastVisitAt = last;
    }
  }

  const lifetimeSpendStr = (lifetimeSpendMillimes / 1000).toFixed(3);

  return Response.json({
    found: true,
    scope: "own",
    customer: {
      id: customer.id,
      phone: customer.phone,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      birthday: customer.birthday,
      notes: customer.notes,
      createdAt: customer.createdAt,
    },
    stats: {
      bookingsCount: bookings.length,
      lastVisitAt,
      lifetimeSpend: lifetimeSpendStr,
    },
  });
}
