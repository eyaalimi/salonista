import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  verifierAccesSuperadmin,
  ROLE_SUPERADMIN,
} from "@/lib/superadmin-acces";
import { AccesClient } from "./acces-client";

export const metadata = {
  title: "Vérification — Superadmin",
  // Cette page ne doit jamais apparaitre dans un moteur de recherche.
  robots: { index: false, follow: false },
};

/**
 * Enrolement et validation de la 2FA. HORS du layout /superadmin, a dessein :
 * ce layout redirige ici quand la 2FA manque, et un enfant ne peut pas se
 * soustraire au layout de son parent — la redirection boucleraient.
 *
 * La page reste protegee : le middleware exige le role SUPERADMIN sur tout
 * chemin commencant par « /superadmin », ce prefixe inclus, et ce composant
 * revalide le role en BASE avant d'afficher quoi que ce soit.
 */
export default async function SuperadminAccesPage() {
  const session = await getServerSession(authOptions);

  const compte = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, totpConfirmedAt: true, totpLockedUntil: true },
      })
    : null;

  // Defense en profondeur : le middleware a deja filtre, on revalide ici.
  if (!compte || compte.role !== ROLE_SUPERADMIN) redirect("/login");

  // Deja en regle ? Ne pas redemander un code pour rien.
  const verdict = verifierAccesSuperadmin({
    connecte: true,
    role: compte.role,
    totpConfirme: !!compte.totpConfirmedAt,
    totpValideeA: session?.totpValideeA ?? null,
    verrouJusqua: compte.totpLockedUntil?.getTime() ?? null,
  });
  if (verdict.ok) redirect("/superadmin");

  return <AccesClient dejaEnrole={!!compte.totpConfirmedAt} />;
}
