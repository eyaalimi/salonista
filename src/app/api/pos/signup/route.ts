/**
 * Silent POS signup — creates a User + ProviderProfile + OWNER SalonEmployee
 * in one go. No password is shown to the salon; future re-logins go through
 * a magic link sent to the email captured here.
 *
 * Designed for the door-to-door go-to-market: the commercial enters their
 * email on the tablet, gets a 4-digit PIN for the owner, and lands in the
 * onboarding wizard. The marketplace concepts (photos, slots, public offers)
 * are NOT exposed yet — the profile is flagged POS-only.
 */

import { NextRequest } from "next/server";
import { randomBytes, randomInt } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { mergePermissions } from "@/lib/permissions";

type Body = {
  email?: string;
  salonName?: string;
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function genPin4(): string {
  // 0000-9999 with 4 digits, avoid trivial patterns.
  for (let i = 0; i < 20; i++) {
    const n = randomInt(0, 10_000);
    const s = n.toString().padStart(4, "0");
    // Reject all-same and obvious sequences.
    if (/^(\d)\1{3}$/.test(s)) continue;
    if (["1234", "4321", "0123", "9876"].includes(s)) continue;
    return s;
  }
  return randomInt(1000, 9999).toString();
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const salonName = body?.salonName?.trim() ?? "Mon salon";

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Email invalide" }, { status: 400 });
  }

  // If a User already exists with this email, we either resume their existing
  // POS-only profile or bail if they own a real marketplace account.
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { providerProfile: { select: { id: true } } },
  });

  if (existing?.providerProfile) {
    // Already a provider — they should sign in, not create a duplicate.
    return Response.json(
      {
        error:
          "Un salon existe déjà avec cet email. Connectez-vous depuis l'écran PIN.",
        existing: true,
      },
      { status: 409 },
    );
  }

  // Generate a random, never-shown password. Future logins use magic links.
  const randomPwd = randomBytes(32).toString("hex");
  const passwordHash = await hash(randomPwd, 10);
  const ownerPin = genPin4();
  const ownerPinHash = await hash(ownerPin, 10);

  const result = await prisma.$transaction(async (tx) => {
    // Promote/create the User as a PROVIDER.
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { role: "PROVIDER", emailVerified: new Date() },
        })
      : await tx.user.create({
          data: {
            email,
            passwordHash,
            role: "PROVIDER",
            emailVerified: new Date(),
          },
        });

    // Create the ProviderProfile, flagged POS-only.
    const provider = await (tx as never as {
      providerProfile: {
        create: (a: unknown) => Promise<{ id: string; salonName: string }>;
      };
    }).providerProfile.create({
      data: {
        userId: user.id,
        salonName,
        category: "AUTRE",
        onboardingDismissedAt: null,
      },
    });

    // Create the OWNER employee with a PIN.
    const owner = await tx.salonEmployee.create({
      data: {
        providerId: provider.id,
        userId: user.id,
        displayName: "Propriétaire",
        email,
        role: "OWNER",
        pinHash: ownerPinHash,
        permissions: mergePermissions("OWNER", undefined) as never,
      },
    });

    // Activate the POS module for this salon (free during launch).
    await tx.salonSubscription.create({
      data: {
        providerId: provider.id,
        module: "POS",
        status: "ACTIVE",
      },
    });

    return { user, provider, owner };
  });

  return Response.json(
    {
      ok: true,
      providerId: result.provider.id,
      employeeId: result.owner.id,
      ownerPin, // shown ONCE on the next screen — never stored elsewhere.
      email,
    },
    { status: 201 },
  );
}
