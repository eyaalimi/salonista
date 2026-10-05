/**
 * Enrolement de la double authentification d'un superadmin.
 *
 * POST sans corps : cree un secret et rend le QR a scanner.
 *
 * Le secret n'est PAS encore actif a ce stade : `totpConfirmedAt` reste nul
 * jusqu'a ce que /confirm recoive un premier code valide. Sans cette etape en
 * deux temps, un enrolement interrompu (QR ferme trop vite, telephone a plat)
 * laisserait le compte verrouille hors de son propre espace, sans recours
 * autre qu'un acces au serveur.
 *
 * Cette route NE PEUT PAS servir a s'octroyer un acces : elle exige deja le
 * role SUPERADMIN en base, que seul scripts/superadmin.ts attribue.
 */

import { getServerSession } from "next-auth";
import { toDataURL } from "qrcode";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creerSecretTotp } from "@/lib/superadmin-totp";
import { ROLE_SUPERADMIN } from "@/lib/superadmin-acces";

export async function POST() {
  /*
   * On n'utilise PAS `exigerSuperadmin()` ici : il exige une 2FA deja
   * confirmee, ce qui rendrait l'enrolement impossible. On refait donc le
   * controle a la main, en restant au plus strict — role SUPERADMIN lu en
   * BASE, jamais dans le jeton.
   */
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }

  const compte = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, totpConfirmedAt: true },
  });
  if (!compte || compte.role !== ROLE_SUPERADMIN) {
    return Response.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Deja enrole : on refuse de regenerer un secret. Sinon un acces vole
  // suffirait a remplacer le telephone du fondateur par le sien. Le
  // re-enrolement passe par `scripts/superadmin.ts reset-totp`.
  if (compte.totpConfirmedAt) {
    return Response.json(
      {
        error:
          "Double authentification déjà active. Pour la réinitialiser : npx tsx scripts/superadmin.ts reset-totp <email> --apply",
      },
      { status: 409 },
    );
  }

  const { secret, uri } = creerSecretTotp(compte.email);

  await prisma.user.update({
    where: { id: compte.id },
    data: {
      totpSecret: secret,
      totpConfirmedAt: null,
      totpLastUsedStep: null,
      totpFailedAttempts: 0,
      totpLockedUntil: null,
    },
  });

  /*
   * Le QR est rendu en data-URI. Le secret en clair l'accompagne UNIQUEMENT
   * ici, et uniquement parce qu'une saisie manuelle est le seul recours quand
   * l'appareil photo refuse de lire le QR. Aucune autre route ne le renvoie
   * jamais.
   */
  return Response.json({
    qr: await toDataURL(uri, { width: 320, margin: 1 }),
    secret,
  });
}
