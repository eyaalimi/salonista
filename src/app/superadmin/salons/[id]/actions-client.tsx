"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VERIFICATIONS_IDENTITE } from "@/lib/support-salon";

type Action = {
  cle: string;
  libelle: string;
  explication: string;
  /** Une action destructrice se distingue visuellement des autres. */
  grave?: boolean;
};

/**
 * Les actions de support, avec le rappel de verification d'identite.
 *
 * LE RAPPEL EST AFFICHE AVANT L'ACTION, pas documente ailleurs : le risque
 * reel du support n'est pas technique, c'est qu'un inconnu appelle en se
 * faisant passer pour un salon. Trois questions ferment cette porte, a
 * condition qu'on les ait sous les yeux au bon moment.
 */
export function ActionsClient({
  salonId,
  suspendu,
}: {
  salonId: string;
  suspendu: boolean;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState<Action | null>(null);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{
    message: string;
    secret?: string;
  } | null>(null);

  const actions: Action[] = [
    {
      cle: "lien-reset",
      libelle: "Envoyer un lien de réinitialisation",
      explication:
        "Un lien à usage unique part vers l'adresse e-mail déjà enregistrée sur le compte. Valable 30 minutes.",
    },
    {
      cle: "mot-de-passe-temporaire",
      libelle: "Générer un mot de passe temporaire",
      explication:
        "Affiché une seule fois, à dicter. Le salon devra le changer à la connexion suivante. À n'utiliser que si son adresse e-mail ne fonctionne plus.",
    },
    {
      cle: "reinitialiser-pin",
      libelle: "Réinitialiser le PIN du propriétaire",
      explication: "Un nouveau PIN à 4 chiffres, affiché une seule fois.",
    },
    {
      cle: "debloquer",
      libelle: "Débloquer les comptes verrouillés",
      explication:
        "Remet à zéro les compteurs d'échec de PIN de toute l'équipe, sans changer aucun code.",
    },
    {
      cle: "fermer-sessions",
      libelle: "Fermer toutes les sessions",
      explication:
        "Déconnecte tous les appareils. L'effet s'applique au prochain rafraîchissement du jeton, pas instantanément.",
    },
    suspendu
      ? {
          cle: "reactiver",
          libelle: "Réactiver le salon",
          explication: "Le salon retrouve l'accès à sa caisse.",
        }
      : {
          cle: "suspendre",
          libelle: "Suspendre le salon",
          explication:
            "Le salon ne peut plus encaisser. Ses données sont conservées et la suspension est réversible.",
          grave: true,
        },
  ];

  async function executer() {
    if (!ouverte) return;
    setBusy(true);
    setErreur(null);
    const res = await fetch(`/api/superadmin/salons/${salonId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: ouverte.cle, motif }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);

    if (!res.ok) {
      setErreur(data?.error ?? "Erreur");
      return;
    }
    setResultat({
      message: data.message ?? "Fait.",
      // Le secret n'existe QUE dans cette reponse : ni journal, ni base en
      // clair, ni reaffichage possible.
      secret: data.motDePasseTemporaire ?? data.pin,
    });
    setOuverte(null);
    setMotif("");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="ds-display text-lg text-prune">Actions</h2>

      {resultat && (
        <div className="rounded-[var(--radius-card)] border border-menthe-deep bg-menthe px-5 py-4">
          <p className="text-sm font-semibold text-prune">{resultat.message}</p>
          {resultat.secret && (
            <p className="mt-3 select-all rounded-[var(--radius-panel)] bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-prune">
              {resultat.secret}
            </p>
          )}
          <button
            type="button"
            onClick={() => setResultat(null)}
            className="ds-focus mt-3 text-xs font-semibold text-prune underline"
          >
            J&apos;ai noté, fermer
          </button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map((a) => (
          <button
            key={a.cle}
            type="button"
            onClick={() => {
              setOuverte(a);
              setMotif("");
              setErreur(null);
            }}
            className={`ds-focus min-h-[48px] rounded-[var(--radius-card)] border px-4 py-3 text-left text-sm font-semibold ${
              a.grave
                ? "border-rose bg-rose-soft text-prune"
                : "border-hairline bg-white text-prune hover:bg-creme"
            }`}
          >
            {a.libelle}
          </button>
        ))}
      </div>

      {ouverte && (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-5">
          <h3 className="font-semibold text-prune">{ouverte.libelle}</h3>
          <p className="mt-1 text-sm text-prune-soft">{ouverte.explication}</p>

          {/* LE RAPPEL. Avant l'action, pas dans un manuel. */}
          <div className="mt-4 rounded-[var(--radius-panel)] bg-creme px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-prune">
              Vérifie d&apos;abord l&apos;identité
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {VERIFICATIONS_IDENTITE.map((v) => (
                <li key={v} className="flex gap-2 text-sm text-prune-soft">
                  <span aria-hidden="true">•</span>
                  {v}
                </li>
              ))}
            </ul>
          </div>

          <label
            htmlFor="motif"
            className="mt-4 block text-sm font-semibold text-prune"
          >
            Motif (obligatoire, 10 caractères minimum)
          </label>
          <textarea
            id="motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={2}
            placeholder="Appel de la gérante, mot de passe perdu — identité vérifiée"
            className="ds-focus mt-1 w-full rounded-[var(--radius-panel)] border border-hairline px-4 py-3 text-base text-prune"
          />

          {erreur && (
            <p role="alert" className="mt-2 text-sm font-semibold text-rose-fonce">
              {erreur}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={executer}
              disabled={busy || motif.trim().length < 10}
              className="ds-press ds-focus min-h-[48px] rounded-[var(--radius-pill)] bg-rose px-6 font-semibold text-prune disabled:opacity-50"
            >
              {busy ? "En cours…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setOuverte(null)}
              className="ds-focus min-h-[48px] rounded-[var(--radius-pill)] border border-hairline px-6 font-semibold text-prune-soft"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Ajout d'une note de support. */
export function NoteClient({ salonId }: { salonId: string }) {
  const router = useRouter();
  const [contenu, setContenu] = useState("");
  const [busy, setBusy] = useState(false);

  async function ajouter() {
    if (contenu.trim().length < 3) return;
    setBusy(true);
    await fetch(`/api/superadmin/salons/${salonId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu }),
    }).catch(() => {});
    setBusy(false);
    setContenu("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="note" className="text-sm font-semibold text-prune">
        Ajouter une note
      </label>
      <textarea
        id="note"
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        rows={2}
        placeholder="A appelé pour son PIN, identité vérifiée, PIN réinitialisé."
        className="ds-focus w-full rounded-[var(--radius-panel)] border border-hairline px-4 py-3 text-base text-prune"
      />
      <button
        type="button"
        onClick={ajouter}
        disabled={busy || contenu.trim().length < 3}
        className="ds-press ds-focus min-h-[44px] self-start rounded-[var(--radius-pill)] border border-hairline bg-white px-5 text-sm font-semibold text-prune disabled:opacity-50"
      >
        {busy ? "Ajout…" : "Enregistrer la note"}
      </button>
    </div>
  );
}
