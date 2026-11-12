"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ConnexionAffichee = {
  statut: "BROUILLON" | "ACTIVE" | "SUSPENDUE";
  numeroAffiche: string;
  phoneNumberId: string;
  wabaId: string;
  nomModele: string;
  langueModele: string;
  texteFinModele: string;
  prixMessageDT: string | null;
} | null;

const LIBELLES_STATUT = {
  BROUILLON: "Brouillon — rien ne part",
  ACTIVE: "Active — le salon peut envoyer",
  SUSPENDUE: "Suspendue — envois bloqués",
} as const;

/**
 * Bloc « WhatsApp promos » de la fiche salon.
 *
 * Le JETON n'est jamais reaffiche : la page ne le recoit meme pas. Le champ
 * reste vide, « jeton enregistre » le signale ; le remplir le remplace.
 * Chaque enregistrement et chaque test demandent un motif, comme les autres
 * actions de support (journal).
 */
export function WhatsappClient({ salonId, connexion }: { salonId: string; connexion: ConnexionAffichee }) {
  const router = useRouter();
  const [champs, setChamps] = useState({
    numeroAffiche: connexion?.numeroAffiche ?? "",
    phoneNumberId: connexion?.phoneNumberId ?? "",
    wabaId: connexion?.wabaId ?? "",
    jeton: "",
    nomModele: connexion?.nomModele ?? "",
    langueModele: connexion?.langueModele ?? "fr",
    texteFinModele: connexion?.texteFinModele ?? "",
    prixMessageDT: connexion?.prixMessageDT?.replace(".", ",") ?? "",
    statut: connexion?.statut ?? "BROUILLON",
  });
  const [motif, setMotif] = useState("");
  const [telTest, setTelTest] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const maj = (k: keyof typeof champs) => (e: { target: { value: string } }) =>
    setChamps((c) => ({ ...c, [k]: e.target.value }));

  async function enregistrer() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/superadmin/salons/${salonId}/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...champs, motif }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, texte: d.error ?? `Erreur ${res.status}` });
        return;
      }
      setMessage({ ok: true, texte: "Connexion enregistrée." });
      setChamps((c) => ({ ...c, jeton: "" }));
      setMotif("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function tester() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/superadmin/salons/${salonId}/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telephone: telTest, motif }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.ok) setMessage({ ok: true, texte: `Message de test accepté par Meta (${d.messageIdExterne}).` });
      else setMessage({ ok: false, texte: d.error ?? `${d.code ?? res.status} — ${d.message ?? "échec"}` });
    } finally {
      setBusy(false);
    }
  }

  const champ = "mt-1 w-full rounded border border-hairline bg-white px-3 py-2 text-sm text-prune";
  const etiquette = "block text-xs font-semibold text-prune-soft";

  return (
    <section className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-4">
      <h2 className="ds-display text-lg text-prune">WhatsApp promos</h2>
      <p className="mt-1 text-sm text-prune-soft">
        {connexion
          ? `${LIBELLES_STATUT[connexion.statut]} · jeton enregistré`
          : "Aucune connexion. Pas-à-pas : docs/whatsapp-cloud.md."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={etiquette}>
          Numéro affiché
          <input className={champ} value={champs.numeroAffiche} onChange={maj("numeroAffiche")} placeholder="+216 22 345 678" />
        </label>
        <label className={etiquette}>
          Statut
          <select className={champ} value={champs.statut} onChange={maj("statut")}>
            {(Object.keys(LIBELLES_STATUT) as Array<keyof typeof LIBELLES_STATUT>).map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUT[s]}
              </option>
            ))}
          </select>
        </label>
        <label className={etiquette}>
          Phone number ID
          <input className={`${champ} font-mono`} value={champs.phoneNumberId} onChange={maj("phoneNumberId")} />
        </label>
        <label className={etiquette}>
          WABA ID
          <input className={`${champ} font-mono`} value={champs.wabaId} onChange={maj("wabaId")} />
        </label>
        <label className={`${etiquette} sm:col-span-2`}>
          Jeton permanent {connexion && <span className="font-normal">(laisser vide pour garder le jeton enregistré)</span>}
          <input
            className={`${champ} font-mono`}
            type="password"
            autoComplete="off"
            value={champs.jeton}
            onChange={maj("jeton")}
            placeholder={connexion ? "•••••••• jeton enregistré" : "EAAG…"}
          />
        </label>
        <label className={etiquette}>
          Nom du modèle
          <input className={`${champ} font-mono`} value={champs.nomModele} onChange={maj("nomModele")} placeholder="promo_salon" />
        </label>
        <label className={etiquette}>
          Langue du modèle
          <input className={`${champ} font-mono`} value={champs.langueModele} onChange={maj("langueModele")} />
        </label>
        <label className={`${etiquette} sm:col-span-2`}>
          Texte de fin du modèle (recopié à l&apos;identique du modèle approuvé)
          <textarea className={champ} rows={2} value={champs.texteFinModele} onChange={maj("texteFinModele")} />
        </label>
        <label className={etiquette}>
          Prix d&apos;un message (DT, facultatif)
          <input className={`${champ} font-mono`} value={champs.prixMessageDT} onChange={maj("prixMessageDT")} placeholder="0,150" />
        </label>
      </div>

      <label className={`${etiquette} mt-4`}>
        Motif (obligatoire, journalisé)
        <input className={champ} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : connexion du numéro promos demandée par la gérante" />
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={enregistrer}
          disabled={busy || motif.trim().length < 10}
          className="min-h-[44px] rounded-[var(--radius-pill)] bg-prune px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Enregistrer
        </button>
        {connexion && (
          <>
            <label className={etiquette}>
              Numéro pour le test
              <input className={champ} value={telTest} onChange={(e) => setTelTest(e.target.value)} placeholder="22 345 678" />
            </label>
            <button
              type="button"
              onClick={tester}
              disabled={busy || motif.trim().length < 10 || !telTest.trim()}
              className="min-h-[44px] rounded-[var(--radius-pill)] border border-prune px-5 text-sm font-semibold text-prune disabled:opacity-40"
            >
              Envoyer un test
            </button>
          </>
        )}
      </div>
      {connexion && (
        <p className="mt-2 text-xs text-prune-soft">Le test envoie un vrai message, facturé par Meta.</p>
      )}
      {message && (
        <p role="status" className={`mt-3 text-sm ${message.ok ? "text-menthe-deep" : "text-rose-fonce"}`}>
          {message.texte}
        </p>
      )}
    </section>
  );
}
