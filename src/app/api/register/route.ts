import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { nanoid } from "nanoid";
import { sendVerificationEmail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, phone, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, nom et mot de passe requis" },
        { status: 400 }
      );
    }

    if (!["CLIENT", "INFLUENCER", "PROVIDER"].includes(role)) {
      return NextResponse.json(
        { error: "Rôle invalide" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Un compte avec cet email existe déjà" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    // Inline-checkout flow (autoVerify) only for CLIENT — provider/influencer always verify.
    const inlineCheckout = body.autoVerify === true && role === "CLIENT";
    const requireVerification =
      process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !inlineCheckout;
    const verifyToken = requireVerification ? nanoid(32) : null;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: role as Role,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: requireVerification ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        emailVerified: requireVerification ? null : new Date(),
      },
    });

    // Auto-create profiles for providers and influencers
    if (role === "PROVIDER") {
      await prisma.providerProfile.create({
        data: {
          userId: user.id,
          salonName: body.salonName || name,
          category: body.category || "AUTRE",
        },
      });
    } else if (role === "INFLUENCER") {
      if (!body.instagramHandle) {
        await prisma.user.delete({ where: { id: user.id } });
        return NextResponse.json(
          { error: "Le pseudo Instagram est requis" },
          { status: 400 }
        );
      }
      await prisma.influencerProfile.create({
        data: {
          userId: user.id,
          instagramHandle: body.instagramHandle.replace(/^@/, "").trim(),
        },
      });
    }

    if (requireVerification && verifyToken) {
      // Send verification email (non-blocking)
      sendVerificationEmail(email, name, verifyToken).catch(console.error);
      return NextResponse.json(
        { message: "Compte créé. Vérifiez votre email.", userId: user.id, needsVerification: true },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { message: "Compte créé.", userId: user.id, needsVerification: false },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
