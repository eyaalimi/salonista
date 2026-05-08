"use client";

import { useEffect, useState } from "react";
import { formatDT, fromMillimes } from "@/lib/money";

type Tab = "settings" | "wallets" | "stats";

type Program = {
  id: string;
  pointsPerDinar: string;
  dinarPerPoint: string;
  cashbackPct: string;
  minPointsToRedeem: number;
  maxRedemptionPctPerSale: number;
  eligibleOn: "SERVICES_ONLY" | "PRODUCTS_ONLY" | "BOTH";
  inactivityExpireMonths: number | null;
  welcomeBonusPoints: number;
  birthdayBonusPoints: number;
  active: boolean;
  displayName: string | null;
};

export function FideliteClient() {
  const [tab, setTab] = useState<Tab>("settings");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="luxury-badge mb-2">Fidélité</p>
          <h1 className="luxury-heading text-3xl text-brand-ink">Programme de fidélité</h1>
        </div>
      </div>

      <div className="flex gap-2 border-b border-brand-line mb-6">
        {(["settings", "wallets", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs uppercase tracking-[0.18em] border-b-2 ${
              tab === t
                ? "border-brand-gold text-brand-ink"
                : "border-transparent text-brand-ink-soft hover:text-brand-ink"
            }`}
          >
            {t === "settings" ? "Paramètres" : t === "wallets" ? "Cartes clients" : "Statistiques"}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab />}
      {tab === "wallets" && <WalletsTab />}
      {tab === "stats" && <StatsTab />}
    </div>
  );
}

function SettingsTab() {
  const [program, setProgram] = useState<Program | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/rewards/program")
      .then((r) => r.json())
      .then((p) => setProgram(p));
  }, []);

  async function save() {
    if (!program) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      minPointsToRedeem: program.minPointsToRedeem,
      maxRedemptionPctPerSale: program.maxRedemptionPctPerSale,
      eligibleOn: program.eligibleOn,
      inactivityExpireMonths: program.inactivityExpireMonths,
      welcomeBonusPoints: program.welcomeBonusPoints,
      birthdayBonusPoints: program.birthdayBonusPoints,
      active: program.active,
      displayName: program.displayName,
    };
    if (showAdvanced) {
      body.pointsPerDinar = program.pointsPerDinar;
      body.dinarPerPoint = program.dinarPerPoint;
    } else {
      body.cashbackPct = Number(program.cashbackPct);
    }
    const res = await fetch("/api/rewards/program", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setProgram(updated);
      setSavedAt(new Date());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur");
    }
    setSaving(false);
  }

  if (!program) return <p className="text-sm text-brand-ink-soft">Chargement…</p>;

  const pct = Number(program.cashbackPct);
  const dpp = Number(program.dinarPerPoint);
  const previewPoints = Math.floor(100 * Number(program.pointsPerDinar));
  const previewValue = previewPoints * dpp;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4 bg-white border border-brand-line p-6 rounded-2xl">
        <Field label="Nom du programme">
          <input
            type="text"
            value={program.displayName ?? ""}
            onChange={(e) => setProgram({ ...program, displayName: e.target.value })}
            className="w-full rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Programme actif">
          <input
            type="checkbox"
            checked={program.active}
            onChange={(e) => setProgram({ ...program, active: e.target.checked })}
          />
        </Field>

        {!showAdvanced ? (
          <Field label="Taux de cashback (%)">
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              value={pct}
              onChange={(e) =>
                setProgram({
                  ...program,
                  cashbackPct: e.target.value,
                  pointsPerDinar: Number(e.target.value).toFixed(3),
                  dinarPerPoint: "0.010",
                })
              }
              className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
            />
          </Field>
        ) : (
          <>
            <Field label="Points par dinar">
              <input
                type="number"
                step="0.001"
                min="0"
                value={program.pointsPerDinar}
                onChange={(e) =>
                  setProgram({ ...program, pointsPerDinar: e.target.value })
                }
                className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Dinar par point">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={program.dinarPerPoint}
                onChange={(e) =>
                  setProgram({ ...program, dinarPerPoint: e.target.value })
                }
                className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
              />
            </Field>
          </>
        )}
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-xs text-brand-ink-soft hover:text-brand-ink"
        >
          {showAdvanced ? "← Mode simple (cashback %)" : "Avancé : éditer les ratios →"}
        </button>

        <Field label="Éligibilité des points">
          <select
            value={program.eligibleOn}
            onChange={(e) =>
              setProgram({ ...program, eligibleOn: e.target.value as Program["eligibleOn"] })
            }
            className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
          >
            <option value="BOTH">Services et produits</option>
            <option value="SERVICES_ONLY">Services uniquement</option>
            <option value="PRODUCTS_ONLY">Produits uniquement</option>
          </select>
        </Field>
        <Field label="Minimum de points pour échanger">
          <input
            type="number"
            min="0"
            value={program.minPointsToRedeem}
            onChange={(e) =>
              setProgram({ ...program, minPointsToRedeem: Number(e.target.value) })
            }
            className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label={`Maximum payable en points (${program.maxRedemptionPctPerSale}%)`}>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={program.maxRedemptionPctPerSale}
            onChange={(e) =>
              setProgram({ ...program, maxRedemptionPctPerSale: Number(e.target.value) })
            }
            className="w-full"
          />
        </Field>
        <Field label="Bonus de bienvenue">
          <input
            type="number"
            min="0"
            value={program.welcomeBonusPoints}
            onChange={(e) =>
              setProgram({ ...program, welcomeBonusPoints: Number(e.target.value) })
            }
            className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Bonus anniversaire">
          <input
            type="number"
            min="0"
            value={program.birthdayBonusPoints}
            onChange={(e) =>
              setProgram({ ...program, birthdayBonusPoints: Number(e.target.value) })
            }
            className="w-32 rounded border border-brand-line bg-white px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Inactivité avant expiration">
          <select
            value={program.inactivityExpireMonths ?? ""}
            onChange={(e) =>
              setProgram({
                ...program,
                inactivityExpireMonths: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="rounded border border-brand-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Jamais</option>
            <option value="6">6 mois</option>
            <option value="12">12 mois</option>
            <option value="18">18 mois</option>
            <option value="24">24 mois</option>
          </select>
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand-ink px-6 py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          {savedAt && (
            <p className="text-xs text-emerald-700">Enregistré à {savedAt.toLocaleTimeString("fr-FR")}</p>
          )}
        </div>
      </div>

      <div className="bg-brand-sand border border-brand-gold-soft p-6 rounded-2xl space-y-3 text-sm">
        <p className="luxury-badge">Aperçu</p>
        <p className="text-brand-ink">
          Pour un achat de <strong>100 DT</strong>, votre client gagnera environ{" "}
          <strong>{previewPoints} points</strong> (≈ {formatDT(fromMillimes(Math.round(previewValue * 1000)))}).
        </p>
        <p className="text-brand-ink">
          Pour échanger, il devra avoir au moins <strong>{program.minPointsToRedeem} points</strong> (≈{" "}
          {formatDT(fromMillimes(Math.round(program.minPointsToRedeem * dpp * 1000)))}).
        </p>
        <p className="text-brand-ink">
          Sur une vente, il pourra payer au maximum{" "}
          <strong>{program.maxRedemptionPctPerSale}%</strong> avec ses points.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-[0.18em] text-brand-ink-soft mb-1">{label}</span>
      {children}
    </label>
  );
}

function WalletsTab() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<
    Array<{
      id: string;
      balance: number;
      lifetimeEarned: number;
      lifetimeRedeemed: number;
      lastActivityAt: string;
      customer: { firstName: string | null; lastName: string | null; phone: string };
    }>
  >([]);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/rewards/wallets?search=${encodeURIComponent(search)}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
  }
  useEffect(() => {
    load();
  }, [search]);

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border border-brand-line bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="bg-white border border-brand-line rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-sand text-xs uppercase tracking-[0.18em] text-brand-ink-soft">
            <tr>
              <th className="text-left p-3">Client</th>
              <th className="text-right p-3">Solde</th>
              <th className="text-right p-3">Gagné</th>
              <th className="text-right p-3">Échangé</th>
              <th className="text-right p-3">Dernière activité</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-brand-ink-soft">
                  Aucune carte trouvée.
                </td>
              </tr>
            )}
            {items.map((w) => (
              <tr key={w.id} className="border-t border-brand-line">
                <td className="p-3">
                  <p className="font-medium">
                    {w.customer.firstName ?? ""} {w.customer.lastName ?? ""}
                  </p>
                  <p className="text-xs text-brand-ink-soft">{w.customer.phone}</p>
                </td>
                <td className="p-3 text-right font-semibold">{w.balance} pts</td>
                <td className="p-3 text-right">{w.lifetimeEarned}</td>
                <td className="p-3 text-right">{w.lifetimeRedeemed}</td>
                <td className="p-3 text-right text-xs text-brand-ink-soft">
                  {new Date(w.lastActivityAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => setOpenId(w.id)}
                    className="text-xs uppercase tracking-[0.18em] text-brand-gold hover:text-brand-ink"
                  >
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openId && (
        <WalletDrawer
          walletId={openId}
          onClose={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function WalletDrawer({ walletId, onClose }: { walletId: string; onClose: () => void }) {
  const [data, setData] = useState<{
    id: string;
    balance: number;
    lifetimeEarned: number;
    lifetimeRedeemed: number;
    customer: { firstName: string | null; lastName: string | null; phone: string };
    transactions: {
      items: Array<{
        id: string;
        delta: number;
        balanceAfter: number;
        reason: string;
        createdAt: string;
        note: string | null;
        sale: { receiptNumber: string } | null;
      }>;
    };
  } | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/rewards/wallets/${walletId}`);
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
  }, [walletId]);

  async function submitAdjust() {
    setAdjusting(true);
    setErr(null);
    const res = await fetch(`/api/rewards/wallets/${walletId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta: Number(delta), note }),
    });
    if (res.ok) {
      setShowAdjust(false);
      setDelta("");
      setNote("");
      await load();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erreur");
    }
    setAdjusting(false);
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
        <div className="w-full max-w-md bg-brand-cream p-6">
          <p className="text-sm text-brand-ink-soft">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="w-full max-w-md bg-brand-cream p-6 overflow-y-auto">
        <div className="flex justify-between mb-4">
          <p className="luxury-badge">Carte fidélité</p>
          <button onClick={onClose} className="text-brand-ink-soft hover:text-brand-ink">✕</button>
        </div>
        <h2 className="luxury-heading text-2xl text-brand-ink mb-1">
          {data.customer.firstName} {data.customer.lastName}
        </h2>
        <p className="text-xs text-brand-ink-soft mb-6">{data.customer.phone}</p>

        <div className="rounded-2xl bg-brand-gold-soft/50 border border-brand-gold p-6 mb-4 text-center">
          <p className="luxury-heading text-4xl text-brand-ink">{data.balance} pts</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div>
            <p className="text-xs uppercase text-brand-ink-soft">Total gagné</p>
            <p className="font-semibold">{data.lifetimeEarned} pts</p>
          </div>
          <div>
            <p className="text-xs uppercase text-brand-ink-soft">Total échangé</p>
            <p className="font-semibold">{data.lifetimeRedeemed} pts</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdjust((s) => !s)}
          className="mb-4 w-full rounded-lg border border-brand-line bg-white py-2 text-xs uppercase tracking-[0.18em] hover:border-brand-gold"
        >
          {showAdjust ? "Annuler" : "Ajuster le solde"}
        </button>

        {showAdjust && (
          <div className="bg-white border border-brand-line rounded-lg p-3 mb-4 space-y-2">
            <input
              type="number"
              step="1"
              placeholder="Variation (ex: +50 ou -100)"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="w-full rounded border border-brand-line px-2 py-1 text-sm"
            />
            <textarea
              placeholder="Note (obligatoire)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-brand-line px-2 py-1 text-sm"
              rows={2}
            />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button
              type="button"
              onClick={submitAdjust}
              disabled={!delta || !note || adjusting}
              className="w-full rounded-lg bg-brand-ink py-2 text-xs uppercase tracking-[0.18em] text-brand-cream disabled:opacity-40"
            >
              Confirmer
            </button>
          </div>
        )}

        <p className="luxury-badge mb-2">Historique</p>
        <ul className="space-y-2">
          {data.transactions.items.map((t) => (
            <li key={t.id} className="rounded border border-brand-line bg-white p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-xs uppercase text-brand-ink-soft">{REASON_LABELS[t.reason] ?? t.reason}</span>
                <span className={t.delta < 0 ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"}>
                  {t.delta > 0 ? "+" : ""}
                  {t.delta} pts
                </span>
              </div>
              <p className="text-xs text-brand-ink-soft mt-1">
                {new Date(t.createdAt).toLocaleString("fr-FR")} · solde après: {t.balanceAfter} pts
                {t.sale && ` · Reçu ${t.sale.receiptNumber}`}
              </p>
              {t.note && <p className="text-xs text-brand-ink mt-1">« {t.note} »</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const REASON_LABELS: Record<string, string> = {
  EARN_PURCHASE: "Achat",
  REDEEM_PURCHASE: "Échange",
  WELCOME_BONUS: "Bienvenue",
  BIRTHDAY_BONUS: "Anniversaire",
  MANUAL_ADJUSTMENT: "Ajustement",
  EXPIRATION: "Expiration",
  REFUND_REVERSAL: "Remboursement",
};

function StatsTab() {
  const [data, setData] = useState<{
    liability: { pointsInCirculation: number; valueDT: string; activeCards: number };
    engagement: { earned: number; redeemed: number; redemptionRate: number };
    bonuses: {
      welcome: { count: number; points: number };
      birthday: { count: number; points: number };
    };
    topEarners: Array<{
      id: string;
      customer: { firstName: string | null; lastName: string | null; phone: string };
      lifetimeEarned: number;
      lifetimeRedeemed: number;
      balance: number;
      lastActivityAt: string;
    }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/rewards/stats")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="text-sm text-brand-ink-soft">Chargement…</p>;

  return (
    <div className="space-y-6">
      <Section title="Engagement (30 derniers jours)">
        <Tile label="Points en circulation" value={`${data.liability.pointsInCirculation} pts`} sub={`≈ ${formatDT(data.liability.valueDT)}`} />
        <Tile label="Cartes actives" value={data.liability.activeCards} />
        <Tile label="Points gagnés" value={data.engagement.earned} />
        <Tile label="Points échangés" value={data.engagement.redeemed} />
        <Tile label="Taux de rachat" value={`${data.engagement.redemptionRate}%`} />
      </Section>

      <Section title="Bonus distribués (depuis le début)">
        <Tile label="Bonus de bienvenue" value={data.bonuses.welcome.count} sub={`${data.bonuses.welcome.points} pts`} />
        <Tile label="Bonus anniversaire" value={data.bonuses.birthday.count} sub={`${data.bonuses.birthday.points} pts`} />
      </Section>

      <div className="bg-white border border-brand-line rounded-2xl p-4">
        <p className="luxury-badge mb-4">Top 10 clients</p>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft">
            <tr>
              <th className="text-left p-2">Client</th>
              <th className="text-right p-2">Gagné</th>
              <th className="text-right p-2">Échangé</th>
              <th className="text-right p-2">Solde</th>
            </tr>
          </thead>
          <tbody>
            {data.topEarners.map((c) => (
              <tr key={c.id} className="border-t border-brand-line">
                <td className="p-2">
                  {c.customer.firstName} {c.customer.lastName}
                  <br />
                  <span className="text-xs text-brand-ink-soft">{c.customer.phone}</span>
                </td>
                <td className="p-2 text-right">{c.lifetimeEarned}</td>
                <td className="p-2 text-right">{c.lifetimeRedeemed}</td>
                <td className="p-2 text-right font-semibold">{c.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="luxury-badge mb-3">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{children}</div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-brand-line p-4 rounded-2xl">
      <p className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft mb-1">{label}</p>
      <p className="luxury-heading text-2xl text-brand-ink">{value}</p>
      {sub && <p className="text-xs text-brand-ink-soft mt-1">{sub}</p>}
    </div>
  );
}

