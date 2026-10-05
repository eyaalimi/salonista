import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { prisma } from "@/lib/prisma";

/**
 * Le journal d'audit — consultable et filtrable, EN LECTURE SEULE.
 *
 * Aucun bouton de suppression, aucune route PATCH ni DELETE n'existe. Un
 * journal qu'on peut nettoyer ne vaut rien le jour ou il faut comprendre ce
 * qui s'est passe.
 *
 * Filtres par parametres d'URL plutot que par etat client : la vue est ainsi
 * partageable par simple copie du lien, et la page reste un server component
 * conformement a la convention du projet.
 */

const PAR_PAGE = 50;

export default async function JournalPage({
  searchParams,
}: {
  // En Next 16, `searchParams` est une PROMESSE.
  searchParams: Promise<{ action?: string; acteur?: string; page?: string }>;
}) {
  await exigerSuperadmin();
  const { action, acteur, page } = await searchParams;

  const pageNum = Math.max(1, Number(page) || 1);

  const filtre = {
    ...(action ? { action } : {}),
    ...(acteur ? { actorEmail: acteur } : {}),
  };

  const [lignes, total, actions, acteurs] = await Promise.all([
    prisma.superadminAuditLog.findMany({
      where: filtre,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * PAR_PAGE,
      take: PAR_PAGE,
    }),
    prisma.superadminAuditLog.count({ where: filtre }),
    // Les valeurs disponibles pour les filtres, tirees du journal lui-meme :
    // une liste figee se desynchroniserait a la premiere action nouvelle.
    prisma.superadminAuditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.superadminAuditLog.findMany({
      distinct: ["actorEmail"],
      select: { actorEmail: true },
      orderBy: { actorEmail: "asc" },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="ds-display text-2xl text-prune">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-prune-soft">
          {total} action{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}.
          Lecture seule — aucune ligne ne peut être modifiée ni supprimée.
        </p>
      </div>

      {(actions.length > 0 || acteurs.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Filtre href="/superadmin/journal" actif={!action && !acteur}>
            Tout
          </Filtre>
          {actions.map((a) => (
            <Filtre
              key={a.action}
              href={`/superadmin/journal?action=${encodeURIComponent(a.action)}`}
              actif={action === a.action}
            >
              {a.action}
            </Filtre>
          ))}
          {acteurs.length > 1 &&
            acteurs.map((a) => (
              <Filtre
                key={a.actorEmail}
                href={`/superadmin/journal?acteur=${encodeURIComponent(a.actorEmail)}`}
                actif={acteur === a.actorEmail}
              >
                {a.actorEmail}
              </Filtre>
            ))}
        </div>
      )}

      {lignes.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
          Aucune action ne correspond.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left">
                <Th>Quand</Th>
                <Th>Qui</Th>
                <Th>Quoi</Th>
                <Th>Cible</Th>
                <Th>Motif</Th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-hairline last:border-0">
                  <Td>
                    <span className="whitespace-nowrap text-xs text-prune-soft">
                      {l.createdAt.toLocaleString("fr-FR")}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-prune-soft">{l.actorEmail}</span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs font-semibold text-prune">
                      {l.action}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-prune-soft">
                      {l.targetProviderId ?? l.targetUserId ?? "—"}
                    </span>
                  </Td>
                  <Td>{l.motif}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pageNum > 1 && (
            <PageLien
              action={action}
              acteur={acteur}
              page={pageNum - 1}
              libelle="← Précédent"
            />
          )}
          <span className="text-prune-soft">
            Page {pageNum} sur {pages}
          </span>
          {pageNum < pages && (
            <PageLien
              action={action}
              acteur={acteur}
              page={pageNum + 1}
              libelle="Suivant →"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Filtre({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`ds-focus rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-semibold ${
        actif
          ? "border-prune bg-prune text-creme"
          : "border-hairline bg-white text-prune-soft hover:text-prune"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLien({
  action,
  acteur,
  page,
  libelle,
}: {
  action?: string;
  acteur?: string;
  page: number;
  libelle: string;
}) {
  const p = new URLSearchParams();
  if (action) p.set("action", action);
  if (acteur) p.set("acteur", acteur);
  p.set("page", String(page));
  return (
    <Link
      href={`/superadmin/journal?${p.toString()}`}
      className="ds-focus font-semibold text-rose-fonce underline underline-offset-2"
    >
      {libelle}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-prune-soft">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top text-prune-soft">{children}</td>;
}
