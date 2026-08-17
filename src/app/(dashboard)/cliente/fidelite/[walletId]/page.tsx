"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatDT, fromMillimes } from "@/lib/money";
import { Button } from "@/components/ui/button";

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
  // L'historique s'accumule : chaque « Voir plus » AJOUTE une page a la liste
  // au lieu de la remplacer. `data.transactions.items` ne sert donc que pour
  // la premiere page.
  const [items, setItems] = useState<Detail["transactions"]["items"]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    fetch(`/api/cliente/fidelite/${walletId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Detail | null) => {
        setData(d);
        setItems(d?.transactions.items ?? []);
        setPage(1);
      });
  }, [walletId]);

  async function chargerPlus() {
    if (!data) return;
    setLoadingMore(true);
    const suivante = page + 1;
    const res = await fetch(`/api/cliente/fidelite/${walletId}?page=${suivante}`);
    if (res.ok) {
      const d: Detail = await res.json();
      setItems((prev) => [...prev, ...d.transactions.items]);
      setPage(suivante);
    }
    setLoadingMore(false);
  }

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
        {items.length === 0 && (
          <p className="text-base text-prune-soft">Aucune transaction.</p>
        )}
        {items.map((t) => (
          <li key={t.id} className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
                {REASON_LABELS[t.reason] ?? t.reason}
              </span>
              {/* Gain en menthe-deep, retrait en prune : un echange de points
                  n'est PAS une erreur. Le rose, seule couleur d'alerte du
                  systeme, serait un contresens. */}
              <span
                className={
                  t.delta < 0 ? "font-semibold text-prune" : "font-semibold text-menthe-deep"
                }
              >
                {t.delta > 0 ? "+" : ""}
                {t.delta} pts
              </span>
            </div>
            <p className="text-sm text-prune-soft">
              {new Date(t.createdAt).toLocaleString("fr-FR")} · solde après : {t.balanceAfter} pts
              {t.sale && ` · Reçu ${t.sale.receiptNumber}`}
            </p>
            {t.note && <p className="mt-1 text-sm text-prune">« {t.note} »</p>}
          </li>
        ))}
      </ul>

      {/* Le bouton ne s'affiche que s'il reste des transactions a charger.
          Sur un jeu de donnees de test (moins de 20 transactions), il sera
          absent — c'est le comportement correct, pas une panne. */}
      {items.length < data.transactions.total && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={chargerPlus} disabled={loadingMore}>
            {loadingMore ? "Chargement…" : "Voir plus"}
          </Button>
          <p className="mt-2 text-sm text-prune-soft">
            {items.length} sur {data.transactions.total} transactions
          </p>
        </div>
      )}
    </div>
  );
}
