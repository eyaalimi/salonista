"use client";

import { useEffect, useState } from "react";
import { formatDT, toMillimes, fromMillimes } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { ancienneteJours, formatJourMois, jourTunis, MOTIF_EFFACEMENT_MIN } from "@/lib/credit";
import { lienRappelCredit } from "@/lib/whatsapp-credit";
import type { CachedCatalogProvider } from "@/lib/pos-offline-db";
import { ReglementCreditPrintFrame, type ReglementCreditData } from "./receipt";

type Vente = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  total: string;
  amountDue: string;
  dueDate: string | null;
  enRetard: boolean;
  resume: string;
};

type LigneCliente = {
  customer: { id: string; firstName: string | null; lastName: string | null; phone: string };
  totalDu: string;
  plusAncienne: string;
  dueDateLaPlusProche: string | null;
  enRetard: boolean;
  ventes: Vente[];
};

type Reponse = {
  totaux: { aRecuperer: string; clientes: number; enRetard: number };
  clientes: LigneCliente[];
};

type Filtre = "toutes" | "retard" | "semaine";
type Methode = "CASH" | "CARD" | "TRANSFER";

const METHODES: Array<{ id: Methode; label: string }> = [
  { id: "CASH", label: "Espèces" },
  { id: "CARD", label: "Carte" },
  { id: "TRANSFER", label: "Virement" },
];

/** « 65,000 DT » : la forme parlee au comptoir, sans « TND ». */
function dt(montant: string): string {
  return formatDT(montant).replace(" TND", " DT");
}

function nomCliente(c: LigneCliente["customer"]): string {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || formatPhoneDisplay(c.phone);
}

/** « d'Amira », « de Sana » : l'elision que la phrase de confirmation exige. */
function deNom(nom: string): string {
  return /^[aeiouyhâàéèêëîïôöûüAEIOUYHÂÀÉÈÊËÎÏÔÖÛÜ]/.test(nom) ? `d'${nom}` : `de ${nom}`;
}

function telephone(phone: string): string | null {
  return phone.startsWith("walk-in") ? null : formatPhoneDisplay(phone);
}

