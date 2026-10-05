import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifierAccesSuperadmin } from "@/lib/superadmin-acces";

export const metadata = {
  title: "Superadmin — Salonista",
};

/**
 * Enveloppe de l'espace superadmin.
 *
 * DEUXIEME des trois gardes. Le middleware a deja ecarte les mauvais roles,
 * mais il ne verifie PAS la double authentification : il ne lit qu'un jeton,
 * sans acces a la base. C'est donc ici que la 2FA et sa fraicheur sont
 * controlees, et dans chaque route API pour les ecritures.
 *
 * Contrairement a l'espace /admin — qui ne se protege que par le middleware —
 * chaque page de /superadmin passe par ce layout, et chaque action sensible
 * rappelle `exigerSuperadmin()`.
 */
export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const compte = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          email: true,
          role: true,
          totpConfirmedAt: true,
          totpLockedUntil: true,
        },
      })
    : null;

  const verdict = verifierAccesSuperadmin({
    connecte: !!session?.user && !!compte,
    role: compte?.role ?? null,
    totpConfirme: !!compte?.totpConfirmedAt,
    totpValideeA: session?.totpValideeA ?? null,
    verrouJusqua: compte?.totpLockedUntil?.getTime() ?? null,
  });

  /*
   * Un mauvais role repart vers /login sans rien apprendre. Les autres refus
   * concernent un VRAI superadmin : on l'oriente vers /superadmin-acces.
   *
   * CETTE PAGE EST HORS DE /superadmin, deliberement. Un enfant ne peut pas
   * se soustraire au layout de son parent en App Router : la placer sous
   * /superadmin/acces ferait boucler la redirection a l'infini, puisque ce
   * layout-ci s'executerait avant elle et redirigerait de nouveau.
   */
  if (!verdict.ok) {
    if (verdict.raison === "non-connecte" || verdict.raison === "mauvais-role") {
      redirect("/login");
    }
    redirect("/superadmin-acces");
  }

  return (
    <div className="min-h-screen bg-creme">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/superadmin" className="ds-display text-xl text-prune">
              Salonista<span className="text-rose-fonce">.</span>
            </Link>
            <span className="rounded-[var(--radius-pill)] bg-prune px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-creme">
              Superadmin
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/superadmin" className="ds-focus text-prune-soft hover:text-prune">
              Vue d&apos;ensemble
            </Link>
            <Link
              href="/superadmin/campagnes"
              className="ds-focus text-prune-soft hover:text-prune"
            >
              Campagnes
            </Link>
            <Link
              href="/superadmin/journal"
              className="ds-focus text-prune-soft hover:text-prune"
            >
              Journal
            </Link>
            <span className="text-xs text-prune-soft">{compte?.email}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-5 py-8">{children}</main>
    </div>
  );
}
