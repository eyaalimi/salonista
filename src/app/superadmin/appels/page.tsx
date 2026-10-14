/**
 * Le cockpit d'appels — l'ecran de travail d'une session de telephone.
 *
 * Trois zones : l'entonnoir en haut (ou perd-on les salons), la file a gauche
 * (qui appeler), la fiche a droite (quoi lui dire). TOUT passe par l'URL
 * (`?jours=&marche=&onglet=&salon=`) : on peut envoyer un lien, revenir en
 * arriere, et le rechargement apres un compte rendu garde la meme vue.
 *
 * LA FICHE EST COMPLETE, EXPRES. La version precedente renvoyait vers « voir
 * la fiche complete » pour la moitie des informations — un lien qu'on ne suit
 * pas avec une gerante au telephone. Le lien reste, en secondaire.
 *
 * `exigerSuperadmin()` ici ET dans chaque route : le middleware ne lit qu'un
 * jeton, sans acces a la base, donc il ne peut pas verifier la 2FA.
 */

import Link from "next/link";
import { exigerSuperadmin, journaliser } from "@/lib/superadmin-session";
import { ACTIONS } from "@/lib/support-salon";
import { ficheSalon } from "@/lib/support-donnees";
import { ficheAppel } from "@/lib/fiche-appel-donnees";
import {
  donneesCockpit,
  filtrerFile,
  type Onglet,
} from "@/lib/cockpit-appels-donnees";
import {
  MARCHES,
  libelleScore,
  parcoursActivation,
  questionsAPoser,
  type Marche,
} from "@/lib/cockpit-appels";
import { LIBELLE_RESULTAT, estResultatAppel } from "@/lib/compte-rendu-appel";
import { completionProfil, formaterTelephone, lienTelephone } from "@/lib/profil-salon-complet";
import { accord, dateCourte, dateRelative, motAccorde } from "@/lib/format-fr";
import { CompteRenduClient } from "./compte-rendu-client";
import { ActionsClient } from "../salons/[id]/actions-client";
import { Copiable } from "../salons/copiable";
import { Entonnoir } from "./entonnoir";
import { FileAppels } from "./file-appels";
import {
  Bloc,
  BlocActivite,
  BlocCaisse,
  BlocChamps,
  BlocParcours,
  BlocQuestions,
  BlocSecurite,
} from "./fiche-blocs";

export const metadata = { title: "Appels — Superadmin" };

const PERIODES = [7, 30, 90] as const;

