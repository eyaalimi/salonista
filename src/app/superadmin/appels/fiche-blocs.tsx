/**
 * Les blocs de la fiche de droite — parcours, champs, caisse, securite,
 * activite, questions.
 *
 * LA REGLE DE CE FICHIER : tout doit tenir SOUS LES YEUX pendant l'appel.
 * La version precedente renvoyait vers « Voir la fiche complete » pour la
 * moitie des informations — un lien qu'on ne suit pas avec une gerante au
 * telephone. Le lien reste, en secondaire.
 *
 * DEUXIEME REGLE : jamais de section vide. Un bloc qui disparait quand il n'y
 * a rien laisse croire a un oubli ; « aucun » ou « 0 » affirme qu'on a
 * regarde. C'est la difference entre « je ne sais pas » et « il n'y en a
 * pas », et elle compte quand on prepare un appel.
 *
 * Composants serveur, sans etat.
 */

import type { EtapeParcours } from "@/lib/cockpit-appels";
import type { FicheAppel } from "@/lib/fiche-appel-donnees";
import type { Question } from "@/lib/cockpit-appels";
import { libelleEvenement } from "@/lib/evenement-salon";
import { accord, dateCourte, dateHeure, dateRelative, depuisJours } from "@/lib/format-fr";

/* ----------------------------- primitives ----------------------------- */

export function Bloc({
  titre,
  action,
  children,
}: {
  titre: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-hairline bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-prune">{titre}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LigneValeur({
  label,
  children,
  alerte = false,
}: {
  label: string;
  children: React.ReactNode;
  alerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-0">
      <span className="text-xs text-prune-soft">{label}</span>
      <span className={`text-sm ${alerte ? "font-semibold text-rose-fonce" : "text-prune"}`}>
        {children}
      </span>
    </div>
  );
}

/* ------------------------- parcours d'activation ------------------------- */

