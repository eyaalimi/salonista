"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDT } from "@/lib/money";
import { ExpenseModal } from "./expense-modal";

type Summary = {
  sessionId: string;
  openingFloat: string;
  cashSalesTotal: string;
  cashRefundsTotal: string;
  expectedCash: string;
};

type Session = {
  id: string;
  status: string;
  openedAt: string;
  openingFloat?: string;
  employee?: { displayName: string };
} | null;

export function CashDrawerIndicator({ canOpen, employeeName }: { canOpen: boolean; employeeName?: string }) {
  const [session, setSession] = useState<Session>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);
  const [openingModal, setOpeningModal] = useState(false);
  const [closingModal, setClosingModal] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);

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
        className="inline-flex items-center gap-2 text-xs hover:text-white/100"
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
              <Row
                label="Attendu en caisse"
                value={formatDT(summary.expectedCash)}
                emphasis
              />
            </dl>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setExpenseModalOpen(true);
              }}
              className="ds-press ds-focus mb-3 min-h-[48px] w-full rounded-[var(--radius-pill)] border border-hairline bg-white text-base text-prune hover:border-rose"
            >
              + Dépense
            </button>
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

      {expenseModalOpen && (
        <ExpenseModal
          employeeName={employeeName ?? "Employé"}
          onClose={() => setExpenseModalOpen(false)}
          onCreated={async () => {
            await refresh();
          }}
        />
      )}

      {closingModal && session && summary && (
        <CloseModal
          sessionId={session.id}
          expectedCash={summary.expectedCash}
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

function CloseModal({
  sessionId,
  expectedCash,
  onClose,
  onClosed,
}: {
  sessionId: string;
  expectedCash: string;
  onClose: () => void;
  onClosed: () => void;
}) {
  /**
   * Champ VIDE, et pas « 0.000 ».
   *
   * Pre-remplir a zero permettait de fermer la caisse sans rien compter : on
   * validait alors un ecart egal a tout l'attendu, en croyant avoir confirme
   * un comptage. Vide, le bouton reste desactive tant qu'aucun montant n'est
   * saisi — compter est le seul geste de cet ecran.
   */
  const [closingCount, setClosingCount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variance, setVariance] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] bg-creme p-6">
        <h2 className="ds-display mb-1 text-xl text-prune">Fermer la caisse</h2>
        <p className="mb-4 text-sm text-prune/70">
          Attendu dans le tiroir : {expectedCash} TND
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-sm text-prune">
            Espèces comptées (TND)
          </span>
          <input
            type="number"
            step="0.001"
            min="0"
            inputMode="decimal"
            autoFocus
            value={closingCount}
            onChange={(e) => setClosingCount(e.target.value)}
            placeholder="0.000"
            className="ds-focus min-h-[48px] w-full rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-base text-prune placeholder:text-prune/40"
          />
        </label>

        <label className="mb-4 block">
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
            disabled={submitting || closingCount.trim() === ""}
            className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] bg-rose px-6 text-sm font-medium text-prune disabled:opacity-50"
          >
            {submitting ? "Fermeture…" : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}
