import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { prisma } from "@/lib/prisma";
import {
  comparerCampagnes,
  courbeJournaliere,
  derniersJours,
  entonnoir,
  salonsInscrits,
} from "@/lib/campagne-donnees";
import { LIBELLE_STATUT } from "@/lib/campagne-tableau";

/** Periodes proposees. 30 jours par defaut : une campagne se juge sur un mois. */
const PERIODES = [7, 30, 90] as const;

function dinars(millimes: number | null): string {
  if (millimes === null) return "—";
  return `${(millimes / 1000).toFixed(3)} DT`;
}

export default async function CampagnesPage({
  searchParams,
}: {
  searchParams: Promise<{ jours?: string; campagne?: string }>;
}) {
  await exigerSuperadmin();
  const { jours, campagne } = await searchParams;

  const nbJours = PERIODES.includes(Number(jours) as never) ? Number(jours) : 30;
  const periode = derniersJours(nbJours);
  const campaignId = campagne || null;

  const [lignes, campagnes, courbe, salons, toutes] = await Promise.all([
    entonnoir(periode, campaignId),
    comparerCampagnes(periode),
    courbeJournaliere(periode, campaignId),
    salonsInscrits(campaignId),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { startsAt: "desc" } }),
  ]);

  const maxCourbe = Math.max(1, ...courbe.map((p) => p.clics));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="ds-display text-2xl text-prune">Campagnes</h1>
          <p className="mt-1 text-sm text-prune-soft">
            Du {periode.depuis.toLocaleDateString("fr-FR")} à aujourd&apos;hui.
          </p>
        </div>
        <a
          href={`/superadmin/campagnes/export.csv?jours=${nbJours}${campaignId ? `&campagne=${campaignId}` : ""}`}
          className="ds-focus rounded-[var(--radius-pill)] border border-hairline bg-white px-4 py-2 text-sm font-semibold text-prune hover:bg-creme"
        >
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {PERIODES.map((p) => (
          <Filtre
            key={p}
            href={`/superadmin/campagnes?jours=${p}${campaignId ? `&campagne=${campaignId}` : ""}`}
            actif={nbJours === p}
          >
            {p} jours
          </Filtre>
        ))}
        {toutes.length > 0 && (
          <>
            <span className="mx-1 h-4 w-px bg-hairline" />
            <Filtre href={`/superadmin/campagnes?jours=${nbJours}`} actif={!campaignId}>
              Toutes
            </Filtre>
            {toutes.map((c) => (
              <Filtre
                key={c.id}
                href={`/superadmin/campagnes?jours=${nbJours}&campagne=${c.id}`}
                actif={campaignId === c.id}
              >
                {c.name}
              </Filtre>
            ))}
          </>
        )}
      </div>

      {/* L'entonnoir */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">Entonnoir</h2>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-white">
          {lignes.map((l) => (
            <div
              key={l.etape}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline px-5 py-3 last:border-0"
            >
              <span className="min-w-[180px] flex-1 text-sm text-prune-soft">{l.libelle}</span>
              <span className="ds-display min-w-[70px] text-xl text-prune">{l.nombre}</span>
              <span className="min-w-[110px] text-xs text-prune-soft">
                {l.tauxDepuisPrecedente === null
                  ? ""
                  : `${l.tauxDepuisPrecedente} % de l'étape précédente`}
              </span>
              {/* Barre proportionnelle au taux depuis le debut. */}
              <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-creme">
                <span
                  className="block h-full bg-rose-fonce"
                  style={{ width: `${Math.min(100, l.tauxDepuisDebut ?? 0)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-prune-soft">
          Les visiteurs sont dédupliqués : trois clics d&apos;une même personne
          comptent pour un. Les installations ne remontent pas depuis un iPhone
          — l&apos;événement n&apos;existe pas sur Safari iOS.
        </p>
      </section>

      {/* Comparaison des campagnes */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">Comparaison</h2>
        {campagnes.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
            Aucune campagne. Crée-en une avec{" "}
            <code className="font-mono text-xs">npx tsx scripts/campagne.ts</code>.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <Th>Campagne</Th>
                  <Th>Canal</Th>
                  <Th>Lien</Th>
                  <Th>Clics</Th>
                  <Th>Visiteurs</Th>
                  <Th>Inscrits</Th>
                  <Th>Budget</Th>
                  <Th>Coût / inscrit</Th>
                </tr>
              </thead>
              <tbody>
                {campagnes.map((c) => (
                  <tr key={c.id} className="border-b border-hairline last:border-0">
                    <Td>{c.name}</Td>
                    <Td>{c.channel}</Td>
                    <Td>
                      <code className="font-mono text-xs text-prune-soft">/c/{c.slug}</code>
                    </Td>
                    <Td>{c.clics}</Td>
                    <Td>{c.visiteurs}</Td>
                    <Td>{c.inscriptions}</Td>
                    <Td>{dinars(c.budgetMillimes)}</Td>
                    <Td>{dinars(c.coutParInscriptionMillimes)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Courbe jour par jour */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">Jour par jour</h2>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-5">
          <div className="flex min-w-[520px] items-end gap-1" style={{ height: 140 }}>
            {courbe.map((p) => (
              <div key={p.jour} className="flex flex-1 flex-col items-center gap-1" title={`${p.jour} — ${p.clics} clic(s), ${p.inscriptions} inscrit(s)`}>
                <span
                  className="w-full rounded-t bg-rose-fonce"
                  style={{ height: `${(p.clics / maxCourbe) * 110}px`, minHeight: p.clics > 0 ? 2 : 0 }}
                />
                {p.inscriptions > 0 && (
                  <span
                    className="w-full rounded-t bg-prune"
                    style={{ height: `${Math.max(2, (p.inscriptions / maxCourbe) * 110)}px` }}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-4 text-xs text-prune-soft">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-fonce" /> Clics
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-prune" /> Inscriptions
            </span>
          </p>
        </div>
      </section>

      {/* Les salons */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">
          Salons inscrits <span className="text-sm text-prune-soft">({salons.length})</span>
        </h2>
        {salons.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
            Aucun salon pour ce filtre.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left">
                  <Th>Salon</Th>
                  <Th>Ville</Th>
                  <Th>Inscrit le</Th>
                  <Th>Origine</Th>
                  <Th>Statut</Th>
                  <Th>Dernière vente</Th>
                </tr>
              </thead>
              <tbody>
                {salons.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <Td>{s.salonName}</Td>
                    <Td>{s.city ?? "—"}</Td>
                    <Td>{s.createdAt.toLocaleDateString("fr-FR")}</Td>
                    <Td>{s.campagne ?? s.utmSource ?? "—"}</Td>
                    <Td>
                      <span
                        className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold ${
                          s.statut === "actif"
                            ? "bg-menthe text-prune"
                            : s.statut === "jamais-vendu"
                              ? "bg-rose-soft text-prune"
                              : "bg-creme text-prune-soft"
                        }`}
                      >
                        {LIBELLE_STATUT[s.statut]}
                      </span>
                    </Td>
                    <Td>
                      {s.joursDepuisDerniereVente === null
                        ? "—"
                        : s.joursDepuisDerniereVente === 0
                          ? "aujourd'hui"
                          : `il y a ${s.joursDepuisDerniereVente} j`}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Filtre({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-prune-soft">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 align-top text-prune-soft">{children}</td>;
}