export function BlocParcours({ etapes }: { etapes: readonly EtapeParcours[] }) {
  const bloquante = etapes.find((e) => e.bloquante);
  return (
    <Bloc titre="Parcours d'activation">
      <ol className="flex gap-1 overflow-x-auto pb-1">
        {etapes.map((e) => (
          <li key={e.cle} className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1 text-center">
            <span
              aria-hidden
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                e.faite
                  ? "border-menthe bg-menthe text-prune"
                  : e.bloquante
                    ? "border-rose-fonce bg-rose-soft text-prune"
                    : "border-dashed border-hairline text-prune-soft"
              }`}
            >
              {e.faite ? "✓" : e.bloquante ? "!" : "·"}
            </span>
            <span className="text-[11px] leading-tight text-prune">{e.libelle}</span>
            <span className="text-[10px] text-prune-soft">
              {e.faite
                ? dateCourte(e.le)
                : e.facultative
                  ? "facultatif"
                  : e.bloquante
                    ? "bloqué ici"
                    : "—"}
            </span>
          </li>
        ))}
      </ol>
      {bloquante && (
        <p className="text-xs text-rose-fonce">
          Arrêté à « {bloquante.libelle} »{" "}
          {/* On date le blocage depuis la DERNIERE etape franchie, pas depuis
              l'inscription : un salon inscrit il y a six mois qui a tout fait
              la semaine derniere n'est pas bloque depuis six mois. */}
          {(() => {
            const i = etapes.findIndex((e) => e.bloquante);
            const precedente = [...etapes.slice(0, i)].reverse().find((e) => e.faite && e.le);
            return precedente?.le ? depuisJours(precedente.le) : "";
          })()}
        </p>
      )}
    </Bloc>
  );
}

/* --------------------------- champs de la fiche --------------------------- */

export function BlocChamps({
  champs,
  servicesTotal,
  servicesSansPhoto,
}: {
  champs: ReadonlyArray<{ libelle: string; valeur: string | null }>;
  servicesTotal: number;
  servicesSansPhoto: number;
}) {
  const remplis = champs.filter((c) => c.valeur).length;
  return (
    <Bloc
      titre="Champs de la fiche"
      action={
        <span className="text-xs text-prune-soft">
          {remplis} sur {champs.length}
        </span>
      }
    >
      <dl className="flex flex-col">
        {champs.map((c) => (
          <div
            key={c.libelle}
            className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-0"
          >
            <dt className="text-xs text-prune-soft">{c.libelle}</dt>
            <dd
              className={`text-sm ${c.valeur ? "text-prune" : "font-semibold text-rose-fonce"}`}
            >
              {c.valeur ? `✓ ${c.valeur}` : "Manquant"}
            </dd>
          </div>
        ))}
      </dl>
      {servicesSansPhoto > 0 && (
        <p className="rounded-[var(--radius-panel)] bg-rose-soft/40 px-3 py-2 text-xs text-prune">
          {servicesSansPhoto} service sur {servicesTotal} sans photo — invisible
          pour les clientes.
        </p>
      )}
    </Bloc>
  );
}

/* ----------------------------- caisse et tiroir ----------------------------- */

export function BlocCaisse({
  fiche,
  paniersAbandonnes,
  ventesRefusees,
}: {
  fiche: FicheAppel;
  paniersAbandonnes: number;
  ventesRefusees: number;
}) {
  return (
    <Bloc
      titre="Caisse et tiroir"
      action={
        fiche.rapportsZ === 0 && fiche.tiroirOuvertLe !== null ? (
          <span className="rounded-[var(--radius-pill)] bg-rose-soft px-2 py-0.5 text-xs font-semibold text-prune">
            Jamais clôturé
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col">
        <LigneValeur label="Tiroir">
          {fiche.tiroirOuvertDepuis
            ? `Ouvert ${dateRelative(fiche.tiroirOuvertDepuis)}`
            : fiche.tiroirOuvertLe
              ? "Fermé"
              : "Jamais ouvert"}
        </LigneValeur>
        <LigneValeur label="Fond de caisse">
          {fiche.tiroirFond ? `${fiche.tiroirFond} DT` : "—"}
        </LigneValeur>
        <LigneValeur label="Rapports Z" alerte={fiche.rapportsZ === 0}>
          {fiche.rapportsZ}
        </LigneValeur>
        <LigneValeur label="Paniers abandonnés" alerte={paniersAbandonnes > 0}>
          {paniersAbandonnes}
        </LigneValeur>
        <LigneValeur label="Ventes refusées « caisse fermée »" alerte={ventesRefusees > 0}>
          {ventesRefusees}
        </LigneValeur>
        <LigneValeur label="Ventes encaissées">{fiche.ventesEncaissees}</LigneValeur>
      </div>
    </Bloc>
  );
}

/* -------------------------- connexions et securite -------------------------- */

export function BlocSecurite({
  fiche,
  actions,
}: {
  fiche: FicheAppel;
  actions?: React.ReactNode;
}) {
  const alerte =
    fiche.verrouillages7j > 0 ||
    fiche.mdpIncorrects7j > 0 ||
    fiche.employes.some((e) => e.verrouilleJusqua);

  return (
    <Bloc
      titre="Connexions et sécurité"
      action={
        alerte ? (
          <span className="rounded-[var(--radius-pill)] bg-rose-soft px-2 py-0.5 text-xs font-semibold text-prune">
            Alerte
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col">
        <LigneValeur label="Dernière connexion">
          {dateRelative(fiche.derniereConnexion)}
        </LigneValeur>
        <LigneValeur label="Employées connectées (7 j)">{fiche.connexions7j}</LigneValeur>
        <LigneValeur label="Mots de passe incorrects (7 j)" alerte={fiche.mdpIncorrects7j > 0}>
          {fiche.mdpIncorrects7j}
        </LigneValeur>
        <LigneValeur label="Verrouillages (7 j)" alerte={fiche.verrouillages7j > 0}>
          {fiche.verrouillages7j}
        </LigneValeur>
        <LigneValeur label="Appareils appairés">{fiche.appareilsAppaires}</LigneValeur>
      </div>

      {/* PIN par employee — seulement celles qui ont rate, mais le bloc dit
          « aucun » plutot que de disparaitre. */}
      <div className="border-t border-hairline pt-2">
        <p className="mb-1 text-xs text-prune-soft">PIN incorrects par employée (7 j)</p>
        {fiche.employes.filter((e) => e.pinIncorrects > 0 || e.verrouilleJusqua).length === 0 ? (
          <p className="text-sm text-prune">Aucun</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {fiche.employes
              .filter((e) => e.pinIncorrects > 0 || e.verrouilleJusqua)
              .map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-prune">{e.nom}</span>
                  <span className={e.verrouilleJusqua ? "font-semibold text-rose-fonce" : "text-prune-soft"}>
                    {e.pinIncorrects}
                    {e.verrouilleJusqua ? " · verrouillée" : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {actions}
    </Bloc>
  );
}

/* ----------------------------- activite recente ----------------------------- */

export function BlocActivite({ fiche }: { fiche: FicheAppel }) {
  return (
    <Bloc
      titre="Activité récente"
      action={
        <span className="text-xs text-prune-soft">
          {accord(fiche.activiteTotal, "évènement")} sur 7 jours
        </span>
      }
    >
      {fiche.activite.length === 0 ? (
        <p className="text-sm text-prune-soft">Aucune activité enregistrée.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {fiche.activite.map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 text-sm">
              <span className="w-24 shrink-0 text-xs text-prune-soft">
                {dateHeure(e.createdAt)}
              </span>
              <span className="text-prune">
                {libelleEvenement(e.type)}
                {e.employe ? ` · ${e.employe}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Bloc>
  );
}

/* ------------------------------ questions ------------------------------ */

export function BlocQuestions({ questions }: { questions: readonly Question[] }) {
  if (questions.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-prune p-5 text-creme">
      <h3 className="text-sm font-semibold">Questions à poser</h3>
      <p className="-mt-2 text-xs text-creme/70">
        Tirées des blocages de ce salon, dans l&apos;ordre.
      </p>
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.question} className="flex gap-3">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-creme/15 text-xs"
            >
              {i + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm">« {q.question} »</span>
              <span className="text-xs text-creme/70">{q.parceQue}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
