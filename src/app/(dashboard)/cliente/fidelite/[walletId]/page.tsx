"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatDT, fromMillimes } from "@/lib/money";

type Detail = {
  id: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  lastActivityAt: string;
  provider: { id: string; salonName: string; city: string | null; photo: string | null };
  program: {
    pointsPerDinar: string;
    dinarPerPoint: string;
    minPointsToRedeem: number;
    maxRedemptionPctPerSale: number;
    inactivityExpireMonths: number | null;
  };
  transactions: {
    page: number;
    pageSize: number;
    total: number;
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
};

const REASON_LABELS: Record<string, string> = {
  EARN_PURCHASE: "Achat",
  REDEEM_PURCHASE: "Échange",
  WELCOME_BONUS: "Bonus de bienvenue",
  BIRTHDAY_BONUS: "Bonus anniversaire",
  MANUAL_ADJUSTMENT: "Ajustement",
  EXPIRATION: "Expiration",
  REFUND_REVERSAL: "Remboursement",
};

export default function WalletDetailPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = use(params);
  const [data, setData] = useState<Detail | null>(null);

  useEffect(() => {
    fetch(`/api/cliente/fidelite/${walletId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [walletId]);

  if (!data) return <p className="p-6 text-base text-prune-soft">Chargement…</p>;

  const dpp = Number(data.program.dinarPerPoint);
  const valueM = Math.round(data.balance * dpp * 1000);
  const ppd = Number(data.program.pointsPerDinar);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        href="/cliente/fidelite"
        className="ds-press ds-focus mb-4 inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] text-base font-semibold text-prune-soft hover:text-rose"
      >
        ← Mes cartes
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-2xl font-bold text-prune">
          {data.provider.salonName.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="ds-display truncate text-2xl text-prune">{data.provider.salonName}</h1>
          {data.provider.city && (
            <p className="text-base text-prune-soft">{data.provider.city}</p>
          )}
        </div>
      </div>

      {/* Le solde en menthe : le design system reserve cette couleur aux
          economies et aux gains. Le rose est la couleur d'ACTION — un grand
          bloc rose non cliquable induirait en erreur. */}
      <div className="mb-6 rounded-[var(--radius-card)] bg-menthe p-8 text-center">
        <p className="ds-display text-5xl text-menthe-deep">{data.balance} pts</p>
        <p className="mt-2 text-base text-menthe-deep">≈ {formatDT(fromMillimes(valueM))}</p>
      </div>

      <div className="mb-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Règles du programme</p>
        <p className="text-base text-prune">1 TND dépensé = {ppd.toFixed(0)} pts • {Math.round(1 / dpp)} pts = 1 TND</p>
        <p className="text-base text-prune">Min échange : {data.program.minPointsToRedeem} pts • Max {data.program.maxRedemptionPctPerSale}% par achat</p>
        {data.program.inactivityExpireMonths && (
          <p className="mt-2 text-sm text-prune-soft">
            Tes points expirent après {data.program.inactivityExpireMonths} mois d&apos;inactivité.
          </p>
        )}
      </div>

      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Historique</p>
      <ul className="space-y-2">
        {data.transactions.items.length === 0 && (
          <p className="text-sm text-brand-ink-soft">Aucune transaction.</p>
        )}
        {data.transactions.items.map((t) => (
          <li key={t.id} className="rounded-2xl border border-brand-line bg-white p-4">
            <div className="flex justify-between mb-1">
              <span className="text-xs uppercase tracking-[0.18em] text-brand-ink-soft">
                {REASON_LABELS[t.reason] ?? t.reason}
              </span>
              <span
                className={
                  t.delta < 0 ? "text-amber-700 font-semibold" : "text-emerald-700 font-semibold"
                }
              >
                {t.delta > 0 ? "+" : ""}
                {t.delta} pts
              </span>
            </div>
            <p className="text-xs text-brand-ink-soft">
              {new Date(t.createdAt).toLocaleString("fr-FR")} · solde après: {t.balanceAfter} pts
              {t.sale && ` · Reçu ${t.sale.receiptNumber}`}
            </p>
            {t.note && <p className="text-xs text-brand-ink mt-1">« {t.note} »</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
