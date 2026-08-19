"use client";

import { useEffect, useState } from "react";
import { X, Phone, Mail, Calendar, Pencil, Trash2, Check } from "lucide-react";
import { formatDT } from "@/lib/money";
import { formatPhoneDisplay } from "@/lib/phone";

type Detail = {
  customer: {
    id: string;
    phone: string | null;
    isWalkIn: boolean;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    birthday: string | null;
    notes: string | null;
    createdAt: string;
  };
  stats: { totalVisits: number; totalSpent: string };
  loyalty: {
    balance: number;
    lifetimeEarned: number;
    lifetimeRedeemed: number;
  } | null;
  sales: Array<{
    id: string;
    receiptNumber: string;
    total: string;
    status: string;
    closedAt: string | null;
    items: Array<{ nameSnapshot: string; quantity: number }>;
    paymentMethods?: Array<{ method: string }>;
  }>;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  REWARDS: "Fidélité",
  OTHER: "Autre",
};

export function CustomerDetailDrawer({
  customerId,
  canEdit,
  onClose,
  onChanged,
}: {
  customerId: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    notes: "",
    birthday: "",
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/customers/${customerId}`);
      if (res.ok) {
        const d = (await res.json()) as Detail;
        setData(d);
        setForm({
          firstName: d.customer.firstName ?? "",
          lastName: d.customer.lastName ?? "",
          email: d.customer.email ?? "",
          notes: d.customer.notes ?? "",
          birthday: d.customer.birthday
            ? new Date(d.customer.birthday).toISOString().slice(0, 10)
            : "",
        });
      } else if (res.status === 404) {
        setError("Cliente introuvable.");
      } else {
        setError("Impossible de charger la fiche.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
          birthday: form.birthday || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await load();
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/customers/${customerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await onChanged();
        onClose();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Suppression impossible.");
        setConfirmDelete(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const displayName = data
    ? `${data.customer.firstName ?? ""} ${data.customer.lastName ?? ""}`.trim() ||
      "Sans nom"
    : "";

  const lastVisit = data?.sales[0]?.closedAt ?? null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-[480px] bg-white shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-pos-border px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {data && (
              <>
                <h2 className="text-xl font-semibold text-pos-ink truncate">
                  {displayName}
                  {data.customer.isWalkIn && (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-pos-ink-3">
                      passager
                    </span>
                  )}
                </h2>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-pos-border text-pos-ink-2 hover:bg-pos-highlight"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-sm text-pos-ink-3">Chargement…</p>
          ) : error || !data ? (
            <p className="text-sm text-pos-danger">{error ?? "Erreur"}</p>
          ) : (
            <>
              {/* Identity */}
              {!editing && (
                <div className="space-y-2 mb-6 text-sm">
                  {data.customer.phone && (
                    <p className="flex items-center gap-2 text-pos-ink-2">
                      <Phone size={14} className="text-pos-ink-3" />
                      <span className="pos-mono">{formatPhoneDisplay(data.customer.phone)}</span>
                    </p>
                  )}
                  {data.customer.email && (
                    <p className="flex items-center gap-2 text-pos-ink-2">
                      <Mail size={14} className="text-pos-ink-3" />
                      <span>{data.customer.email}</span>
                    </p>
                  )}
                  {(lastVisit || data.customer.birthday) && (
                    <p className="flex items-center gap-2 text-pos-ink-2">
                      <Calendar size={14} className="text-pos-ink-3" />
                      {lastVisit ? (
                        <span>
                          Dernière visite :{" "}
                          {new Date(lastVisit).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span>
                          Naissance :{" "}
                          {new Date(data.customer.birthday!).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </p>
                  )}
                  {data.customer.notes && (
                    <p className="mt-3 text-xs text-pos-ink-2 bg-pos-bg p-3 rounded whitespace-pre-wrap">
                      {data.customer.notes}
                    </p>
                  )}
                </div>
              )}

              {/* Edit form */}
              {editing && (
                <div className="space-y-3 mb-6">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-pos-ink-2">Prénom</span>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-pos-ink-2">Nom</span>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-pos-ink-2">E-mail</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-pos-ink-2">Date de naissance</span>
                    <input
                      type="date"
                      value={form.birthday}
                      onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-pos-ink-2">Notes</span>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-3 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={busy}
                      className="inline-flex items-center gap-1 px-3 py-2 bg-pos-accent text-white rounded text-sm font-medium disabled:opacity-50"
                    >
                      <Check size={14} /> {busy ? "…" : "Enregistrer"}
                    </button>
                  </div>
                </div>
              )}

              {/* Stats cards */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="border border-pos-border rounded-lg p-4">
                  <p className="text-xs text-pos-ink-3">Visites</p>
                  <p className="text-2xl font-semibold text-pos-ink pos-mono">
                    {data.stats.totalVisits}
                  </p>
                </div>
                <div className="border border-pos-border rounded-lg p-4">
                  <p className="text-xs text-pos-ink-3">Total dépensé</p>
                  <p className="text-2xl font-semibold text-pos-accent pos-mono">
                    {formatDT(data.stats.totalSpent)}
                  </p>
                </div>
              </div>

              {/* Loyalty card */}
              {data.loyalty && data.loyalty.lifetimeEarned > 0 && (
                <div className="border border-pos-warn bg-pos-highlight/50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-pos-warn uppercase tracking-wider font-medium">
                        ★ Points fidélité
                      </p>
                      <p className="text-2xl font-semibold text-pos-warn pos-mono mt-1">
                        {data.loyalty.balance} pts
                      </p>
                    </div>
                    <div className="text-right text-xs text-pos-warn">
                      <p>
                        Gagnés (vie) :{" "}
                        <span className="pos-mono font-semibold">
                          {data.loyalty.lifetimeEarned}
                        </span>
                      </p>
                      <p className="mt-1">
                        Utilisés (vie) :{" "}
                        <span className="pos-mono font-semibold">
                          {data.loyalty.lifetimeRedeemed}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sales history */}
              <h3 className="text-sm font-semibold text-pos-ink mb-3">
                Historique des ventes
              </h3>
              {data.sales.length === 0 ? (
                <p className="text-xs text-pos-ink-3">Aucune vente.</p>
              ) : (
                <ul className="space-y-2 mb-6">
                  {data.sales.map((s) => (
                    <li
                      key={s.id}
                      className="border border-pos-border rounded-lg p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-pos-ink pos-mono">
                          {s.receiptNumber}
                        </p>
                        <p className="text-xs text-pos-ink-3">
                          {s.closedAt
                            ? new Date(s.closedAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                        <p className="text-xs text-pos-ink-2 mt-1 truncate">
                          {s.items
                            .map((i) =>
                              i.quantity > 1
                                ? `${i.nameSnapshot} ×${i.quantity}`
                                : i.nameSnapshot,
                            )
                            .join(", ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="pos-mono font-semibold text-pos-ink">
                          {formatDT(s.total)}
                        </p>
                        {s.paymentMethods && s.paymentMethods.length > 0 && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded bg-pos-bg text-[10px] uppercase tracking-wider text-pos-ink-3">
                            {s.paymentMethods
                              .map((p) => METHOD_LABELS[p.method] ?? p.method)
                              .join(" + ")}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Actions */}
              {canEdit && !editing && (
                <div className="flex gap-2 border-t border-pos-border pt-4">
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 border border-pos-border rounded text-sm hover:bg-pos-highlight"
                  >
                    <Pencil size={14} /> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-pos-danger text-pos-danger rounded text-sm hover:bg-pos-danger-soft"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-pos-ink mb-2">
              Supprimer la cliente ?
            </h2>
            <p className="text-sm text-pos-ink-2 mb-6">
              Cette action est définitive. Les fiches avec un historique de ventes ne peuvent pas être
              supprimées.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="px-4 py-2 bg-pos-danger text-white rounded text-sm font-medium hover:bg-pos-danger disabled:opacity-50"
              >
                {busy ? "…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
