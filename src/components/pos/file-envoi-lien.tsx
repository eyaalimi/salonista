"use client";

import { useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { lienPromoWhatsapp } from "@/lib/promos";

type Restant = { id: string; prenom: string | null; nom: string | null; telephone: string };

/**
 * File d'envoi d'une promo par liens wa.me — le principe du message de
 * fidelite, cliente par cliente.
 *
 * Un gros bouton « Envoyer à Amira » ouvre WhatsApp sur SA conversation, avec
 * le message deja ecrit ; la gerante appuie sur Envoyer dans WhatsApp, revient
 * ici, et la cliente suivante est deja affichee. On ne peut pas savoir si elle
 * a vraiment envoye : « envoye » veut dire « WhatsApp ouvert ».
 *
 * Le clic passe par un vrai lien (<a target="_blank">) : un `window.open`
 * declenche apres un `await` serait bloque par le navigateur comme popup.
 */
export function FileEnvoiLien({
  campagneId,
  onChange,
  onFermer,
}: {
  campagneId: string;
  onChange: () => void;
  onFermer: () => void;
}) {
  const [offre, setOffre] = useState("");
  const [total, setTotal] = useState(0);
  const [envoyes, setEnvoyes] = useState(0);
  const [restants, setRestants] = useState<Restant[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/pos/promos/${campagneId}/lien`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!vivant) return;
        if (!r.ok) {
          setErreur(d.error ?? `Erreur ${r.status}`);
          return;
        }
        setOffre(d.campagne.texteOffre);
        setTotal(d.campagne.nbDestinataires);
        setEnvoyes(d.envoyes);
        setRestants(d.restants);
      })
      .catch(() => vivant && setErreur("Connexion impossible."));
    return () => {
      vivant = false;
    };
  }, [campagneId]);

  function marquer(d: Restant, action: "envoye" | "passe") {
    // Optimiste : la cliente suivante s'affiche tout de suite, la gerante ne
    // doit pas attendre le serveur entre deux clientes.
    setRestants((r) => (r ? r.filter((x) => x.id !== d.id) : r));
    if (action === "envoye") setEnvoyes((n) => n + 1);
    fetch(`/api/pos/promos/${campagneId}/lien`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinataireId: d.id, action }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          setErreur(e.error ?? `Erreur ${r.status}`);
        }
        onChange();
      })
      .catch(() => setErreur("Connexion perdue : cette cliente n'a pas été comptée. Rechargez la page."));
  }

  if (erreur && !restants) return <p className="text-sm text-pos-danger">{erreur}</p>;
  if (!restants) return <p className="text-sm text-pos-ink-3">Chargement…</p>;

  const suivante = restants[0];
  const nom = suivante ? [suivante.prenom, suivante.nom].filter(Boolean).join(" ") || "Cliente sans nom" : "";
  const lien = suivante ? lienPromoWhatsapp({ telephone: suivante.telephone, prenom: suivante.prenom, offre }) : null;

  return (
    <section
      aria-label="Envoi cliente par cliente"
      className="rounded border-2 border-pos-accent bg-pos-surface p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Envoi cliente par cliente</h2>
        <span className="pos-mono text-sm">
          {envoyes} / {total} envoyés
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-pos-bg" aria-hidden="true">
        <div className="h-full bg-pos-accent" style={{ width: `${total ? Math.round((envoyes / total) * 100) : 0}%` }} />
      </div>

      {suivante && lien ? (
        <>
          <p className="mt-4 text-sm text-pos-ink-3">
            Appuyez sur le bouton : WhatsApp s&apos;ouvre avec le message prêt. Appuyez sur Envoyer dans
            WhatsApp, puis revenez ici pour la suivante.
          </p>
          <a
            href={lien}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => marquer(suivante, "envoye")}
            className="mt-3 flex min-h-[64px] w-full items-center justify-center rounded bg-pos-accent px-4 text-center text-lg font-semibold text-white"
          >
            Envoyer à {nom}
          </a>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="pos-mono text-pos-ink-3">{formatPhoneDisplay(`+${suivante.telephone}`)}</span>
            <button
              type="button"
              onClick={() => marquer(suivante, "passe")}
              className="min-h-[44px] px-3 text-pos-ink-3 underline"
            >
              Passer cette cliente
            </button>
          </div>
          <p className="mt-2 text-xs text-pos-ink-3">
            Encore {restants.length} {restants.length > 1 ? "clientes" : "cliente"}. Vous pouvez fermer et
            reprendre plus tard : la liste est gardée.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm font-medium text-pos-accent">
          C&apos;est fini : la promo a été envoyée à toutes les clientes choisies.
        </p>
      )}

      <p className="mt-3 text-xs text-pos-ink-3">
        Une cliente répond STOP ? Décochez « Accepte les promos » sur sa fiche : elle ne recevra plus rien.
      </p>
      {erreur && <p className="mt-2 text-sm text-pos-danger">{erreur}</p>}
      <button type="button" onClick={onFermer} className="mt-3 min-h-[44px] text-sm underline">
        Fermer
      </button>
    </section>
  );
}
