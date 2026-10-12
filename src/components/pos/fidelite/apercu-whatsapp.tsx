"use client";

/**
 * L'apercu du message WhatsApp, et son editeur.
 *
 * L'APERCU N'AFFICHE JAMAIS `{name}`. La page precedente montrait le gabarit
 * brut — « Bonjour {name} 💖 … » — et une gerante pouvait croire que ses
 * clientes recevaient ces accolades. On rend donc le message avec des valeurs
 * d'exemple, via `composerMessage` : la meme fonction qui construit le vrai
 * lien `wa.me`, donc le meme resultat qu'a l'encaissement.
 *
 * DANS L'EDITEUR, LES VARIABLES SONT DES PASTILLES CLIQUABLES. Les jetons
 * `{name}` / `{earned}` / `{balance}` restent la valeur envoyee au serveur —
 * seul leur nom change a l'ecran. Une gerante n'a aucune raison d'apprendre
 * une syntaxe a accolades pour ecrire un message a ses clientes.
 */

import { useRef, useState } from "react";
import { composerMessage, MESSAGE_PAR_DEFAUT } from "@/lib/whatsapp-fidelite";
import { EXEMPLE_WHATSAPP, VARIABLES_MESSAGE } from "./contenu";

/** Remplace les jetons par leur nom francais, pour l'affichage de l'editeur. */
function enLibelles(texte: string): string {
  let sortie = texte;
  for (const v of VARIABLES_MESSAGE) {
    sortie = sortie.split(v.jeton).join(`[${v.libelle}]`);
  }
  return sortie;
}

/** L'inverse : des noms francais vers les jetons techniques. */
function enJetons(texte: string): string {
  let sortie = texte;
  for (const v of VARIABLES_MESSAGE) {
    sortie = sortie.split(`[${v.libelle}]`).join(v.jeton);
  }
  return sortie;
}

export function ApercuWhatsapp({
  message,
  peutModifier,
  onEnregistrer,
}: {
  message: string | null;
  peutModifier: boolean;
  onEnregistrer: (message: string | null) => Promise<void>;
}) {
  const [edition, setEdition] = useState(false);

  // Le defaut ne s'applique qu'a un champ VIDE : un salon qui avait
  // personnalise son texte le garde.
  const gabarit = message?.trim() || MESSAGE_PAR_DEFAUT;

  const apercu = composerMessage(gabarit, EXEMPLE_WHATSAPP);

  return (
    <section aria-labelledby="fid-whatsapp">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="fid-whatsapp" className="text-base md:text-lg font-semibold text-pos-ink">
          Le message envoyé à votre cliente
        </h2>
        {peutModifier && !edition && (
          <button
            type="button"
            onClick={() => setEdition(true)}
            className="min-h-[44px] rounded-xl border border-pos-border bg-white px-4 text-sm text-pos-ink hover:bg-pos-highlight"
          >
            Changer le message
          </button>
        )}
      </div>

      {edition ? (
        <EditeurMessage
          gabarit={gabarit}
          onAnnuler={() => setEdition(false)}
          onEnregistrer={async (valeur) => {
            await onEnregistrer(valeur);
            setEdition(false);
          }}
        />
      ) : (
        <div className="rounded-2xl border border-pos-border bg-white p-4 md:p-5">
          {/* La bulle verte, dans le sens d'un message envoye. */}
          <div className="flex justify-end">
            <p className="max-w-[min(32rem,100%)] rounded-2xl rounded-br-sm bg-[#D9FDD3] px-4 py-3 text-sm leading-relaxed text-[#111B21]">
              {apercu}
            </p>
          </div>
          <p className="mt-3 text-xs text-pos-ink-3">
            Exemple avec une cliente qui vient de gagner{" "}
            {EXEMPLE_WHATSAPP.earned.toLocaleString("fr-FR")} points. Les vrais
            prénoms et montants sont remplis à l&apos;encaissement.
          </p>
        </div>
      )}
    </section>
  );
}

function EditeurMessage({
  gabarit,
  onAnnuler,
  onEnregistrer,
}: {
  gabarit: string;
  onAnnuler: () => void;
  onEnregistrer: (valeur: string | null) => Promise<void>;
}) {
  const [texte, setTexte] = useState(() => enLibelles(gabarit));
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const zoneRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insere une variable a la position du curseur — pas a la fin. Une gerante
   * qui clique « Prénom » apres avoir ecrit « Aslema » attend le prenom juste
   * la, pas au bout du message.
   */
  function inserer(libelle: string) {
    const zone = zoneRef.current;
    const jeton = `[${libelle}]`;
    if (!zone) {
      setTexte((t) => `${t}${jeton}`);
      return;
    }
    const debut = zone.selectionStart ?? texte.length;
    const fin = zone.selectionEnd ?? texte.length;
    const suivant = texte.slice(0, debut) + jeton + texte.slice(fin);
    setTexte(suivant);
    // Replacer le curseur apres le jeton insere, une fois React repeint.
    requestAnimationFrame(() => {
      zone.focus();
      const pos = debut + jeton.length;
      zone.setSelectionRange(pos, pos);
    });
  }

  const apercu = composerMessage(enJetons(texte), EXEMPLE_WHATSAPP);

  async function enregistrer() {
    setBusy(true);
    setErreur(null);
    try {
      const valeur = enJetons(texte).trim();
      await onEnregistrer(valeur || null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-pos-border bg-white p-4 md:p-5">
      <label htmlFor="fid-message" className="block text-sm font-medium text-pos-ink">
        Votre message
      </label>
      <textarea
        id="fid-message"
        ref={zoneRef}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={4}
        maxLength={500}
        className="mt-2 w-full resize-y rounded-xl border border-pos-border px-3 py-2.5 text-sm leading-relaxed focus:border-pos-accent focus:outline-none"
      />

      <p className="mt-3 text-xs text-pos-ink-2">Ajouter dans le message&nbsp;:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {VARIABLES_MESSAGE.map((v) => (
          <button
            key={v.jeton}
            type="button"
            onClick={() => inserer(v.libelle)}
            className="min-h-[44px] rounded-full border border-pos-border bg-pos-highlight px-4 text-sm text-pos-ink hover:border-pos-accent"
          >
            + {v.libelle}
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-pos-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pos-ink-4">
          Aperçu
        </p>
        <div className="mt-2 flex justify-end">
          <p
            aria-live="polite"
            className="max-w-[min(32rem,100%)] rounded-2xl rounded-br-sm bg-[#D9FDD3] px-4 py-3 text-sm leading-relaxed text-[#111B21]"
          >
            {apercu}
          </p>
        </div>
      </div>

      {erreur && (
        <p className="mt-3 rounded-xl bg-pos-danger-soft px-3 py-2 text-sm text-pos-danger">
          {erreur}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onAnnuler}
          className="min-h-[44px] px-4 text-sm text-pos-ink-2 hover:text-pos-ink"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={busy}
          className="min-h-[44px] rounded-xl bg-pos-accent px-6 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