/** Les actions utiles PENDANT un appel. Les autres sont repliees. */
const ACTIONS_APPEL = ["reinitialiser-pin", "debloquer", "fermer-sessions"] as const;
const ACTIONS_AUTRES = [
  "lien-reset",
  "mot-de-passe-temporaire",
  "suspendre",
  "reactiver",
] as const;

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

  const jours = PERIODES.includes(Number(params.jours) as never) ? Number(params.jours) : 30;
  const marche = estMarche(params.marche) ? params.marche : null;
  const onglet: Onglet = (["a-appeler", "rappels", "faits"] as const).includes(
    params.onglet as Onglet,
  )
    ? (params.onglet as Onglet)
    : "a-appeler";

  const { entonnoir, file, totalInscrits, onglets } = await donneesCockpit(jours);
  const liste = filtrerFile(file, onglet, marche);

  const choisi = params.salon
    ? (liste.find((s) => s.id === params.salon) ??
      file.find((s) => s.id === params.salon) ??
      null)
    : (liste[0] ?? null);

  const [fiche, detail] = choisi
    ? await Promise.all([ficheSalon(choisi.id), ficheAppel(choisi.id)])
    : [null, null];

  if (fiche) {
    // Consulter une fiche EST une action : elle expose le nom du gerant, son
    // e-mail et l'activite du salon.
    await journaliser({
      acteur: moi,
      action: ACTIONS.FICHE_CONSULTEE,
      motif: "Consultation depuis le cockpit d'appels",
      targetProviderId: fiche.id,
      targetUserId: fiche.gerant?.id ?? null,
    }).catch(() => {});
  }

  const lien = (p: {
    jours?: number;
    marche?: string;
    onglet?: string;
    salon?: string | null;
  }) => {
    const u = new URLSearchParams();
    u.set("jours", String(p.jours ?? jours));
    const m = p.marche !== undefined ? p.marche : (marche ?? "");
    if (m) u.set("marche", m);
    u.set("onglet", p.onglet ?? onglet);
    const s = p.salon !== undefined ? p.salon : choisi?.id;
    if (s) u.set("salon", s);
    return `/superadmin/appels?${u.toString()}`;
  };

  const faits = onglets.faits;
  const aFaire = onglets.aAppeler + faits;
  const progression = aFaire === 0 ? 0 : Math.round((faits / aFaire) * 100);

  return (
    <div className="flex flex-col gap-5">
      {/* Session d'appels */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="ds-display text-2xl text-prune">Session d&apos;appels</h1>
          <p className="mt-0.5 text-sm text-prune-soft">
            {faits} {motAccorde(faits, "fait")} sur {aFaire} ·{" "}
            {accord(totalInscrits, "salon")} inscrits sur {jours} jours
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

      {/* Progression du jour */}
      <div
        aria-label={`Progression : ${faits} sur ${aFaire}`}
        className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-hairline"
      >
        <div
          className="h-full rounded-[var(--radius-pill)] bg-prune"
          style={{ width: `${progression}%` }}
        />
      </div>

      <Entonnoir
        lignes={entonnoir}
        marcheActive={marche}
        lien={(m) => lien({ marche: m, salon: null })}
      />

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[21rem_1fr] lg:items-start">
        {/* La file */}
        <section aria-label="File d'appels" className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["a-appeler", "À appeler", onglets.aAppeler],
                ["rappels", "Rappels", onglets.rappels],
                ["faits", "Faits", onglets.faits],
              ] as const
            ).map(([cle, libelle, n]) => (
              <Link
                key={cle}
                href={lien({ onglet: cle, salon: null })}
                className={`ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border px-4 text-xs font-semibold ${
                  onglet === cle
                    ? "border-prune bg-prune text-creme"
                    : "border-hairline bg-white text-prune-soft hover:text-prune"
                }`}
              >
                {libelle} · {n}
              </Link>
            ))}
          </div>

          {marche && (
            <p className="text-xs text-prune-soft">
              Filtré sur les salons bloqués ici ·{" "}
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
            <FileAppels
              salons={liste}
              choisi={choisi?.id ?? null}
              lien={(id) => lien({ salon: id })}
            />
          )}

          <p className="text-[11px] leading-relaxed text-prune-soft">
            Ordre : alertes de sécurité d&apos;abord, puis les inscriptions les
            plus récentes, puis les plus proches de la 1re vente. Les salons
            suspendus n&apos;y figurent pas.
          </p>
        </section>

        {/* La fiche */}
        <section aria-label="Fiche du salon" className="flex flex-col gap-4">
          {!choisi || !fiche || !detail ? (
            <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
              Choisissez un salon dans la liste pour préparer l&apos;appel.
            </p>
          ) : (
            (() => {
              const completion = completionProfil({
                city: fiche.city,
                governorate: fiche.governorate,
                address: fiche.address,
                phone: fiche.phone,
                matriculeFiscal: fiche.matriculeFiscal,
                nomGerant: fiche.gerant?.nom,
              });

              const horaires =
                !!choisi.profil.openingHours &&
                typeof choisi.profil.openingHours === "object" &&
                Object.keys(choisi.profil.openingHours as Record<string, unknown>).length > 0;

              const etapes = parcoursActivation({
                ...choisi,
                emailVerifieLe: detail.emailVerifieLe,
                profilPretLe: null,
                cataloguePretLe: detail.cataloguePretLe,
                equipeAuDela: detail.equipeAuDela,
                equipeLe: detail.equipeLe,
                appInstallee: detail.appInstallee,
                appInstalleeLe: detail.appInstalleeLe,
                tiroirOuvertLe: detail.tiroirOuvertLe,
              });

              const questions = questionsAPoser({
                emailVerifie: choisi.emailVerifie,
                horairesRenseignes: horaires,
                champsManquants: completion.manquants,
                employeeVerrouillee: detail.employes.some((e) => e.verrouilleJusqua !== null),
                paniersAbandonnes: choisi.paniersAbandonnes,
                ventesRefuseesTiroir: choisi.ventesRefuseesTiroir,
                tiroirJamaisCloture:
                  detail.tiroirOuvertLe !== null && detail.rapportsZ === 0,
                catalogueVide: detail.servicesTotal === 0,
                servicesSansPhoto: detail.servicesSansPhoto,
              });

              const tel = lienTelephone(fiche.phone);

              return (
                <>
                  {/* En-tete */}
                  <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {fiche.suspendedAt && (
                            <Badge ton="alerte">Suspendu</Badge>
                          )}
                          <Badge ton={detail.ventesEncaissees > 0 ? "ok" : "neutre"}>
                            {detail.ventesEncaissees > 0 ? "Caisse activée" : "Caisse inactive"}
                          </Badge>
                          {fiche.campagne && <Badge ton="neutre">{fiche.campagne}</Badge>}
                          {!fiche.campagne && fiche.utmSource && (
                            <Badge ton="neutre">{fiche.utmSource}</Badge>
                          )}
                        </div>
                        <h2 className="ds-display mt-1.5 text-xl text-prune">
                          {fiche.salonName}
                        </h2>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {choisi.score !== null ? (
                          <div className="text-right">
                            <span className="ds-display text-2xl text-prune">
                              {choisi.score}
                              <span className="text-sm text-prune-soft">/100</span>
                            </span>
                            <p className="text-xs text-prune-soft">
                              {libelleScore(choisi.score)}
                            </p>
                            <span
                              aria-hidden
                              className="mt-1 block h-1.5 w-28 overflow-hidden rounded-[var(--radius-pill)] bg-hairline"
                            >
                              <span
                                className={`block h-full rounded-[var(--radius-pill)] ${
                                  choisi.score >= 60 ? "bg-menthe-deep" : "bg-rose-fonce"
                                }`}
                                style={{ width: `${choisi.score}%` }}
                              />
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-prune-soft">Suspendu</span>
                        )}
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                      <Champ label="Gérante">{fiche.gerant?.nom ?? "Non renseigné"}</Champ>
                      <Champ label="Téléphone">
                        {/* Une seule valeur : `Copiable` AFFICHE deja le
                            numero. L'afficher en plus le faisait apparaitre
                            deux fois, formate puis brut. */}
                        {fiche.phone ? (
                          <Copiable valeur={formaterTelephone(fiche.phone)} lien={tel ?? undefined} />
                        ) : (
                          "Non renseigné"
                        )}
                      </Champ>
                      <Champ label="E-mail">
                        {fiche.gerant?.email ? (
                          <Copiable
                            valeur={fiche.gerant.email}
                            lien={`mailto:${fiche.gerant.email}`}
                          />
                        ) : (
                          "Non renseigné"
                        )}
                      </Champ>
                      <Champ label="Ville">{fiche.city ?? "Non renseignée"}</Champ>
                      <Champ label="Inscrit">
                        {fiche.createdAt.toLocaleDateString("fr-FR")} ·{" "}
                        {dateRelative(fiche.createdAt)}
                      </Champ>
                      <Champ label="Équipe">
                        {detail.employes.map((e) => e.nom).join(", ") || "Aucune"}
                      </Champ>
                      <Champ label="Assistant">
                        {detail.assistant === null
                          ? "Jamais ouvert"
                          : detail.assistant.termine
                            ? `Terminé · ${dateCourte(detail.assistant.le)}`
                            : `${
                                detail.assistant.quitte ? "Quittée" : "Arrêtée"
                              } à l'étape ${detail.assistant.derniereEtape ?? "?"}${
                                detail.assistant.libelle
                                  ? ` · ${detail.assistant.libelle}`
                                  : ""
                              } · le ${dateCourte(detail.assistant.le)}`}
                      </Champ>
                      <Champ label="Dernier appel">
                        {detail.dernierAppelLe
                          ? `${dateRelative(detail.dernierAppelLe)}${
                              detail.dernierAppelResultat &&
                              estResultatAppel(detail.dernierAppelResultat)
                                ? ` · ${LIBELLE_RESULTAT[detail.dernierAppelResultat]}`
                                : ""
                            }`
                          : "Jamais appelé"}
                      </Champ>
                    </dl>

                    <div className="flex flex-wrap items-center gap-2">
                      {tel && (
                        <a
                          href={tel}
                          className="ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border border-prune px-5 text-sm font-semibold text-prune"
                        >
                          Appeler {fiche.gerant?.nom ?? fiche.salonName}
                        </a>
                      )}
                      <Link
                        href={`/superadmin/salons/${fiche.id}`}
                        className="ds-focus flex min-h-[44px] items-center rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-sm text-prune-soft hover:text-prune"
                      >
                        Voir la fiche complète
                      </Link>
                    </div>
                  </div>

                  <BlocParcours etapes={etapes} />

                  <div className="grid gap-4 xl:grid-cols-2">
                    <BlocChamps
                      champs={[
                        { libelle: "Adresse", valeur: fiche.address },
                        { libelle: "Ville", valeur: fiche.city },
                        {
                          libelle: "Photo du salon",
                          valeur:
                            choisi.profil.photos.length > 0
                              ? `${accord(choisi.profil.photos.length, "photo")}`
                              : null,
                        },
                        { libelle: "Nom de la gérante", valeur: fiche.gerant?.nom ?? null },
                        { libelle: "Gouvernorat", valeur: fiche.governorate },
                        { libelle: "Matricule fiscal", valeur: fiche.matriculeFiscal },
                      ]}
                      servicesTotal={detail.servicesTotal}
                      servicesSansPhoto={detail.servicesSansPhoto}
                    />
                    <BlocCaisse
                      fiche={detail}
                      paniersAbandonnes={choisi.paniersAbandonnes}
                      ventesRefusees={choisi.ventesRefuseesTiroir}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <BlocSecurite
                      fiche={detail}
                      actions={
                        <div className="flex flex-col gap-3 border-t border-hairline pt-3">
                          <ActionsClient
                            salonId={fiche.id}
                            suspendu={fiche.suspendedAt !== null}
                            seulement={
                              detail.employes.some((e) => e.verrouilleJusqua)
                                ? ACTIONS_APPEL
                                : ACTIONS_APPEL.filter((a) => a !== "debloquer")
                            }
                          />
                          {/* Les actions lourdes sont repliees : pendant un
                              appel, « suspendre le salon » n'est pas ce qu'on
                              cherche, et l'avoir sous la main augmente le
                              risque de cliquer a cote. */}
                          <details className="group">
                            <summary className="ds-focus flex min-h-[44px] cursor-pointer items-center text-xs font-semibold text-prune-soft hover:text-prune">
                              Plus d&apos;actions
                            </summary>
                            <div className="pt-2">
                              <ActionsClient
                                salonId={fiche.id}
                                suspendu={fiche.suspendedAt !== null}
                                seulement={ACTIONS_AUTRES}
                              />
                            </div>
                          </details>
                        </div>
                      }
                    />
                    <BlocActivite fiche={detail} />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <BlocQuestions questions={questions} />
                    <Bloc titre="Compte rendu de l'appel">
                      <CompteRenduClient salonId={fiche.id} />
                    </Bloc>
                  </div>

                  <Bloc titre="Appels précédents">
                    {fiche.notes.length === 0 ? (
                      <p className="text-sm text-prune-soft">Aucun appel enregistré.</p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {fiche.notes.map((n) => (
                          <li
                            key={n.id}
                            className="flex flex-col gap-0.5 border-b border-hairline pb-2 last:border-0"
                          >
                            <span className="flex flex-wrap items-baseline gap-2">
                              <span className="text-xs text-prune-soft">
                                {n.createdAt.toLocaleDateString("fr-FR")} · {n.authorEmail}
                              </span>
                              {estResultatAppel(n.resultat) && (
                                <span className="rounded-[var(--radius-pill)] bg-creme px-2 py-0.5 text-xs font-semibold text-prune">
                                  {LIBELLE_RESULTAT[n.resultat]}
                                </span>
                              )}
                            </span>
                            <span className="text-sm text-prune">{n.contenu}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Bloc>
                </>
              );
            })()
          )}
        </section>
      </div>
    </div>
  );
}

function Badge({
  ton,
  children,
}: {
  ton: "ok" | "neutre" | "alerte";
  children: React.ReactNode;
}) {
  const classes =
    ton === "ok"
      ? "bg-menthe text-prune"
      : ton === "alerte"
        ? "bg-rose-soft text-prune"
        : "bg-creme text-prune-soft";
  return (
    <span
      className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-1 last:border-0 sm:border-0">
      <dt className="shrink-0 text-xs text-prune-soft">{label}</dt>
      <dd className="truncate text-sm text-prune">{children}</dd>
    </div>
  );
}
