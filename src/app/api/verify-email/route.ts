import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: token },
  });

  if (!user) {
    return NextResponse.json({ error: "Token invalide" }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: "Email déjà vérifié", alreadyVerified: true });
  }

  if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
    return NextResponse.json({ error: "Token expiré" }, { status: 410 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      emailVerifyToken: null,
      emailVerifyExpires: null,
    },
  });

  return NextResponse.json({ message: "Email vérifié avec succès", verified: true });
}

// POST — Resend verification email
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.emailVerified) {
    return NextResponse.json({ message: "Si ce compte existe, un email a été envoyé" });
  }

  const { nanoid } = await import("nanoid");
  const { sendVerificationEmail } = await import("@/lib/mail");

  const newToken = nanoid(32);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyToken: newToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  sendVerificationEmail(email, user.name || "", newToken).catch(console.error);

  return NextResponse.json({ message: "Email de vérification envoyé" });
}
