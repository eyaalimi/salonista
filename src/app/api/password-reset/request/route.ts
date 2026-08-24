import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import { ipDe, reponseLimite, verifierLimite } from "@/lib/rate-limit";
import { LIMITE_RESET_MDP } from "@/lib/rate-limit-decision";

// POST { email } — generate a reset token and email it. Always returns 200 to avoid
// email enumeration; the user is told "if this email exists, a link was sent".
export async function POST(req: NextRequest) {
  try {
    // Chaque appel envoie un mail par Gmail, plafonne a ~500 par jour pour
    // tout le compte. Sans limite, une boucle sur cette route coupait TOUS
    // les mails de la plateforme pour la journee.
    const limite = await verifierLimite(
      `reset:ip:${ipDe(req)}`,
      LIMITE_RESET_MDP,
    );
    if (!limite.ok) return reponseLimite(limite);

    const { email } = (await req.json()) as { email?: string };
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = nanoid(32);
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      // Cast: prisma client locally hasn't been regenerated with the new fields yet;
      // production deploy runs `prisma generate` so types resolve correctly there.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires,
        } as never,
      });
      sendPasswordResetEmail(email, user.name || "", token).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Password reset request error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
