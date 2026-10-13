/**
 * Le cockpit d'appels — l'ecran de travail d'une session de telephone.
 *
 * Il repond a trois questions, dans cet ordre : ou perd-on les salons
 * (l'entonnoir, en haut), qui appeler maintenant (la file, a gauche), et que
 * lui dire (la fiche, a droite).
 *
 * TOUT EST EN GET. Periode, marche, onglet et salon selectionne vivent dans
 * l'URL : on peut envoyer un lien a quelqu'un, revenir en arriere, et le
 * rechargement apres un compte rendu garde exactement la meme vue. Un etat
 * client aurait tout perdu a chaque `router.refresh()`.
 *
 * `exigerSuperadmin()` ici ET dans chaque route : le middleware ne lit qu'un
 * jeton, sans acces a la base, donc il ne peut pas verifier la 2FA.
 */

import Link from "next/link";
import { exigerSuperadmin, journaliser } from "@/lib/superadmin-session";
import { ACTIONS, VERIFICATIONS_IDENTITE } from "@/lib/support-salon";
import { ficheSalon } from "@/lib/support-donnees";
import {
  donneesCockpit,
  filtrerFile,
  FENETRE_SIGNAUX_JOURS,
  type Onglet,
  type SalonCockpit,
} from "@/lib/cockpit-appels-donnees";
import {
  LIBELLE_MARCHE,
  MARCHES,
  joursDepuis,
  questionsAPoser,
  type Marche,
} from "@/lib/cockpit-appels";
import { LIBELLE_RESULTAT, estResultatAppel } from "@/lib/compte-rendu-appel";
import {
  completionProfil,
  formaterTelephone,
  lienTelephone,
  afficher,
} from "@/lib/profil-salon-complet";
import { CompteRenduClient } from "./compte-rendu-client";
import { ActionsClient } from "../salons/[id]/actions-client";
import { Copiable } from "../salons/copiable";

export const metadata = { title: "Appels — Superadmin" };

const PERIODES = [7, 30, 90] as const;

const ONGLETS: Array<{ cle: Onglet; libelle: string }> = [
  { cle: "a-appeler", libelle: "À appeler" },
  { cle: "rappels", libelle: "Rappels" },
  { cle: "faits", libelle: "Faits aujourd'hui" },
];

function estMarche(v: string | undefined): v is Marche {
  return !!v && (MARCHES as readonly string[]).includes(v);
}

