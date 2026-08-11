"use client";

import { useEffect, useState } from "react";
import { Star, Plus, Minus, Search, Trophy, MessageCircle } from "lucide-react";

type Program = {
  id: string;
  active: boolean;
  cashbackPct: string;
  pointsPerDinar: string;
  dinarPerPoint: string;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  displayName: string | null;
  whatsappMessage: string | null;
};

type TopItem = {
  rank: number;
  walletId: string;
  balance: number;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
};

type Wallet = {
  id: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastActivityAt: string | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
  };
};

export function LoyaltyClient({ canEditSettings }: { canEditSettings: boolean }) {
  const [program, setProgram] = useState<Program | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [top, setTop] = useState<TopItem[]>([]);
  const [moduleActive, setModuleActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<Wallet | null>(null);

  async function loadProgram() {
    const res = await fetch("/api/rewards/program");
    if (res.status === 403) {
      setModuleActive(false);
      return;
    }
    if (res.ok) {
      setProgram(await res.json());
    }
  }

  async function loadWallets() {
    const url = `/api/rewards/wallets?pageSize=50${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }`;
    const res = await fetch(url);
    if (res.status === 403) {
      setModuleActive(false);
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as { items?: Wallet[]; wallets?: Wallet[] };
      // API returns { items: [...] }; older code expected { wallets: [...] }.
      setWallets(data.items ?? data.wallets ?? []);
    }
  }

  async function loadTop() {
    const res = await fetch("/api/rewards/top?limit=10");
    if (res.ok) {
      const data = (await res.json()) as { items: TopItem[] };
      setTop(data.items);
    }
  }

  useEffect(() => {
    (async () => {
      await loadProgram();
      await Promise.all([loadWallets(), loadTop()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadWallets();
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  if (loading) {
    return <p className="p-6 text-sm text-pos-ink-3">Chargement…</p>;
  }

  if (!moduleActive) {
    return (
      <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-pos-ink mb-2">Fidélité</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          Le module Fidélité n&apos;est pas activé pour votre salon. Contactez Salonista pour
          l&apos;activer.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto md:p-6 p-4 max-w-6xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h1 className="md:text-2xl text-xl font-semibold text-pos-ink">Programme de fidélité</h1>
        <p className="text-xs md:text-sm text-pos-ink-3 mt-1">
          Configurez le cashback et gérez les soldes de points de vos clientes.
        </p>
      </div>

      {program && <ProgramCard program={program} canEdit={canEditSettings} onSaved={loadProgram} />}

      <div className="mt-6 md:mt-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 md:gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-pos-ink">Portefeuilles clientes</h2>
            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pos-ink-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou téléphone…"
                className="w-full text-sm bg-white border border-pos-border rounded pl-8 pr-2 py-1.5"
              />
            </div>
          </div>

          {wallets.length === 0 ? (
            <p className="text-sm text-pos-ink-3 text-center py-12">
              Aucun portefeuille pour le moment.
            </p>
          ) : (
            <div className="bg-white border border-pos-border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-pos-bg border-b border-pos-border">
                <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium text-right">Solde</th>
                  <th className="px-4 py-3 font-medium text-right">Gagnés (vie)</th>
                  <th className="px-4 py-3 font-medium text-right">Utilisés (vie)</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-pos-border last:border-0 hover:bg-pos-highlight/50"
                  >
                    <td className="px-4 py-3 text-pos-ink">
                      <div className="font-medium">
                        {w.customer.firstName} {w.customer.lastName}
                      </div>
                      <div className="text-xs text-pos-ink-3 pos-mono">{w.customer.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 pos-mono font-semibold text-pos-ink">
                        <Star size={12} className="text-amber-500" />
                        {w.balance}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right pos-mono text-pos-ink-2">
                      {w.lifetimeEarned}
                    </td>
                    <td className="px-4 py-3 text-right pos-mono text-pos-ink-2">
                      {w.lifetimeRedeemed}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setAdjustTarget(w)}
                        className="text-xs px-2 py-1 border border-pos-border rounded hover:bg-pos-highlight"
                      >
                        Ajuster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Top 10 fidèles — right column */}
        <TopFidelesWidget items={top} />
      </div>

      {adjustTarget && (
        <AdjustModal
          wallet={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onDone={async () => {
            setAdjustTarget(null);
            await loadWallets();
          }}
        />
      )}
    </div>
  );
}

function TopFidelesWidget({ items }: { items: TopItem[] }) {
  return (
    <aside className="bg-white border border-pos-border rounded-lg p-4 h-fit">
      <h3 className="text-sm font-semibold text-pos-ink flex items-center gap-1.5 mb-3">
        <Trophy size={14} className="text-amber-500" /> Top 10 fidèles
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-pos-ink-3 py-4 text-center">
          Aucune cliente avec des points.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it) => {
            const name =
              `${it.customer.firstName ?? ""} ${it.customer.lastName ?? ""}`.trim() ||
              it.customer.phone;
            return (
              <li
                key={it.walletId}
                className="flex items-center justify-between gap-2 py-1 border-b border-pos-border/60 last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-pos-ink-3 pos-mono w-5 shrink-0">
                    {it.rank}.
                  </span>
                  <span className="text-sm text-pos-ink truncate">{name}</span>
                </div>
                <span className="pos-mono text-sm font-semibold text-pos-ink shrink-0">
                  {it.balance} pts
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

function ProgramCard({
  program,
  canEdit,
  onSaved,
}: {
  program: Program;
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    active: program.active,
    cashbackPct: program.cashbackPct,
    minPointsToRedeem: program.minPointsToRedeem,
    maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
    welcomeBonusPoints: program.welcomeBonusPoints,
    birthdayBonusPoints: program.birthdayBonusPoints,
    whatsappMessage:
      program.whatsappMessage ??
      "Bonjour {name} 💖 Merci pour votre visite ! Vous avez gagné {earned} points. Solde total : {balance} points.",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rewards/program", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: form.active,
          cashbackPct: Number(form.cashbackPct),
          minPointsToRedeem: form.minPointsToRedeem,
          maxRedemptionPctPerSale: form.maxRedemptionPctPerSale,
          welcomeBonusPoints: form.welcomeBonusPoints,
          birthdayBonusPoints: form.birthdayBonusPoints,
          whatsappMessage: form.whatsappMessage.trim() || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Erreur");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-pos-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-pos-ink">Configuration du programme</h2>
          <p className="text-xs text-pos-ink-3 mt-1">
            {program.active ? "Programme actif" : "Programme désactivé"}
          </p>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 border border-pos-border rounded text-sm hover:bg-pos-highlight"
          >
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-4">
          <label className="block col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm text-pos-ink">Programme actif</span>
          </label>
          <label className="block">
            <span className="text-xs text-pos-ink-2">Cashback (%)</span>
            <input
              type="number"
              step="0.1"
              value={form.cashbackPct}
              onChange={(e) => setForm({ ...form, cashbackPct: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
            <span className="text-[10px] text-pos-ink-3">
              ex. 3% = 3 pts par DT dépensé, 100 pts = 1 DT
            </span>
          </label>
          <label className="block">
            <span className="text-xs text-pos-ink-2">Min. points pour échanger</span>
            <input
              type="number"
              value={form.minPointsToRedeem}
              onChange={(e) => setForm({ ...form, minPointsToRedeem: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-pos-ink-2">Max. réduction par vente (%)</span>
            <input
              type="number"
              value={form.maxRedemptionPctPerSale}
              onChange={(e) =>
                setForm({ ...form, maxRedemptionPctPerSale: Number(e.target.value) })
              }
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-pos-ink-2">Bonus de bienvenue (pts)</span>
            <input
              type="number"
              value={form.welcomeBonusPoints}
              onChange={(e) => setForm({ ...form, welcomeBonusPoints: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-pos-ink-2">Bonus anniversaire (pts)</span>
            <input
              type="number"
              value={form.birthdayBonusPoints}
              onChange={(e) => setForm({ ...form, birthdayBonusPoints: Number(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
          </label>

          <label className="block col-span-2">
            <span className="text-xs text-pos-ink-2 font-semibold flex items-center gap-1">
              <MessageCircle size={12} className="text-emerald-600" /> Message WhatsApp
            </span>
            <textarea
              value={form.whatsappMessage}
              onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Bonjour {name} 💖 Merci pour votre visite ! Vous avez gagné {earned} points. Solde total : {balance} points."
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm resize-y focus:border-pos-accent focus:outline-none"
            />
            <span className="text-[10px] text-pos-ink-3 mt-0.5 block">
              Variables disponibles : <code className="pos-mono">{"{name}"}</code>,{" "}
              <code className="pos-mono">{"{earned}"}</code>,{" "}
              <code className="pos-mono">{"{balance}"}</code>. Laisser vide pour désactiver.
            </span>
          </label>

          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-4 py-2 bg-pos-accent text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-pos-ink-3">Cashback</dt>
            <dd className="text-pos-ink pos-mono font-semibold">{program.cashbackPct}%</dd>
          </div>
          <div>
            <dt className="text-xs text-pos-ink-3">Min. points pour échanger</dt>
            <dd className="text-pos-ink pos-mono">{program.minPointsToRedeem}</dd>
          </div>
          <div>
            <dt className="text-xs text-pos-ink-3">Max. réduction / vente</dt>
            <dd className="text-pos-ink pos-mono">{program.maxRedemptionPctPerSale}%</dd>
          </div>
          <div>
            <dt className="text-xs text-pos-ink-3">Bonus bienvenue / anniversaire</dt>
            <dd className="text-pos-ink pos-mono">
              {program.welcomeBonusPoints} / {program.birthdayBonusPoints} pts
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-pos-ink-3 flex items-center gap-1">
              <MessageCircle size={11} className="text-emerald-600" /> Message WhatsApp
            </dt>
            <dd className="text-pos-ink text-xs mt-0.5 italic">
              {program.whatsappMessage ?? "Non configuré"}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function AdjustModal({
  wallet,
  onClose,
  onDone,
}: {
  wallet: Wallet;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (delta === 0) {
      setError("Indiquez un nombre de points (+ ou −).");
      return;
    }
    if (!note.trim()) {
      setError("Indiquez un motif.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rewards/wallets/${wallet.id}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, note: note.trim() }),
      });
      if (res.ok) {
        await onDone();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Erreur");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-pos-ink mb-1">Ajuster les points</h2>
        <p className="text-sm text-pos-ink-3 mb-4">
          {wallet.customer.firstName} {wallet.customer.lastName} —{" "}
          <span className="pos-mono">{wallet.balance} pts</span>
        </p>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDelta((d) => d - 10)}
            className="p-2 border border-pos-border rounded"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            className="flex-1 px-3 py-2 border border-pos-border rounded text-center text-lg pos-mono"
          />
          <button
            type="button"
            onClick={() => setDelta((d) => d + 10)}
            className="p-2 border border-pos-border rounded"
          >
            <Plus size={14} />
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-pos-ink-2">Motif *</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: rattrapage erreur de caisse"
            className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 bg-pos-accent text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {busy ? "…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
