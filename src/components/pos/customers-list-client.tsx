"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { formatDT } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";
import { CustomerDetailDrawer } from "./customer-detail-drawer";

type Row = {
  id: string;
  phone: string | null;
  isWalkIn: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  totalVisits: number;
  totalSpent: string;
  loyaltyPoints: number;
};

export function CustomersListClient({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/pos/customers");
      if (res.ok) {
        const data = (await res.json()) as { customers: Row[] };
        setRows(data.customers);
      } else {
        setError("Impossible de charger la liste des clients.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query]);

  return (
    <div className="h-full overflow-y-auto md:p-6 p-4 max-w-7xl mx-auto">
      <div className="flex md:flex-row flex-col md:items-center gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="relative flex-1 md:max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-pos-ink-4"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, téléphone ou e-mail…"
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-pos-border rounded-lg text-sm focus:border-pos-accent focus:outline-none"
          />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-pos-accent text-white rounded-lg text-sm font-medium hover:bg-pos-accent/90 shrink-0"
          >
            <UserPlus size={16} />
            Nouvelle cliente
          </button>
        )}
      </div>

      {createOpen && (
        <NewCustomerModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-pos-ink-3">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-pos-ink-3 text-center py-12">
          {rows.length === 0
            ? "Aucune cliente pour le moment."
            : "Aucun résultat pour cette recherche."}
        </p>
      ) : (
        <>
        <div className="hidden md:block bg-white border border-pos-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-pos-bg border-b border-pos-border">
              <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium text-right">Visites</th>
                <th className="px-4 py-3 font-medium text-right">Total dépensé</th>
                <th className="px-4 py-3 font-medium text-right">Fidélité</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const name =
                  `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`border-b border-pos-border last:border-0 hover:bg-pos-highlight/50 cursor-pointer ${
                      selectedId === c.id ? "bg-pos-highlight/70" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-pos-ink">
                      {name}
                      {c.isWalkIn && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-pos-ink-3">
                          passager
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-pos-ink-2 pos-mono">
                      {c.phone ? formatPhoneDisplay(c.phone) : "—"}
                    </td>
                    <td className="px-4 py-3 text-pos-ink-2">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right pos-mono">
                      {c.totalVisits}
                    </td>
                    <td className="px-4 py-3 text-right pos-mono font-medium">
                      {formatDT(c.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.loyaltyPoints > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold pos-mono">
                          ★ {c.loyaltyPoints}
                        </span>
                      ) : (
                        <span className="text-pos-ink-4 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden flex flex-col gap-2">
          {visible.map((c) => {
            const name =
              `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "—";
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left rounded-lg border border-pos-border bg-white p-3 hover:border-pos-accent"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-pos-ink truncate">
                      {name}
                      {c.isWalkIn && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-pos-ink-3">
                          passager
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-pos-ink-2 pos-mono mt-0.5">
                      {c.phone ? formatPhoneDisplay(c.phone) : "—"}
                    </p>
                  </div>
                  {c.loyaltyPoints > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold pos-mono">
                      ★ {c.loyaltyPoints}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-pos-ink-3 mt-1">
                  <span>{c.totalVisits} visite{c.totalVisits > 1 ? "s" : ""}</span>
                  <span className="pos-mono font-medium text-pos-ink">
                    {formatDT(c.totalSpent)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        </>
      )}

      {selectedId && (
        <CustomerDetailDrawer
          customerId={selectedId}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function NewCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    if (!phone.trim()) {
      setError("Le numéro de téléphone est requis.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      if (res.ok) {
        await onCreated();
        return;
      }
      if (res.status === 409) {
        setError("Une cliente existe déjà avec ce numéro.");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Création impossible.");
      }
    } catch {
      setError("Erreur réseau.");
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-pos-ink mb-4">Nouvelle cliente</h2>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-pos-ink-2">Prénom</span>
              <input
                type="text"
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-pos-ink-2">Nom</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-pos-ink-2">
              Téléphone <span className="text-red-500">*</span>
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (void submit())}
              placeholder="+216 22 345 678 ou 22 345 678"
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
            />
          </label>

          <label className="block">
            <span className="text-xs text-pos-ink-2">
              E-mail <span className="text-pos-ink-3">(facultatif)</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@example.tn"
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
            />
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
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
            {busy ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
