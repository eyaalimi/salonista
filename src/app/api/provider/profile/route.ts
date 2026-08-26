import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidOpeningHours } from "@/lib/opening-hours";
import { regenerateAllProviderSlots } from "@/lib/slots";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { refusPhotosSalon } from "@/lib/upload-image";

export async function GET() {
  // Accepte session PROVIDER et session employe par PIN : un proprietaire
  // ouvre le plus souvent la caisse avec son code, pas avec son mot de passe.
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("settings.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = await req.json();
  const {
    salonName,
    category,
    description,
    address,
    city,
    phone,
    lat,
    lng,
    photos,
    logo,
    openingHours,
    matriculeFiscal,
    receiptFooter,
  } = body;

  if (openingHours !== undefined && !isValidOpeningHours(openingHours)) {
    return NextResponse.json({ error: "Horaires d'ouverture invalides" }, { status: 400 });
  }
  // `photos` etait recopie en base tel quel : ni le nombre ni la forme
  // n'etaient verifies cote serveur, seule l'interface limitait a 5.
  if (photos !== undefined) {
    const refus = refusPhotosSalon(photos);
    if (refus) {
      return NextResponse.json({ error: refus.message }, { status: refus.status });
    }
  }
  if (
    receiptFooter !== undefined &&
    typeof receiptFooter === "string" &&
    receiptFooter.length > 200
  ) {
    return NextResponse.json(
      { error: "Le pied de reçu ne peut excéder 200 caractères" },
      { status: 400 },
    );
  }

  // lat et lng vont toujours ensemble : soit un point complet, soit aucun.
  // Un seul des deux renseigne un demi-point, qu'aucun affichage ne sait
  // utiliser (la fiche publique teste `lat && lng`).
  const latFourni = lat !== undefined && lat !== null;
  const lngFourni = lng !== undefined && lng !== null;
  if (latFourni !== lngFourni) {
    return NextResponse.json(
      { error: "Latitude et longitude doivent être fournies ensemble" },
      { status: 400 },
    );
  }
  if (latFourni && lngFourni) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
    }
  }

  const profile = await prisma.providerProfile.update({
    where: { id: employee.providerId },
    data: {
      salonName,
      category,
      description,
      address,
      city,
      phone,
      ...(lat !== undefined ? { lat: lat === null ? null : Number(lat) } : {}),
      ...(lng !== undefined ? { lng: lng === null ? null : Number(lng) } : {}),
      openingHours,
      ...(photos !== undefined ? { photos } : {}),
      // Chaine vide -> null : un logo retire doit disparaitre, pas devenir "".
      ...(logo !== undefined ? { logo: logo || null } : {}),
      ...(matriculeFiscal !== undefined ? { matriculeFiscal: matriculeFiscal || null } : {}),
      ...(receiptFooter !== undefined ? { receiptFooter: receiptFooter || null } : {}),
    },
  });

  if (openingHours !== undefined) {
    await regenerateAllProviderSlots(profile.id);
  }

  return NextResponse.json(profile);
}