export function CreditsClient({
  provider,
  employeeName,
  peutEncaisser,
  peutEffacer,
  clientInitial,
}: {
  provider: CachedCatalogProvider | null;
  employeeName: string;
  peutEncaisser: boolean;
  peutEffacer: boolean;
  clientInitial: string | null;
}) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [recherche, setRecherche] = useState("");
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);
  const [selection, setSelection] = useState<string | null>(clientInitial);

  // Saisie du panneau de droite.
  const [montant, setMontant] = useState("");
  const [methode, setMethode] = useState<Methode>("CASH");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [recu, setRecu] = useState<ReglementCreditData | null>(null);
  const [effacement, setEffacement] = useState<{ motif: string } | null>(null);
  const [tiroirOuvert, setTiroirOuvert] = useState<boolean | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/pos/cash-drawer/current", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivant) setTiroirOuvert(d?.session?.status === "OPEN");
      })
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [rechargement]);

  // Liste : rechargee au changement de filtre, de recherche (avec un petit
  // delai pour ne pas tirer une requete par lettre) et apres chaque action.
  useEffect(() => {
    let vivant = true;
    const params = new URLSearchParams();
    if (filtre !== "toutes") params.set("filtre", filtre);
    if (recherche.trim()) params.set("q", recherche.trim());
    const minuteur = setTimeout(() => {
      fetch(`/api/pos/credits?${params}`, { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!vivant) return;
          if (!r.ok) {
            setErreurListe(d.error ?? `Erreur ${r.status}`);
            return;
          }
          setErreurListe(null);
          setDonnees(d as Reponse);
        })
        .catch(() => {
          if (vivant) setErreurListe("Connexion impossible. Les crédits demandent une connexion.");
        });
    }, recherche ? 250 : 0);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [filtre, recherche, rechargement]);

  const clientes = donnees?.clientes ?? [];
  const choisie = clientes.find((c) => c.customer.id === selection) ?? null;
  const maintenant = new Date();
  const aujourdhui = jourTunis(maintenant);

  // Le montant recu est prerempli avec le total du — sauf si la caissiere l'a
  // deja modifie pour cette cliente. Derive, pas synchronise par un effet.
  const montantAffiche = montant === "" && choisie ? choisie.totalDu : montant;

  function selectionner(id: string) {
    setSelection(id);
    setMontant("");
    setErreur(null);
    setEffacement(null);
  }

  async function encaisser() {
    if (!choisie) return;
    setEnvoi(true);
    setErreur(null);
    setSucces(null);
    try {
      const res = await fetch("/api/pos/credits/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: choisie.customer.id,
          amount: montantAffiche.replace(",", "."),
          method: methode,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(d.error ?? `Erreur ${res.status}`);
        return;
      }
      const r = d.reglement as {
        date: string;
        montant: string;
        methode: string;
        ventes: Array<{ receiptNumber: string; montantImpute: string; resteApres: string }>;
        resteDuApres: string;
        pointsGagnes: number;
      };
      setRecu({
        provider,
        employee: { displayName: employeeName },
        customerName: nomCliente(choisie.customer),
        date: r.date,
        montant: r.montant,
        methode: r.methode,
        ventes: r.ventes,
        resteDuApres: r.resteDuApres,
        pointsGagnes: r.pointsGagnes,
      });
      setSucces(
        toMillimes(r.resteDuApres) > 0
          ? `${dt(r.montant)} encaissés. Reste dû : ${dt(r.resteDuApres)}.`
          : `${dt(r.montant)} encaissés. ${nomCliente(choisie.customer)} ne doit plus rien.`,
      );
      if (toMillimes(r.resteDuApres) === 0) setSelection(null);
      setMontant("");
      setRechargement((n) => n + 1);
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  async function effacer() {
    if (!choisie || !effacement) return;
    setEnvoi(true);
    setErreur(null);
    setSucces(null);
    try {
      const res = await fetch("/api/pos/credits/effacer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: choisie.customer.id, motif: effacement.motif }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(d.error ?? `Erreur ${res.status}`);
        return;
      }
      setSucces(`Dette ${deNom(nomCliente(choisie.customer))} effacée (${dt(d.montant)}).`);
      setRecu(null);
      setEffacement(null);
      setSelection(null);
      setRechargement((n) => n + 1);
    } catch {
      setErreur("Connexion impossible. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  const montantM = (() => {
    const n = Number(montantAffiche.replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 1000) : -1;
  })();
  const especesBloquees = methode === "CASH" && tiroirOuvert === false;
  const montantValide = !!choisie && montantM > 0 && montantM <= toMillimes(choisie.totalDu);
  const lienWhatsapp = choisie
    ? lienRappelCredit({
        phone: choisie.customer.phone,
        name: choisie.customer.firstName,
        salon: provider?.salonName ?? "",
        montant: choisie.totalDu,
      })
    : null;

  return (
    <div className="min-h-full bg-pos-bg p-4 text-pos-ink md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Crédits clientes</h1>
        <p className="mt-1 text-sm text-pos-ink-3">
          Les ventes pas encore payées : qui doit combien, et depuis quand.
        </p>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tuile titre="À récupérer" valeur={donnees ? dt(donnees.totaux.aRecuperer) : "—"} />
        <Tuile titre="Clientes concernées" valeur={donnees ? String(donnees.totaux.clientes) : "—"} />
        <Tuile
          titre="En retard · plus de 15 jours"
          valeur={donnees ? String(donnees.totaux.enRetard) : "—"}
          danger
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "toutes", label: "Toutes" },
            { id: "retard", label: "En retard" },
            { id: "semaine", label: "Promis cette semaine" },
          ] as Array<{ id: Filtre; label: string }>
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtre === f.id}
            onClick={() => setFiltre(f.id)}
            className={`min-h-[44px] rounded-full border px-4 text-sm ${
              filtre === f.id
                ? "border-pos-ink bg-pos-ink text-pos-bg"
                : "border-pos-border bg-pos-surface text-pos-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom ou téléphone"
          aria-label="Rechercher une cliente"
          className="min-h-[44px] min-w-[200px] flex-1 rounded border border-pos-border bg-pos-surface px-3 text-sm"
        />
      </div>

      {succes && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center gap-3 rounded border border-pos-accent bg-pos-accent-soft px-4 py-3 text-sm"
        >
          <span className="flex-1">{succes}</span>
          {recu && (
            // Bouton et non impression automatique : la plupart des salons
            // n'ont pas d'imprimante au comptoir, et la boite d'impression du
            // navigateur serait a fermer a la main a chaque reglement.
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] rounded border border-pos-ink bg-pos-surface px-4 font-medium"
            >
              Imprimer le reçu
            </button>
          )}
          <button type="button" onClick={() => setSucces(null)} aria-label="Fermer" className="min-h-[44px] px-2">
            ✕
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <section aria-label="Clientes qui doivent de l'argent">
          {erreurListe ? (
            <p className="text-sm text-pos-danger">{erreurListe}</p>
          ) : !donnees ? (
            <p className="text-sm text-pos-ink-3">Chargement…</p>
          ) : clientes.length === 0 ? (
            <p className="rounded border border-pos-border bg-pos-surface p-6 text-sm text-pos-ink-3">
              {donnees.totaux.clientes === 0
                ? "Aucun crédit en cours. Toutes vos clientes sont à jour."
                : "Aucune cliente ne correspond."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-pos-border bg-pos-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-pos-ink-3">
                  <tr className="border-b border-pos-border">
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Depuis</th>
                    <th className="px-3 py-2">Promis le</th>
                    <th className="px-3 py-2 text-right">Reste dû</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => {
                    const jours = ancienneteJours(new Date(c.plusAncienne), maintenant);
                    const promis = c.dueDateLaPlusProche ? new Date(c.dueDateLaPlusProche) : null;
                    const depasse = promis ? jourTunis(promis) < aujourdhui : false;
                    const tel = telephone(c.customer.phone);
                    return (
                      <tr
                        key={c.customer.id}
                        className={`border-b border-pos-border last:border-0 ${
                          selection === c.customer.id ? "bg-pos-highlight" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium">{nomCliente(c.customer)}</div>
                          {tel && <div className="pos-mono text-xs text-pos-ink-3">{tel}</div>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="pos-mono">{formatJourMois(new Date(c.plusAncienne))}</span>
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              c.enRetard ? "bg-pos-danger-soft text-pos-danger" : "bg-pos-bg text-pos-ink-3"
                            }`}
                          >
                            {jours} j
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {promis ? (
                            <>
                              <span className="pos-mono">{formatJourMois(promis)}</span>
                              {depasse && (
                                <span className="ml-2 text-xs font-semibold text-pos-danger">dépassé</span>
                              )}
                            </>
                          ) : (
                            <span className="text-pos-ink-3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right pos-mono font-semibold whitespace-nowrap">
                          {dt(c.totalDu)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => selectionner(c.customer.id)}
                            className="min-h-[44px] rounded bg-pos-ink px-4 text-sm font-medium text-pos-bg"
                          >
                            Encaisser
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside aria-label="Cliente sélectionnée" className="lg:sticky lg:top-4 lg:self-start">
          {!choisie ? (
            <p className="rounded border border-dashed border-pos-border p-6 text-sm text-pos-ink-3">
              Choisissez une cliente pour encaisser ce qu&apos;elle doit.
            </p>
          ) : (
            <div className="rounded border border-pos-border bg-pos-surface p-4">
              <h2 className="text-lg font-semibold">{nomCliente(choisie.customer)}</h2>
              <p className="pos-mono text-sm text-pos-ink-3">Doit {dt(choisie.totalDu)}</p>

              <ul className="mt-3 divide-y divide-pos-border text-sm">
                {choisie.ventes.map((v) => (
                  <li key={v.id} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <div className="pos-mono text-xs text-pos-ink-3">
                        {formatJourMois(new Date(v.createdAt))} · N° {v.receiptNumber}
                      </div>
                      <div>{v.resume || "—"}</div>
                    </div>
                    <div className={`pos-mono whitespace-nowrap ${v.enRetard ? "text-pos-danger" : ""}`}>
                      {dt(v.amountDue)}
                    </div>
                  </li>
                ))}
              </ul>

              {peutEncaisser && (
                <>
                  <label className="mt-4 block text-sm font-medium" htmlFor="montant-recu">
                    Montant reçu
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      id="montant-recu"
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      value={montantAffiche}
                      onChange={(e) => setMontant(e.target.value)}
                      className="min-h-[44px] flex-1 rounded border border-pos-border px-3 pos-mono text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setMontant(choisie.totalDu)}
                      className="min-h-[44px] rounded border border-pos-border px-4 text-sm"
                    >
                      Tout
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-pos-ink-3">
                    Une partie seulement ? Le plus ancien est réglé d&apos;abord.
                  </p>
                  {montantM > toMillimes(choisie.totalDu) && (
                    <p className="mt-1 text-xs text-pos-danger">
                      C&apos;est plus que ce qu&apos;elle doit ({dt(choisie.totalDu)}).
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Mode de paiement">
                    {METHODES.map((m) => {
                      const bloque = m.id === "CASH" && tiroirOuvert === false;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={methode === m.id}
                          disabled={bloque}
                          title={bloque ? "Ouvre la caisse pour encaisser en espèces" : ""}
                          onClick={() => setMethode(m.id)}
                          className={`min-h-[44px] rounded-full border px-4 text-sm disabled:opacity-40 ${
                            methode === m.id
                              ? "border-pos-ink bg-pos-ink text-pos-bg"
                              : "border-pos-border bg-pos-surface"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  {especesBloquees && (
                    <p className="mt-1 text-xs text-pos-warn">
                      La caisse est fermée : ouvre-la, ou choisis Carte ou Virement.
                    </p>
                  )}

                  {erreur && <p className="mt-3 text-sm text-pos-danger">{erreur}</p>}

                  <button
                    type="button"
                    onClick={encaisser}
                    disabled={!montantValide || especesBloquees || envoi}
                    className="mt-4 min-h-[48px] w-full rounded bg-pos-accent px-4 font-semibold text-white disabled:opacity-40"
                  >
                    {envoi
                      ? "Enregistrement…"
                      : `Encaisser ${montantValide ? dt(fromMillimes(montantM)) : ""}`.trim()}
                  </button>
                </>
              )}

              {lienWhatsapp ? (
                <a
                  href={lienWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded border border-pos-border text-sm font-medium"
                >
                  Rappel gentil par WhatsApp
                </a>
              ) : (
                <p className="mt-3 text-xs text-pos-ink-3">Pas de numéro WhatsApp pour cette cliente.</p>
              )}

              {peutEffacer && (
                <div className="mt-5 border-t border-pos-border pt-4">
                  {!effacement ? (
                    <button
                      type="button"
                      onClick={() => setEffacement({ motif: "" })}
                      className="min-h-[44px] text-sm text-pos-danger underline"
                    >
                      Effacer la dette
                    </button>
                  ) : (
                    <div className="rounded border border-pos-danger bg-pos-danger-soft p-3 text-sm">
                      <p className="font-semibold">
                        Effacer {dt(choisie.totalDu)} de dette {deNom(nomCliente(choisie.customer))} ?
                        Ce n&apos;est pas réversible.
                      </p>
                      <label htmlFor="motif-effacement" className="mt-2 block text-xs">
                        Pourquoi ? (obligatoire)
                      </label>
                      <textarea
                        id="motif-effacement"
                        value={effacement.motif}
                        onChange={(e) => setEffacement({ motif: e.target.value })}
                        rows={2}
                        maxLength={500}
                        className="mt-1 w-full rounded border border-pos-border bg-pos-surface px-2 py-1"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEffacement(null)}
                          className="min-h-[44px] px-3"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={effacer}
                          disabled={effacement.motif.trim().length < MOTIF_EFFACEMENT_MIN || envoi}
                          className="min-h-[44px] rounded bg-pos-danger px-4 font-semibold text-white disabled:opacity-40"
                        >
                          Effacer la dette
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {recu && <ReglementCreditPrintFrame data={recu} />}
    </div>
  );
}

function Tuile({ titre, valeur, danger }: { titre: string; valeur: string; danger?: boolean }) {
  return (
    <div
      className={`rounded border p-4 ${
        danger ? "border-pos-danger-soft bg-pos-danger-soft" : "border-pos-border bg-pos-surface"
      }`}
    >
      <p className={`text-xs ${danger ? "text-pos-danger" : "text-pos-ink-3"}`}>{titre}</p>
      <p className="mt-1 pos-mono text-2xl font-semibold">{valeur}</p>
    </div>
  );
}
