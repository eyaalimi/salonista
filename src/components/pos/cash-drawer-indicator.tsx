"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDT } from "@/lib/money";
import {
  CATEGORIES_DEPENSE,
  libelleCategorieDepense,
  lireMontant,
  refusDepense,
  type CategorieDepense,
} from "@/lib/depense-caisse";

type Summary = {
  sessionId: string;
  openingFloat: string;
  cashSalesTotal: string;
  cashRefundsTotal: string;
  /** Deja soustrait de `expectedCash` par le serveur (`computeSummary`). */
  expensesTotal: string;
  expectedCash: string;
};

type Session = {
  id: string;
  status: string;
  openedAt: string;
  openingFloat?: string;
  employee?: { displayName: string };
} | null;

// `employeeName` reste dans le type pour les appelants, mais ne sert plus :
// il n'alimentait que la fenetre de depense, desormais integree a la fermeture.
export function CashDrawerIndicator({ canOpen }: { canOpen: boolean; employeeName?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/pos/cash-drawer/current", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSession(data.session);
    setSummary(data.summary ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const isOpen = session?.status === "OPEN";

  return (
    <>
      <button
        type="button"
        onClick={() => (isOpen ? setOpen(true) : canOpen ? setOpeningModal(true) : null)}
        disabled={!canOpen && !isOpen}
        className="inline-flex items-center gap-2 text-xs hover:text-white/100 shrink-0"
        title={
          isOpen && session
            ? `Caisse ouverte par ${session.employee?.displayName ?? "—"} · Fond ${formatDT(session.openingFloat ?? "0.000")}`
            : "Ouvrir la caisse"
        }
      >
        <span
          className={`h-2 w-2 rounded-full ${isOpen ? "bg-pos-accent" : "bg-pos-danger"}`}
        />
        {isOpen && session ? (
          <span className="flex items-center gap-2">
            <span className="pos-mono">
              <span className="hidden sm:inline">Caisse · </span>
              {formatDT(summary?.expectedCash ?? "0.000")}
            </span>
            <span className="hidden md:inline text-[10px] text-pos-ink-4">
              · Ouverte par {session.employee?.displayName ?? "—"} · Fond {formatDT(session.openingFloat ?? "0.000")}
            </span>
          </span>
        ) : (
          <span>
            <span className="hidden sm:inline">Ouvrir caisse</span>
            <span className="sm:hidden">Ouvrir</span>
          </span>
        )}
      </button>

      {open && session && summary && (
        <div className="fixed inset-0 z-40 flex">
          <button
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="flex-1 bg-black/30"
          />
          <aside className="w-full max-w-sm bg-creme p-6 shadow-xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="ds-display text-xl text-prune">Caisse</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="ds-focus p-2 text-prune/70 hover:text-prune"
              >
                ✕
              </button>
            </div>
            <p className="mb-1 text-sm text-prune/70">
              Ouverte le {new Date(session.openedAt).toLocaleString("fr-FR")}
            </p>
            {session.employee?.displayName && (
              <p className="mb-4 text-sm text-prune">
                Par <strong>{session.employee.displayName}</strong> · Fond{" "}
                <strong>{formatDT(session.openingFloat ?? summary.openingFloat)}</strong>
              </p>
            )}
            <dl className="space-y-2 text-sm mb-6">
              <Row label="Fond initial" value={formatDT(summary.openingFloat)} />
              <Row label="Ventes cash" value={formatDT(summary.cashSalesTotal)} />
              <Row label="Remboursements cash" value={`-${formatDT(summary.cashRefundsTotal)}`} />
              {/* Les depenses etaient deja soustraites de l'attendu, mais
                  n'apparaissaient nulle part : l'attendu semblait faux. */}
              <Row label="Dépenses" value={`-${formatDT(summary.expensesTotal)}`} />
              <Row
                label="Attendu en caisse"
                value={formatDT(summary.expectedCash)}
                emphasis
              />
            </dl>
            {/*
              UN SEUL BOUTON. « + Depense » et « Fermer la caisse » etaient
              deux gestes separes, alors qu'en fin de journee ils se suivent :
              on note ce qui est sorti du tiroir, PUIS on compte. La fermeture
              contient desormais sa section Depenses, avant le comptage.
              Une depense en cours de journee reste possible depuis la page
              Caisse.
            */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setClosingModal(true);
              }}
              className="ds-press ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] bg-rose text-base font-medium text-prune"
            >
              Fermer la caisse
            </button>
          </aside>
        </div>
      )}

      {openingModal && (
        <OpenModal
          onClose={() => setOpeningModal(false)}
          onOpened={async () => {
            setOpeningModal(false);
            await refresh();
          }}
        />
      )}

      {closingModal && session && summary && (
        <CloseModal
          sessionId={session.id}
          summary={summary}
          // Une depense ajoutee pendant la fermeture fait baisser l'attendu :
          // il faut le relire AVANT que la caissiere compte.
          onRefresh={refresh}
          onClose={() => setClosingModal(false)}
          onClosed={async () => {
            setClosingModal(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-prune/70">{label}</dt>
      {/* Le montant DOIT porter sa couleur : sans classe il heritait du
          contexte et devenait illisible sur le fond creme du panneau. */}
      <dd className={`text-prune tabular-nums ${emphasis ? "font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function OpenModal({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  // Champ VIDE au depart, pas « 0.000 ».
  //
  // La valeur pre-remplie se lisait comme un texte grise inerte, et il fallait
  // l'effacer avant de saisir son montant. Vide, le placeholder indique le
  // format attendu et disparait a la premiere frappe. Le fond reste facultatif
  // — `submit` envoie « 0.000 » si rien n'est saisi.
  const [openingFloat, setOpeningFloat] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pos/cash-drawer/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Champ laisse vide = tiroir vide. Sans ce repli, on enverrait une
        // chaine vide que le serveur refuserait.
        body: JSON.stringify({
          openingFloat: openingFloat.trim() || "0.000",
          openingNotes: openingNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      onOpened();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-creme p-6">
        <h2 className="ds-display mb-1 text-xl text-prune">Ouvrir la caisse</h2>
        <p className="mb-4 text-sm text-prune/70">
          Le montant en espèces présent dans le tiroir avant la première vente.
        </p>

        {/* Le champ n'avait NI label NI placeholder : le « 0.000 » gris venait
            du navigateur, et disparaissait des la premiere frappe — plus rien
            n'indiquait alors ce qu'on saisissait. */}
        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-prune">Fond de caisse (TND)</span>
          <input
            type="number"
            step="0.001"
            min="0"
            inputMode="decimal"
            autoFocus
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
            placeholder="0.000"
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-base text-prune placeholder:text-prune/40"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm text-prune">Notes (facultatif)</span>
          <textarea
            value={openingNotes}
            onChange={(e) => setOpeningNotes(e.target.value)}
            rows={2}
            className="ds-focus w-full rounded-[var(--radius-card)] border border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune/40"
          />
        </label>

        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-fonce">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm text-prune/70 hover:bg-creme"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-6 text-sm font-medium text-prune disabled:opacity-50"
          >
            {submitting ? "Ouverture…" : "Ouvrir"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Depense = {
  id: string;
  amount: string | number;
  reason: string;
  category: string;
  createdAt: string;
};

/**
 * La fermeture de caisse — dans l'ordre ou on la fait vraiment.
 *
 *   1. Les DEPENSES : ce qui est sorti du tiroir dans la journee.
 *   2. L'ESPECE COMPTEE : ce qui s'y trouve maintenant.
 *   3. FERMER.
 *
 * L'ordre n'est pas cosmetique. L'attendu en caisse soustrait les depenses :
 * une depense oubliee puis notee APRES le comptage produisait un ecart faux,
 * et la caissiere etait mise en cause pour de l'argent sorti legitimement.
 * Les depenses passent donc AVANT le comptage, et l'attendu affiche est
 * relu apres chaque ajout.
 *
 * Une depense ajoutee ici est ENREGISTREE tout de suite — meme si l'on
 * annule ensuite la fermeture. Le texte le dit, pour qu'on ne la ressaisisse
 * pas une seconde fois.
 */
function CloseModal({
  sessionId,
  summary,
  onRefresh,
  onClose,
  onClosed,
}: {
  sessionId: string;
  summary: Summary;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onClosed: () => void;
}) {
  const expectedCash = summary.expectedCash;

  /**
   * Champ VIDE, et pas « 0.000 ».
   *
   * Pre-remplir a zero permettait de fermer la caisse sans rien compter : on
   * validait alors un ecart egal a tout l'attendu, en croyant avoir confirme
   * un comptage. Vide, le bouton reste desactive tant qu'aucun montant n'est
   * saisi — compter est le seul geste obligatoire de cet ecran.
   */
  const [closingCount, setClosingCount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variance, setVariance] = useState<string | null>(null);

  // --- Depenses -------------------------------------------------------------
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState<CategorieDepense>("FOURNISSEUR");
  const [motif, setMotif] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreurDepense, setErreurDepense] = useState<string | null>(null);

  const chargerDepenses = useCallback(async () => {
    const res = await fetch("/api/pos/drawer/expenses", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { expenses?: Depense[] };
    setDepenses(data.expenses ?? []);
  }, []);

  // Premier chargement : la mise a jour n'arrive que dans la promesse, jamais
  // de facon synchrone dans l'effet (regle du compilateur React 19).
  useEffect(() => {
    let actif = true;
    fetch("/api/pos/drawer/expenses", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { expenses?: Depense[] } | null) => {
        if (actif && data) setDepenses(data.expenses ?? []);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  async function ajouterDepense() {
    const refus = refusDepense({ montant, motif });
    if (refus) {
      setErreurDepense(refus);
      return;
    }
    setAjoutEnCours(true);
    setErreurDepense(null);
    try {
      const res = await fetch("/api/pos/drawer/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: lireMontant(montant),
          category: categorie,
          reason: motif.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErreurDepense(d?.error ?? "Enregistrement impossible");
        return;
      }
      setMontant("");
      setMotif("");
      setAjoutOuvert(false);
      // L'attendu baisse : on le relit AVANT que la caissiere compte.
      await Promise.all([chargerDepenses(), onRefresh()]);
    } finally {
      setAjoutEnCours(false);
    }
  }

  // --- Fermeture ------------------------------------------------------------
  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/cash-drawer/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCount, closingNotes: closingNotes || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      const data = await res.json();
      setVariance(data.summary?.variance ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  if (variance !== null) {
    const v = Number(variance);
    const color = v === 0 ? "text-pos-accent" : Math.abs(v) < 5 ? "text-pos-warn" : "text-pos-danger";
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-[var(--radius-panel)] bg-creme p-6 text-center">
          <h2 className="ds-display mb-4 text-xl text-prune">Caisse fermée</h2>
          <p className="text-sm text-prune/70">Attendu</p>
          <p className="text-lg text-prune">{expectedCash} TND</p>
          <p className="mt-3 text-sm text-prune/70">Compté</p>
          <p className="text-lg text-prune">{closingCount} TND</p>
          {/* « Variance » est un mot de comptable ; l'ecran est lu par une
              caissiere en fin de journee. */}
          <p className="mt-3 text-sm text-prune/70">Écart</p>
          <p className={`text-2xl font-semibold ${color}`}>
            {v > 0 ? "+" : ""}
            {variance} TND
          </p>
          <button
            type="button"
            onClick={onClosed}
            className="ds-press ds-focus mt-6 min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-6 text-sm font-medium text-prune"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  const champ =
    "ds-focus min-h-[44px] w-full rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-base text-prune placeholder:text-prune/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fermeture-titre"
        className="my-auto w-full max-w-md rounded-[var(--radius-panel)] bg-creme p-6"
      >
        <h2 id="fermeture-titre" className="ds-display mb-4 text-xl text-prune">
          Fermer la caisse
        </h2>

        {/* 1 — DEPENSES */}
        <section aria-labelledby="fermeture-depenses" className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 id="fermeture-depenses" className="text-sm font-semibold text-prune">
              1. Dépenses de la journée
            </h3>
            <span className="text-sm tabular-nums text-prune">
              {formatDT(summary.expensesTotal)}
            </span>
          </div>

          {depenses.length === 0 ? (
            <p className="text-sm text-prune/70">Aucune dépense enregistrée.</p>
          ) : (
            <ul className="mb-2 divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-white">
              {depenses.map((d) => (
                <li key={d.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 truncate text-prune">
                    {d.reason}
                    <span className="ml-1 text-xs text-prune/70">
                      · {libelleCategorieDepense(d.category)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-prune">
                    -{formatDT(String(d.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {ajoutOuvert ? (
            <div className="mt-2 space-y-2 rounded-[var(--radius-card)] border border-hairline bg-white p-3">
              <label className="block">
                <span className="mb-1 block text-xs text-prune/70">Montant (TND)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0,000"
                  className={champ}
                />
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Catégorie">
                {CATEGORIES_DEPENSE.map((c) => {
                  const actif = categorie === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => setCategorie(c.value)}
                      className={`min-h-[36px] rounded-[var(--radius-pill)] border px-3 text-xs ${
                        actif
                          ? "border-prune bg-prune text-creme"
                          : "border-hairline bg-white text-prune/80 hover:border-prune"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-prune/70">Motif</span>
                <input
                  type="text"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex : livraison de shampoings"
                  className={champ}
                />
              </label>
              {erreurDepense && (
                <p role="alert" className="text-sm text-rose-fonce">
                  {erreurDepense}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAjoutOuvert(false);
                    setErreurDepense(null);
                  }}
                  className="ds-focus min-h-[44px] px-3 text-sm text-prune/70 hover:text-prune"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={ajouterDepense}
                  disabled={ajoutEnCours}
                  className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-prune bg-white px-4 text-sm font-medium text-prune disabled:opacity-50"
                >
                  {ajoutEnCours ? "Ajout…" : "Ajouter la dépense"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAjoutOuvert(true)}
              className="ds-press ds-focus mt-1 min-h-[44px] w-full rounded-[var(--radius-pill)] border border-hairline bg-white text-sm text-prune hover:border-prune"
            >
              + Ajouter une dépense
            </button>
          )}
          <p className="mt-1.5 text-[11px] text-prune/60">
            Une dépense ajoutée est enregistrée tout de suite, même si vous
            annulez la fermeture.
          </p>
        </section>

        {/* 2 — ESPECES COMPTEES */}
        <section aria-labelledby="fermeture-compte" className="mb-4 border-t border-hairline pt-4">
          <h3 id="fermeture-compte" className="mb-2 text-sm font-semibold text-prune">
            2. Espèces comptées
          </h3>
          <p className="mb-2 text-sm text-prune/70">
            Attendu dans le tiroir :{" "}
            <strong className="tabular-nums text-prune">{formatDT(expectedCash)}</strong>
          </p>
          <label className="mb-3 block">
            <span className="sr-only">Espèces comptées (TND)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={closingCount}
              onChange={(e) => setClosingCount(e.target.value)}
              placeholder="Montant compté, en TND"
              className={champ}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-prune">
              Notes — obligatoires si l&apos;écart atteint 5 TND
            </span>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={2}
              className="ds-focus w-full rounded-[var(--radius-card)] border border-hairline bg-white px-4 py-3 text-base text-prune placeholder:text-prune/40"
            />
          </label>
        </section>

        {error && (
          <p role="alert" className="mb-3 text-sm text-rose-fonce">
            {error}
          </p>
        )}

        {/* 3 — FERMER */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm text-prune/70 hover:bg-creme"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || closingCount.trim() === ""}
            className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-6 text-sm font-medium text-prune disabled:opacity-50"
          >
            {submitting ? "Fermeture…" : "Fermer la caisse"}
          </button>
        </div>
      </div>
    </div>
  );
}
