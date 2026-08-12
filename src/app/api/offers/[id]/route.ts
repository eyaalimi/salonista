import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateOfferSlots } from "@/lib/slots";
import { requirePermission, toResponse } from "@/lib/employee-session";

const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

// GET: single offer
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      provider: { select: { salonName: true, city: true, category: true, photos: true } },
      slots: { orderBy: { startTime: "asc" } },
      _count: { select: { bookingItems: true, trackingLinks: true } },
    },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  // Check if unpublished — if so, only allow provider-owner or admin
  const isPublished = (offer as { publishedToMarketplace?: boolean }).publishedToMarketplace ?? false;
  if (!isPublished) {
    const session = await getServerSession(authOptions);
    let allowed = false;
    if (session?.user?.role === "ADMIN") {
      allowed = true;
    } else if (session?.user?.role === "PROVIDER") {
      const profile = await prisma.providerProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (profile?.id === offer.providerId) {
        allowed = true;
      }
    }
    if (!allowed) {
      return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
    }
  }

  return NextResponse.json(offer);
}

// PUT: update offer (owner only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Accepte session PROVIDER et session employe par PIN (cf. POST /api/offers).
  let employee;
  try {
    employee = await requirePermission("products.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== employee.providerId) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  const body = await req.json();

  const existingPublished = (offer as { publishedToMarketplace?: boolean }).publishedToMarketplace ?? false;
  // Valeur a ecrire : inchangee si le corps ne la mentionne pas.
  const willBePublished = body.publishedToMarketplace ?? existingPublished;

  // On ne valide que la TRANSITION explicite vers "publie", pas chaque
  // modification d'une offre deja publiee.
  //
  // Depuis que la creation publie par defaut, valider sur l'etat final
  // rendait toute offre issue de l'ajout rapide immediatement non
  // modifiable : basculer la TVA ou le statut actif renvoyait un 400
  // "prix barre + photo manquants", alors que ces champs n'ont rien a voir
  // avec l'operation demandee. La completude conditionne la VISIBILITE dans
  // le feed (filtre photos.isEmpty cote lecture), pas le droit de modifier.
  const isPublishTransition = body.publishedToMarketplace === true && !existingPublished;

  if (isPublishTransition) {
    const missing: string[] = [];
    const effCategory = body.category ?? offer.category;
    if (!effCategory) missing.push("catégorie");
    const effOriginal = body.originalPrice ?? offer.originalPrice;
    const effDiscount = body.discountPrice ?? offer.discountPrice;
    if (
      effOriginal === null ||
      effOriginal === undefined ||
      Number(effOriginal) < Number(effDiscount)
    ) {
      missing.push("prix barré (≥ prix actuel)");
    }
    const effPhotos = body.photos ?? offer.photos;
    if (!effPhotos || effPhotos.length === 0) missing.push("au moins une photo");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Publication impossible — champs manquants : ${missing.join(", ")}` },
        { status: 400 },
      );
    }
  }

  let nextDuration = offer.durationMinutes;
  if (body.durationMinutes !== undefined) {
    const d = Number(body.durationMinutes);
    if (!ALLOWED_DURATIONS.includes(d)) {
      return NextResponse.json(
        { error: `Durée invalide. Valeurs autorisées : ${ALLOWED_DURATIONS.join(", ")} minutes` },
        { status: 400 }
      );
    }
    nextDuration = d;
  }

  let nextTaxRate: number | undefined;
  if (body.taxRate !== undefined) {
    const t = Number(body.taxRate);
    if (Number.isNaN(t) || t < 0 || t > 100) {
      return NextResponse.json({ error: "Taux de TVA invalide (0–100)" }, { status: 400 });
    }
    nextTaxRate = t;
  }

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      title: body.title ?? offer.title,
      description: body.description ?? offer.description,
      originalPrice: body.originalPrice ?? offer.originalPrice,
      discountPrice: body.discountPrice ?? offer.discountPrice,
      category: body.category ?? offer.category,
      photos: body.photos ?? offer.photos,
      active: body.active ?? offer.active,
      durationMinutes: nextDuration,
      ...(nextTaxRate !== undefined ? { taxRate: nextTaxRate } : {}),
      publishedToMarketplace: willBePublished,
    } as never,
  });

  // Duration changes always require regen (slots may exist for POS-only offers
  // from earlier states; keeping them aligned with durationMinutes is the
  // safe default). Newly-published offers also need their initial slot grid.
  const durationChanged = nextDuration !== offer.durationMinutes;
  const becamePublished = willBePublished && !existingPublished;
  if (durationChanged || becamePublished) {
    await regenerateOfferSlots(id);
  }

  return NextResponse.json(updated);
}

// DELETE: delete offer (owner only)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer || offer.providerId !== profile?.id) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  await prisma.offer.delete({ where: { id } });
  return NextResponse.json({ message: "Offre supprimée" });
}
