import { NextRequest, NextResponse } from "next/server";
import { tauxTvaApplicable } from "@/lib/tva-salon";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateOfferSlots } from "@/lib/slots";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { refusTitreOffre } from "@/lib/offer-title";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

// GET: list offers (for provider: their own, for others: all active)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  if (session?.user?.role === "PROVIDER") {
    let profile = await prisma.providerProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!profile) {
      // Auto-create profile for existing providers without one
      profile = await prisma.providerProfile.create({
        data: { userId: session.user.id, salonName: session.user.name || "Mon Salon", category: "AUTRE" },
      });
    }
    const offers = await prisma.offer.findMany({
      where: { providerId: profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { bookingItems: true, trackingLinks: true, slots: true } },
      },
    });
    return NextResponse.json(offers);
  }

  // Public: active offers
  // photos.isEmpty : une offre publiee mais sans photo reste masquee du feed.
  // C'est ce qui rend honnete le badge "Ajouter une photo" cote POS.
  const where: Record<string, unknown> = {
    active: true,
    publishedToMarketplace: true,
    photos: { isEmpty: false },
  };
  if (category) where.category = category;

  const offers = await prisma.offer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      provider: { select: { salonName: true, city: true, category: true } },
    },
  });
  return NextResponse.json(offers);
}

// POST: create offer (provider only)
export async function POST(req: NextRequest) {
  // Accepte les deux modes d'auth : session PROVIDER email/mot de passe ET
  // session employe par PIN. Sans cela un MANAGER connecte par PIN recevait
  // un 401 depuis /pos/services alors que la page lui accorde l'acces via
  // la permission products.manage.
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
  });
  if (!profile) {
    return NextResponse.json({ error: "Salon introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title,
    description,
    originalPrice,
    discountPrice,
    category,
    photos,
    durationMinutes,
    taxRate,
    publishedToMarketplace = true,
  } = body as {
    title?: string;
    description?: string | null;
    originalPrice?: string | number | null;
    discountPrice?: string | number;
    category?: string | null;
    photos?: string[];
    durationMinutes?: number;
    taxRate?: number;
    publishedToMarketplace?: boolean;
  };

  const missing: string[] = [];
  if (!title || !String(title).trim()) missing.push("titre");
  if (discountPrice === undefined || discountPrice === null || Number(discountPrice) <= 0) {
    missing.push("prix");
  }
  const duration = Number(durationMinutes);
  if (!ALLOWED_DURATIONS.includes(duration)) {
    missing.push(`durée (valeurs : ${ALLOWED_DURATIONS.join(", ")} min)`);
  }

  // Publier est desormais l'intention par defaut : la completude conditionne
  // la VISIBILITE dans le feed, pas la creation. Un service cree par l'ajout
  // rapide (nom + prix + duree + TVA) est donc publie mais masque du feed
  // tant qu'il n'a pas de photo — l'interface affiche un badge "Ajouter une
  // photo" pour le signaler. Le garde-fou de publication sera reimplemente
  // cote UI dans le drawer d'edition au lot B.
  const finalCategory = category ?? "AUTRE";

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Champs requis manquants : ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  // Trois des six offres de l'accueil s'appelaient « test » ou « test0 »,
  // indexees par Google. Le controle ne porte QUE sur la publication : un
  // salon garde le droit d'appeler « x » un service interne a sa caisse.
  if (publishedToMarketplace) {
    const refus = refusTitreOffre(String(title));
    if (refus) {
      return NextResponse.json({ error: refus.message }, { status: refus.status });
    }
  }

  // Un salon non assujetti obtient 0 %, quoi qu'il demande : c'est le seul
  // moyen d'etre sur qu'aucune ligne ne porte de TVA fantome, quel que soit
  // le chemin de creation. Silencieux a dessein — la caisse et l'assistant
  // creent des services sans jamais parler de TVA.
  const tax = tauxTvaApplicable(profile.vatRegistered, taxRate);

  const offer = await prisma.offer.create({
    data: {
      providerId: profile.id,
      title: String(title).trim(),
      description: description || null,
      originalPrice: originalPrice ?? null,
      discountPrice,
      category: finalCategory as never,
      photos: photos || [],
      durationMinutes: duration,
      taxRate: tax,
      publishedToMarketplace,
    } as never,
  });

  // Les creneaux sont generes pour tout service : ils servent aussi bien aux
  // reservations en ligne qu'au calendrier interne du POS.
  await regenerateOfferSlots(offer.id);

  return NextResponse.json(offer, { status: 201 });
}
