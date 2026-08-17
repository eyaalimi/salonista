"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDT, fromMillimes } from "@/lib/money";

type Wallet = {
  id: string;
  balance: number;
  lastActivityAt: string;
  dinarPerPoint: string;
  provider: { id: string; salonName: string; city: string | null; photo: string | null };
};

export default function ClienteFidelitePage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cliente/fidelite")
      .then((r) => r.json())
      .then((d) => {
        setWallets(d.wallets ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="p-6 text-base text-prune-soft">Chargement…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Fidélité</p>
      <h1 className="ds-display mb-6 text-3xl text-prune">Mes cartes de fidélité</h1>

      {wallets.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-10 text-center">
          <p className="mb-2 text-base text-prune">Tu n&apos;as encore aucune carte de fidélité.</p>
          <p className="text-sm text-prune-soft">
            Passe dans un salon partenaire pour commencer à gagner des points.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => {
            const dpp = Number(w.dinarPerPoint);
            const valueM = Math.round(w.balance * dpp * 1000);
            return (
              <Link
                key={w.id}
                href={`/cliente/fidelite/${w.id}`}
                className="ds-press ds-focus rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 hover:border-rose"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-soft text-lg font-bold text-prune">
                    {w.provider.salonName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-prune">{w.provider.salonName}</p>
                    {w.provider.city && (
                      <p className="text-sm text-prune-soft">{w.provider.city}</p>
                    )}
                  </div>
                </div>
                <div className="rounded-[var(--radius-panel)] bg-menthe p-4 text-center">
                  <p className="ds-display text-3xl text-menthe-deep">{w.balance} pts</p>
                  <p className="mt-1 text-sm text-menthe-deep">≈ {formatDT(fromMillimes(valueM))}</p>
                </div>
                <p className="mt-4 text-sm text-prune-soft">
                  Dernière activité : {new Date(w.lastActivityAt).toLocaleDateString("fr-FR")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