export default async function AppelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    jours?: string;
    marche?: string;
    onglet?: string;
    salon?: string;
  }>;
}) {
  const moi = await exigerSuperadmin();
  const params = await searchParams;

  const jours = PERIODES.includes(Number(params.jours) as never)
    ? Number(params.jours)
    : 30;
  const marche = estMarche(params.marche) ? params.marche : null;
  const onglet: Onglet = ONGLETS.some((o) => o.cle === params.onglet)
    ? (params.onglet as Onglet)
    : "a-appeler";

  const { entonnoir, file, totalInscrits } = await donneesCockpit(jours);
  const liste = filtrerFile(file, onglet, marche);

  // Le salon affiche : celui demande s'il est dans la file, sinon le premier.
  const choisi = params.salon
    ? (liste.find((s) => s.id === params.salon) ??
      file.find((s) => s.id === params.salon) ??
      null)
    : (liste[0] ?? null);

  const fiche = choisi ? await ficheSalon(choisi.id) : null;

  if (fiche) {
    // Consulter une fiche EST une action : elle expose le nom du gerant, son
    // e-mail et l'activite du salon. Meme trace que la fiche de support.
    await journaliser({
      acteur: moi,
      action: ACTIONS.FICHE_CONSULTEE,
      motif: "Consultation depuis le cockpit d'appels",
      targetProviderId: fiche.id,
      targetUserId: fiche.gerant?.id ?? null,
    }).catch(() => {});
  }

  const lien = (p: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    u.set("jours", String(p.jours ?? jours));
    if (p.marche ?? marche) u.set("marche", String(p.marche ?? marche));
    if (p.onglet ?? onglet) u.set("onglet", String(p.onglet ?? onglet));
    if (p.salon !== null && (p.salon ?? choisi?.id)) {
      u.set("salon", String(p.salon ?? choisi?.id));
    }
    return `/superadmin/appels?${u.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="ds-display text-2xl text-prune">Appels</h1>
          <p className="mt-1 text-sm text-prune-soft">
            {totalInscrits} salon(s) inscrits sur {jours} jours · signaux des{" "}
            {FENETRE_SIGNAUX_JOURS} derniers jours.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODES.map((p) => (
            <Link
              key={p}
              href={lien({ jours: p })}
              className={`ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border px-4 text-xs font-semibold ${
                jours === p
                  ? "border-prune bg-prune text-creme"
                  : "border-hairline bg-white text-prune-soft hover:text-prune"
              }`}
            >
              {p} jours
            </Link>
          ))}
        </div>
      </div>

      {/* L'entonnoir — defile horizontalement sur telephone. */}
      <section
        aria-label="Entonnoir d'activation"
        className="-mx-1 overflow-x-auto px-1 pb-1"
      >
        <ol className="flex min-w-max gap-2">
          {entonnoir.map((e) => {
            const actif = marche === e.marche;
            return (
              <li key={e.marche} className="min-w-[8.5rem] flex-1">
                <div
                  className={`flex h-full flex-col gap-1 rounded-[var(--radius-card)] border bg-white p-4 ${
                    e.plusGrossePerte ? "border-rose-fonce" : "border-hairline"
                  }`}
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-prune-soft">
                    {e.libelle}
                  </span>
                  <span className="ds-display text-2xl text-prune">{e.atteint}</span>
                  <span className="text-xs text-prune-soft">{e.pourcentage} % des inscrits</span>
                  {e.bloques > 0 ? (
                    <Link
                      href={lien({ marche: actif ? "" : e.marche, salon: null })}
                      className={`ds-focus mt-1 flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] border px-3 text-xs font-semibold ${
                        actif
                          ? "border-prune bg-prune text-creme"
                          : "border-hairline text-rose-fonce hover:border-rose-fonce"
                      }`}
                    >
                      {e.bloques} bloqué(s) ici
                    </Link>
                  ) : (
                    <span className="mt-1 flex min-h-[44px] items-center justify-center text-xs text-prune-soft">
                      —
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* La file d'appels */}
        <section aria-label="File d'appels" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {ONGLETS.map((o) => (
              <Link
                key={o.cle}
                href={lien({ onglet: o.cle, salon: null })}
                className={`ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border px-4 text-xs font-semibold ${
                  onglet === o.cle
                    ? "border-prune bg-prune text-creme"
                    : "border-hairline bg-white text-prune-soft hover:text-prune"
                }`}
              >
                {o.libelle}
              </Link>
            ))}
          </div>

          {marche && (
            <p className="text-xs text-prune-soft">
              Filtré sur « {LIBELLE_MARCHE[marche]} » ·{" "}
              <Link href={lien({ marche: "", salon: null })} className="underline">
                tout voir
              </Link>
            </p>
          )}

          {liste.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
              {onglet === "faits"
                ? "Aucun appel passé aujourd'hui."
                : onglet === "rappels"
                  ? "Aucun rappel prévu pour aujourd'hui."
                  : "Personne à appeler : tous les salons avancent."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {liste.map((s) => (
                <li key={s.id}>
                  <LigneFile
                    salon={s}
                    actif={choisi?.id === s.id}
                    href={lien({ salon: s.id })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* La fiche */}
        <section aria-label="Fiche du salon" className="flex flex-col gap-4">
          {!choisi || !fiche ? (
            <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
              Choisissez un salon dans la liste pour préparer l&apos;appel.
            </p>
          ) : (
            <Fiche salon={choisi} fiche={fiche} />
          )}
        </section>
      </div>
    </div>
  );
}

function LigneFile({
  salon,
  actif,
  href,
}: {
  salon: SalonCockpit;
  actif: boolean;
  href: string;
}) {
  const alerte = salon.securite.verrouillages > 0;
  return (
    <Link
      href={href}
      className={`ds-focus flex flex-col gap-1 rounded-[var(--radius-card)] border bg-white p-4 ${
        actif ? "border-prune" : "border-hairline hover:border-prune-soft"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-prune">{salon.salonName}</span>
        {salon.score !== null && (
          <span className="shrink-0 text-xs text-prune-soft">{salon.score}/100</span>
        )}
      </span>
      <span className="text-xs text-prune-soft">{salon.city ?? "Ville non renseignée"}</span>
      <span className="flex flex-wrap items-center gap-1.5 pt-1">
        {salon.marche && (
          <span className="rounded-[var(--radius-pill)] bg-creme px-2 py-0.5 text-xs font-semibold text-prune">
            {LIBELLE_MARCHE[salon.marche]}
          </span>
        )}
        {alerte && (
          <span className="rounded-[var(--radius-pill)] bg-rose-soft px-2 py-0.5 text-xs font-semibold text-prune">
            Employée bloquée
          </span>
        )}
        {salon.paniersAbandonnes > 0 && (
          <span className="rounded-[var(--radius-pill)] bg-creme px-2 py-0.5 text-xs text-prune-soft">
            {salon.paniersAbandonnes} panier(s) abandonné(s)
          </span>
        )}
      </span>
    </Link>
  );
}

