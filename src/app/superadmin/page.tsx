import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { prisma } from "@/lib/prisma";
import { vueDEnsemble } from "@/lib/vue-ensemble-donnees";
import { LIBELLE_RAISON, SEUIL_INACTIF_JOURS } from "@/lib/vue-ensemble";

/**
 * Vue d'ensemble — la premiere page que voit un fondateur.
 *
 * Elle repond a deux questions, dans cet ordre : « ou en est-on ? » et « qui
 * faut-il rappeler aujourd'hui ? ». La seconde est la plus utile au
 * lancement : un salon inscrit qui n'encaisse pas est un prospect qu'on peut
 * encore rattraper, pas une statistique.
 */
export default async function SuperadminAccueil() {
  // Troisieme garde : le layout a deja verifie, on revalide dans la page.
  const moi = await exigerSuperadmin();

  const [{ compteurs, aRappeler }, dernieres] = await Promise.all([
    vueDEnsemble(),
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
          {compteurs.total} salon{compteurs.total > 1 ? "s" : ""} inscrit
          {compteurs.total > 1 ? "s" : ""}
          {compteurs.suspendus > 0 && `, dont ${compteurs.suspendus} suspendu(s)`}.
        </p>
      </div>

      {/* L'activite */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">Activité</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Carte titre="Actifs aujourd'hui" valeur={compteurs.actifsAujourdhui} />
          <Carte titre="Actifs sur 7 jours" valeur={compteurs.actifs7j} />
          <Carte titre="Actifs sur 30 jours" valeur={compteurs.actifs30j} />
          <Carte titre="Nouveaux cette semaine" valeur={compteurs.nouveauxCetteSemaine} />
        </div>
        <p className="text-xs text-prune-soft">
          Un salon est compté actif s&apos;il a encaissé une vente ou si
          quelqu&apos;un de son équipe s&apos;est connecté sur la période.
        </p>
      </section>

      {/* Ce qui demande une action */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">À rattraper</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Carte
            titre="Inscrits, jamais encaissé"
            valeur={compteurs.jamaisVendu}
            alerte={compteurs.jamaisVendu > 0}
          />
          <Carte
            titre={`Sans vente depuis ${SEUIL_INACTIF_JOURS} jours`}
            valeur={compteurs.devenusInactifs}
            alerte={compteurs.devenusInactifs > 0}
          />
        </div>
      </section>

      {/* La liste d'appels */}
      <section className="flex flex-col gap-3">
        <h2 className="ds-display text-lg text-prune">
          À rappeler{" "}
          <span className="text-sm text-prune-soft">({aRappeler.length})</span>
        </h2>

        {aRappeler.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
            Personne à rappeler : tous les salons inscrits encaissent.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left">
                    <Th>Salon</Th>
                    <Th>Ville</Th>
                    <Th>Inscrit le</Th>
                    <Th>Raison</Th>
                    <Th>Dernière vente</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {aRappeler.map((s) => (
                    <tr key={s.id} className="border-b border-hairline last:border-0">
                      <Td>
                        <span className="font-semibold text-prune">{s.salonName}</span>
                      </Td>
                      <Td>{s.city ?? "—"}</Td>
                      <Td>{s.inscritLe.toLocaleDateString("fr-FR")}</Td>
                      <Td>
                        <span
                          className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold ${
                            s.raison === "jamais-vendu"
                              ? "bg-rose-soft text-prune"
                              : "bg-creme text-prune-soft"
                          }`}
                        >
                          {LIBELLE_RAISON[s.raison]}
                        </span>
                      </Td>
                      <Td>
                        {s.joursSansVente === null
                          ? "Aucune"
                          : `il y a ${s.joursSansVente} j`}
                      </Td>
                      <Td>
                        <Link
                          href={`/superadmin/salons/${s.id}`}
                          className="ds-focus font-semibold text-rose-fonce underline underline-offset-2"
                        >
                          Ouvrir
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-prune-soft">
              Les plus récents d&apos;abord : un salon inscrit il y a trois
              jours se rattrape d&apos;un appel, celui d&apos;il y a six mois
              beaucoup moins.
            </p>
          </>
        )}
      </section>

      {/* Le journal */}
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

function Carte({
  titre,
  valeur,
  alerte = false,
}: {
  titre: string;
  valeur: number;
  alerte?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border px-5 py-4 ${
        // Le fond rose ne s'allume QUE si le chiffre est non nul : une alerte
        // permanente cesse d'etre une alerte.
        alerte ? "border-rose bg-rose-soft" : "border-hairline bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-prune-soft">
        {titre}
      </p>
      <p className="ds-display mt-2 text-3xl text-prune">{valeur}</p>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-prune-soft">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 align-top text-prune-soft">{children}</td>
  );
}
