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
    return <p className="p-6 text-sm text-brand-ink-soft">Chargement…</p>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <p className="luxury-badge mb-2">Fidélité</p>
      <h1 className="luxury-heading text-3xl text-brand-ink mb-6">Mes cartes de fidélité</h1>

      {wallets.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-white p-10 text-center">
          <p className="text-sm text-brand-ink mb-2">Vous n&apos;avez encore aucune carte de fidélité.</p>
          <p className="text-xs text-brand-ink-soft">
            Visitez un salon partenaire pour commencer à gagner des points.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((w) => {
            const dpp = Number(w.dinarPerPoint);
            const valueM = Math.round(w.balance * dpp * 1000);
            return (
              <Link
                key={w.id}
                href={`/cliente/fidelite/${w.id}`}
                className="bg-white border border-brand-line rounded-2xl p-5 hover:border-brand-gold transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-brand-sand border border-brand-line flex items-center justify-center text-lg font-semibold text-brand-ink">
                    {w.provider.salonName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-brand-ink">{w.provider.salonName}</p>
                    {w.provider.city && (
                      <p className="text-xs text-brand-ink-soft">{w.provider.city}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-brand-line pt-4">
                  <p className="luxury-heading text-3xl text-brand-ink">{w.balance} pts</p>
                  <p className="text-xs text-brand-ink-soft">≈ {formatDT(fromMillimes(valueM))}</p>
                </div>
                <p className="mt-4 text-xs text-brand-ink-soft">
                  Dernière activité: {new Date(w.lastActivityAt).toLocaleDateString("fr-FR")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