function Fiche({
  salon,
  fiche,
}: {
  salon: SalonCockpit;
  fiche: NonNullable<Awaited<ReturnType<typeof ficheSalon>>>;
}) {
  const completion = completionProfil({
    city: fiche.city,
    governorate: fiche.governorate,
    address: fiche.address,
    phone: fiche.phone,
    matriculeFiscal: fiche.matriculeFiscal,
    nomGerant: fiche.gerant?.nom,
  });

  const horaires =
    !!salon.profil.openingHours &&
    typeof salon.profil.openingHours === "object" &&
    Object.keys(salon.profil.openingHours as Record<string, unknown>).length > 0;

  const questions = questionsAPoser({
    emailVerifie: salon.emailVerifie,
    horairesRenseignes: horaires,
    champsManquants: completion.manquants,
    employeeVerrouillee: salon.securite.verrouillages > 0,
    paniersAbandonnes: salon.paniersAbandonnes,
    ventesRefuseesTiroir: salon.ventesRefuseesTiroir,
    // Un tiroir ouvert mais aucune vente : le salon ne sait pas cloturer.
    tiroirJamaisCloture: false,
    catalogueVide: salon.nombreOffres === 0,
    servicesSansPhoto: 0,
  });

  const tel = lienTelephone(fiche.phone);
  const bloqueDepuis = joursDepuis(salon.inscritLe);

  return (
    <>
      {/* En-tete */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="ds-display text-xl text-prune">{fiche.salonName}</h2>
            <p className="mt-0.5 text-sm text-prune-soft">
              {afficher(fiche.city)} · inscrit il y a {bloqueDepuis} jour(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {salon.score !== null ? (
              <span className="rounded-[var(--radius-pill)] bg-creme px-3 py-1 text-sm font-semibold text-prune">
                {salon.score}/100
              </span>
            ) : (
              <span className="rounded-[var(--radius-pill)] bg-creme px-3 py-1 text-xs text-prune-soft">
                Suspendu
              </span>
            )}
            {tel && (
              <a
                href={tel}
                className="ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border border-prune px-4 text-sm font-semibold text-prune"
              >
                Appeler
              </a>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Ligne label="Téléphone">
            <span className="flex items-center gap-2">
              {formaterTelephone(fiche.phone)}
              {fiche.phone && <Copiable valeur={fiche.phone} />}
            </span>
          </Ligne>
          <Ligne label="E-mail du gérant">
            <span className="flex items-center gap-2">
              {afficher(fiche.gerant?.email)}
              {fiche.gerant?.email && <Copiable valeur={fiche.gerant.email} />}
            </span>
          </Ligne>
        </dl>

        {completion.manquants.length > 0 && (
          <p className="text-xs text-prune-soft">
            Profil complété à {completion.pourcentage} % — il manque{" "}
            {completion.manquants.join(", ")}.
          </p>
        )}

        <Link
          href={`/superadmin/salons/${fiche.id}`}
          className="ds-focus text-sm font-semibold text-rose-fonce underline underline-offset-2"
        >
          Voir la fiche complète
        </Link>
      </div>

      {/* Les questions a poser */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <h3 className="text-sm font-semibold text-prune">À demander pendant l&apos;appel</h3>
          <ol className="flex flex-col gap-3">
            {questions.map((q) => (
              <li key={q.question} className="flex flex-col gap-0.5">
                <span className="text-sm text-prune">« {q.question} »</span>
                <span className="text-xs text-prune-soft">{q.parceQue}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Securite et actions */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
        <h3 className="text-sm font-semibold text-prune">Connexions et sécurité</h3>
        <dl className="grid grid-cols-2 gap-2">
          <Ligne label="Mots de passe refusés">{salon.securite.mdpIncorrects}</Ligne>
          <Ligne label="PIN refusés">{salon.securite.pinIncorrects}</Ligne>
          <Ligne label="Verrouillages">{salon.securite.verrouillages}</Ligne>
          <Ligne label="Ventes refusées (tiroir)">{salon.ventesRefuseesTiroir}</Ligne>
        </dl>
        <ul className="flex flex-col gap-1 border-t border-hairline pt-3">
          {VERIFICATIONS_IDENTITE.map((v) => (
            <li key={v} className="text-xs text-prune-soft">
              {v}
            </li>
          ))}
        </ul>
        <ActionsClient salonId={fiche.id} suspendu={fiche.suspendedAt !== null} />
      </div>

      {/* Le compte rendu — la seule action rose de la page */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
        <h3 className="text-sm font-semibold text-prune">Compte rendu de l&apos;appel</h3>
        <CompteRenduClient salonId={fiche.id} />
      </div>

      {/* Les appels precedents */}
      {fiche.notes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <h3 className="text-sm font-semibold text-prune">Appels précédents</h3>
          <ul className="flex flex-col gap-3">
            {fiche.notes.map((n) => (
              <li key={n.id} className="flex flex-col gap-0.5 border-b border-hairline pb-2 last:border-0">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-prune-soft">
                    {n.createdAt.toLocaleDateString("fr-FR")} · {n.authorEmail}
                  </span>
                  {"resultat" in n && estResultatAppel(n.resultat) && (
                    <span className="rounded-[var(--radius-pill)] bg-creme px-2 py-0.5 text-xs font-semibold text-prune">
                      {LIBELLE_RESULTAT[n.resultat]}
                    </span>
                  )}
                </span>
                <span className="text-sm text-prune">{n.contenu}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-prune-soft">{label}</dt>
      <dd className="text-sm text-prune">{children}</dd>
    </div>
  );
}
