import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { prisma } from "@/lib/prisma";

/**
 * Accueil de l'espace superadmin.
 *
 * Phase 1 : il ne porte que ce que la phase 1 sait produire — l'etat des
 * acces et les dernieres lignes du journal. Les indicateurs d'activite des
 * salons arrivent en phase 4, ceux des campagnes en phase 2. Afficher des
 * cases vides en attendant donnerait l'impression d'un produit casse.
 */
export default async function SuperadminAccueil() {
  // TROISIEME garde : le layout a deja verifie, on revalide dans la page.
  // Une page qui ne verifie pas elle-meme devient accessible si quelqu'un la
  // deplace hors du layout.
  const moi = await exigerSuperadmin();

  const [nbSuperadmins, nbSalons, nbActions, dernieres] = await Promise.all([
    prisma.user.count({ where: { role: "SUPERADMIN" } }),
    prisma.providerProfile.count(),
    prisma.superadminAuditLog.count(),
    prisma.superadminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        motif: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="ds-display text-2xl text-prune">
          Bonjour {moi.name ?? moi.email}
        </h1>
        <p className="mt-1 text-sm text-prune-soft">
          Phase 1 : accès et journal. Le suivi des campagnes et le support
          arrivent dans les phases suivantes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Carte titre="Salons inscrits" valeur={String(nbSalons)} />
        <Carte titre="Comptes superadmin" valeur={String(nbSuperadmins)} />
        <Carte titre="Actions journalisées" valeur={String(nbActions)} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="ds-display text-lg text-prune">Dernières actions</h2>
          <Link
            href="/superadmin/journal"
            className="ds-focus text-sm font-semibold text-rose-fonce underline underline-offset-2"
          >
            Tout le journal
          </Link>
        </div>

        {dernieres.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
            Aucune action enregistrée pour l&apos;instant.
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-white">
            {dernieres.map((l) => (
              <li key={l.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-prune">
                    {l.action}
                  </span>
                  <span className="text-xs text-prune-soft">
                    {l.createdAt.toLocaleString("fr-FR")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-prune-soft">{l.motif}</p>
                <p className="mt-0.5 text-xs text-prune-soft">{l.actorEmail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Carte({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
        {titre}
      </p>
      <p className="ds-display mt-2 text-3xl text-prune">{valeur}</p>
    </div>
  );
}
