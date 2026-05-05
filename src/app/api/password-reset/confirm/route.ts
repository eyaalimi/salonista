import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

// POST { token, password } — set a new password using a valid reset token.
export async function POST(req: NextRequest) {
  try {
    const { token, password } = (await req.json()) as {
      token?: string;
      password?: string;
    };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token et mot de passe requis" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mot de passe trop court (min. 6 caractères)" },
        { status: 400 }
      );
    }

    // Cast: prisma client locally hasn't been regenerated with the new fields yet;
    // production deploy runs `prisma generate` so types resolve correctly there.
    const user = (await prisma.user.findUnique({
      where: { passwordResetToken: token } as never,
    })) as
      | (Awaited<ReturnType<typeof prisma.user.findUnique>> & {
          passwordResetExpires: Date | null;
        })
      | null;
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        // The fact they received the email proves ownership — auto-verify.
        emailVerified: user.emailVerified ?? new Date(),
      } as never,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Password reset confirm error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
