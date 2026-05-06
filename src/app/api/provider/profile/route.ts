import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidOpeningHours } from "@/lib/opening-hours";
import { regenerateAllProviderSlots } from "@/lib/slots";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await prisma.providerProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PROVIDER") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const {
    salonName,
    category,
    description,
    address,
    city,
    phone,
    openingHours,
    matriculeFiscal,
    receiptFooter,
  } = body;

  if (openingHours !== undefined && !isValidOpeningHours(openingHours)) {
    return NextResponse.json({ error: "Horaires d'ouverture invalides" }, { status: 400 });
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

  const profile = await prisma.providerProfile.upsert({
    where: { userId: session.user.id },
    update: {
      salonName,
      category,
      description,
      address,
      city,
      phone,
      openingHours,
      ...(matriculeFiscal !== undefined ? { matriculeFiscal: matriculeFiscal || null } : {}),
      ...(receiptFooter !== undefined ? { receiptFooter: receiptFooter || null } : {}),
    },
    create: {
      userId: session.user.id,
      salonName: salonName || "Mon Salon",
      category: category || "AUTRE",
      description,
      address,
      city,
      phone,
      openingHours,
      matriculeFiscal: matriculeFiscal || null,
      receiptFooter: receiptFooter || null,
    },
  });

  if (openingHours !== undefined) {
    await regenerateAllProviderSlots(profile.id);
  }

  return NextResponse.json(profile);
}
