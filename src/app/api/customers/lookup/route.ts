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

  const providerId = employee.providerId;

  /*
   * On ne cherche QUE dans les fiches de ce salon. La recherche portait avant
   * sur le seul telephone, unique a l'echelle de la base : elle remontait la
   * fiche d'un autre salon, et la branche « external » en rendait meme le nom
   * et le prenom. Un salon n'a pas a savoir qui sont les clientes du salon
   * d'en face, ni sous quel nom elles y sont enregistrees.
   *
   * Une fiche peut aussi appartenir au salon par ses reservations plutot que
   * par `firstSalonId` — cas des clientes venues de la place de marche, dont
   * la fiche a ete creee ailleurs.
   */
  const customer =
    (await prisma.customer.findFirst({
      where: { phone, firstSalonId: providerId },
    })) ??
    (await prisma.customer.findFirst({
      where: {
        phone,
        bookings: { some: { items: { some: { offer: { providerId } } } } },
      },
    }));

  if (!customer) {
    return Response.json({ found: false });
  }

  // Les statistiques ne comptent que les visites DANS CE SALON : le total
  // depense chez le salon d'a cote ne regarde pas celui-ci.
  const bookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      items: { some: { offer: { providerId } } },
    },
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
