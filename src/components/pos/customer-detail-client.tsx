"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Check, X } from "lucide-react";
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
  sales: Array<{
    id: string;
    receiptNumber: string;
    total: string;
    status: string;
    closedAt: string | null;
    items: Array<{ nameSnapshot: string; quantity: number }>;
  }>;
};

export function CustomerDetailClient({
  id,
  canEdit,
}: {
  id: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    notes: "",
    birthday: "",
  });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pos/customers/${id}`);
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
  }, [id]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
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
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? "Modification impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.replace("/pos/customers");
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d?.error ?? "Suppression impossible.");
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-sm text-pos-ink-3">Chargement…</p>;
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <Link
          href="/pos/customers"
          className="inline-flex items-center gap-1 text-sm text-pos-ink-2 hover:text-pos-ink mb-4"
        >
          <ArrowLeft size={14} /> Retour
        </Link>
        <p className="text-sm text-red-600">{error ?? "Erreur inconnue."}</p>
      </div>
    );
  }

  const { customer, stats, sales } = data;
  const displayName =
    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "Sans nom";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/pos/customers"
          className="inline-flex items-center gap-1 text-sm text-pos-ink-2 hover:text-pos-ink"
        >
          <ArrowLeft size={14} /> Retour à la liste
        </Link>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-pos-border rounded text-sm hover:bg-pos-highlight"
            >
              <Pencil size={14} /> Modifier
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
            >
              <Trash2 size={14} /> Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 bg-white border border-pos-border rounded-lg p-6">
          <h1 className="text-2xl font-semibold text-pos-ink mb-1">
            {displayName}
            {customer.isWalkIn && (
              <span className="ml-2 text-xs uppercase tracking-wider text-pos-ink-3">
                passager
              </span>
            )}
          </h1>
          <p className="text-xs text-pos-ink-3 mb-6">
            Cliente depuis{" "}
            {new Date(customer.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
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
                <span className="text-xs text-pos-ink-2">
                  Date de naissance <span className="text-pos-ink-3">(facultatif)</span>
                </span>
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
                >
                  <X size={14} /> Annuler
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-pos-accent text-white rounded text-sm font-medium disabled:opacity-50"
                >
                  <Check size={14} /> {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex">
                <dt className="w-32 text-pos-ink-3">Téléphone</dt>
                <dd className="pos-mono text-pos-ink">
                  {customer.phone ? formatPhoneDisplay(customer.phone) : "—"}
                </dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-pos-ink-3">E-mail</dt>
                <dd className="text-pos-ink">{customer.email ?? "—"}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-pos-ink-3">Naissance</dt>
                <dd className="text-pos-ink">
                  {customer.birthday
                    ? new Date(customer.birthday).toLocaleDateString("fr-FR")
                    : "—"}
                </dd>
              </div>
              {customer.notes && (
                <div className="flex">
                  <dt className="w-32 text-pos-ink-3">Notes</dt>
                  <dd className="text-pos-ink whitespace-pre-wrap">
                    {customer.notes}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="bg-white border border-pos-border rounded-lg p-6">
          <h2 className="text-xs uppercase tracking-wider text-pos-ink-3 mb-3">
            Récapitulatif
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-pos-ink-3">Visites</p>
              <p className="text-2xl font-semibold text-pos-ink pos-mono">
                {stats.totalVisits}
              </p>
            </div>
            <div>
              <p className="text-xs text-pos-ink-3">Total dépensé</p>
              <p className="text-2xl font-semibold text-pos-accent pos-mono">
                {formatDT(stats.totalSpent)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-pos-border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b border-pos-border">
          <h2 className="text-sm font-medium text-pos-ink">
            Historique des ventes
            <span className="ml-2 text-xs text-pos-ink-3">({sales.length})</span>
          </h2>
        </div>
        {sales.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-pos-ink-3">
            Aucune vente enregistrée pour cette cliente.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-pos-bg border-b border-pos-border">
              <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Reçu</th>
                <th className="px-4 py-2 font-medium">Articles</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-pos-border last:border-0 hover:bg-pos-highlight/50"
                >
                  <td className="px-4 py-2 text-pos-ink-2 pos-mono">
                    {s.closedAt
                      ? new Date(s.closedAt).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2 pos-mono text-xs">
                    <Link
                      href={`/pos/sales/${s.id}`}
                      className="text-pos-accent hover:underline"
                    >
                      {s.receiptNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-pos-ink-2 truncate max-w-md">
                    {s.items
                      .map((i) =>
                        i.quantity > 1
                          ? `${i.nameSnapshot} ×${i.quantity}`
                          : i.nameSnapshot,
                      )
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-right pos-mono font-medium">
                    {formatDT(s.total)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-pos-ink mb-2">
              Supprimer la cliente ?
            </h2>
            <p className="text-sm text-pos-ink-2 mb-6">
              Cette action est définitive. La cliente <strong>{displayName}</strong> sera supprimée.
              Les fiches avec un historique de ventes ne peuvent pas être supprimées.
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
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PAID: { label: "Payée", cls: "bg-emerald-50 text-emerald-700" },
    PARTIALLY_REFUNDED: { label: "Remb. partiel", cls: "bg-amber-50 text-amber-700" },
    REFUNDED: { label: "Remboursée", cls: "bg-red-50 text-red-700" },
  };
  const m = map[status] ?? { label: status, cls: "bg-pos-bg text-pos-ink-3" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}
