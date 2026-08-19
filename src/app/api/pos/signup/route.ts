/**
 * POS signup — creates a User + ProviderProfile + OWNER SalonEmployee in one go.
 *
 * Le salon choisit son mot de passe ici meme. Il obtient donc deux acces avec
 * les memes identifiants qu'il vient de saisir :
 *   - la caisse sur la tablette, via son code PIN a 4 chiffres ;
 *   - son espace Salonista dans un navigateur, via email + mot de passe.
 *
 * (Une version precedente generait un mot de passe aleatoire jamais montre,
 * en promettant un « magic link » qui n'a jamais existe : le salon ne pouvait
 * alors plus jamais se connecter ailleurs que sur la tablette.)
 *
 * Designed for the door-to-door go-to-market: the commercial enters their
 * email on the tablet, gets a 4-digit PIN for the owner, and lands in the
 * onboarding wizard. The marketplace concepts (photos, slots, public offers)
 * are NOT exposed yet — the profile is flagged POS-only.
 */

import { NextRequest } from "next/server";
import { randomInt } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { mergePermissions } from "@/lib/permissions";

/** Meme minimum que la reinitialisation de mot de passe, pour rester coherent. */
const MIN_PASSWORD_LENGTH = 6;

type Body = {
  email?: string;
  salonName?: string;
  password?: string;
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
  const password = body?.password ?? "";

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Email invalide" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return Response.json(
      { error: `Mot de passe trop court (min. ${MIN_PASSWORD_LENGTH} caractères)` },
      { status: 400 },
    );
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

  // Le mot de passe choisi par le salon : c'est celui qu'il utilisera pour se
  // connecter sur salonista.tn. Cout 12, comme la reinitialisation.
  const passwordHash = await hash(password, 12);
  const ownerPin = genPin4();
  const ownerPinHash = await hash(ownerPin, 10);

  const result = await prisma.$transaction(async (tx) => {
    // Promote/create the User as a PROVIDER.
    // Le mot de passe est pose dans les deux cas : un compte existant promu en
    // salon doit pouvoir se connecter avec ce qu'il vient de saisir, pas avec
    // un ancien mot de passe qu'il ne se rappelle peut-etre plus.
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { role: "PROVIDER", emailVerified: new Date(), passwordHash },
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
