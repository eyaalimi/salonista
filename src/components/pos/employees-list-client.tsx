"use client";

import { useEffect, useState } from "react";
import { UserPlus, Pencil, Trash2, KeyRound, X } from "lucide-react";

type Employee = {
  id: string;
  displayName: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "STYLIST";
  phone: string | null;
  email: string | null;
  active: boolean;
  hasPin: boolean;
  /** Flat commission rate as a decimal string ("30.00") or null. */
  commissionRate: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<Employee["role"], string> = {
  OWNER: "Propriétaire",
  MANAGER: "Manager",
  CASHIER: "Caissière",
  STYLIST: "Styliste",
};

export function EmployeesListClient() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [pinTarget, setPinTarget] = useState<Employee | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/pos/employees");
      if (res.ok) {
        const data = (await res.json()) as { employees: Employee[] };
        setRows(data.employees);
      } else {
        setError("Impossible de charger la liste.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="h-full overflow-y-auto md:p-6 p-4 max-w-6xl mx-auto">
      <div className="flex md:items-center items-start justify-between mb-4 md:mb-6 gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="md:text-2xl text-xl font-semibold text-pos-ink">Équipe</h1>
          <p className="text-xs md:text-sm text-pos-ink-3 mt-1 hidden md:block">
            Gérez les membres de votre équipe et leurs PIN d&apos;accès à la caisse.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-3 md:px-4 py-2.5 bg-pos-accent text-white rounded-lg text-sm font-medium hover:bg-pos-accent/90 shrink-0"
        >
          <UserPlus size={16} />
          <span className="hidden sm:inline">Nouvel employé</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-pos-ink-3">Chargement…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-pos-ink-3 text-center py-12">
          Aucun employé pour le moment.
        </p>
      ) : (
        <div className="bg-white border border-pos-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-pos-bg border-b border-pos-border">
              <tr className="text-left text-xs uppercase tracking-wider text-pos-ink-3">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">PIN</th>
                <th className="px-4 py-3 font-medium text-right">Commission</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className={`border-b border-pos-border last:border-0 ${
                    e.active ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-pos-ink">
                    {e.displayName}
                  </td>
                  <td className="px-4 py-3 text-pos-ink-2">
                    {ROLE_LABELS[e.role]}
                  </td>
                  <td className="px-4 py-3 text-pos-ink-2 text-xs">
                    {e.email && <div>{e.email}</div>}
                    {e.phone && <div className="pos-mono">{e.phone}</div>}
                    {!e.email && !e.phone && "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.hasPin ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                        Défini
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                        Non défini
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right pos-mono text-pos-ink-2">
                    {e.commissionRate
                      ? `${Number(e.commissionRate).toFixed(2)} %`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        e.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-pos-bg text-pos-ink-3"
                      }`}
                    >
                      {e.active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPinTarget(e)}
                        title="Modifier le PIN"
                        className="p-1.5 text-pos-ink-2 hover:text-pos-ink hover:bg-pos-highlight rounded"
                      >
                        <KeyRound size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        title="Modifier"
                        className="p-1.5 text-pos-ink-2 hover:text-pos-ink hover:bg-pos-highlight rounded"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Supprimer ${e.displayName} ?`)) return;
                          const res = await fetch(`/api/pos/employees/${e.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) {
                            await refresh();
                          } else {
                            const d = await res.json().catch(() => ({}));
                            alert(d?.error ?? "Suppression impossible.");
                          }
                        }}
                        title="Supprimer"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <EmployeeFormModal
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
          }}
        />
      )}

      {editing && (
        <EmployeeFormModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {pinTarget && (
        <PinModal
          employee={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={async () => {
            setPinTarget(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function EmployeeFormModal({
  employee,
  onClose,
  onSaved,
}: {
  employee?: Employee;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!employee;
  const [displayName, setDisplayName] = useState(employee?.displayName ?? "");
  const [role, setRole] = useState<Employee["role"]>(employee?.role ?? "CASHIER");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [email, setEmail] = useState(employee?.email ?? "");
  const [active, setActive] = useState(employee?.active ?? true);
  const [pin, setPin] = useState("");
  const [commissionRate, setCommissionRate] = useState<string>(
    employee?.commissionRate ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!displayName.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setBusy(true);
    try {
      const url = isEdit ? `/api/pos/employees/${employee!.id}` : "/api/pos/employees";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        displayName: displayName.trim(),
        role,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      if (isEdit) body.active = active;
      if (pin) body.pin = pin;
      // Send commissionRate: "" or "0" clears it, otherwise a valid number.
      if (commissionRate.trim() === "") {
        body.commissionRate = null;
      } else {
        const n = Number(commissionRate);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          setError("Le taux de commission doit être entre 0 et 100.");
          setBusy(false);
          return;
        }
        body.commissionRate = n;
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-pos-ink">
            {isEdit ? "Modifier l'employé" : "Nouvel employé"}
          </h2>
          <button type="button" onClick={onClose} className="text-pos-ink-3 hover:text-pos-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-pos-ink-2">Nom complet *</span>
            <input
              type="text"
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-pos-ink-2">Rôle</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Employee["role"])}
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm bg-white"
            >
              <option value="OWNER">Propriétaire — accès complet</option>
              <option value="MANAGER">Manager — gestion sauf employés</option>
              <option value="CASHIER">Caissière — encaisser, clients</option>
              <option value="STYLIST">Styliste — voir RDV</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-pos-ink-2">Téléphone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs text-pos-ink-2">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-pos-ink-2">
              PIN (4 chiffres){" "}
              <span className="text-pos-ink-3">
                {isEdit ? "— laissez vide pour ne pas changer" : "— facultatif"}
              </span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="mt-1 w-full px-3 py-2 border border-pos-border rounded text-sm pos-mono tracking-widest"
            />
          </label>

          {(role === "STYLIST" || role === "CASHIER") && (
            <label className="block">
              <span className="text-xs text-pos-ink-2">
                Commission sur services{" "}
                <span className="text-pos-ink-3">— % du HT (laisser vide = aucune)</span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="Ex: 30"
                  className="w-24 px-3 py-2 border border-pos-border rounded text-sm pos-mono text-right"
                />
                <span className="text-sm text-pos-ink-2">%</span>
              </div>
            </label>
          )}

          {isEdit && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span className="text-sm text-pos-ink">Employé actif</span>
            </label>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
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
            {busy ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PinModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(removePin = false) {
    setError(null);
    if (!removePin && !/^\d{4}$/.test(pin)) {
      setError("Le PIN doit comporter exactement 4 chiffres.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: removePin ? null : pin }),
      });
      if (res.ok) {
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-pos-ink mb-2">
          PIN de {employee.displayName}
        </h2>
        <p className="text-sm text-pos-ink-3 mb-4">
          Saisissez un nouveau PIN à 4 chiffres. Communiquez-le directement à l&apos;employé.
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && (void save(false))}
          placeholder="••••"
          className="w-full px-3 py-3 border border-pos-border rounded text-lg pos-mono tracking-widest text-center"
        />
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
        )}
        <div className="mt-6 flex justify-between">
          {employee.hasPin && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={busy}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Supprimer le PIN
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-pos-ink-2 hover:text-pos-ink"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy}
              className="px-4 py-2 bg-pos-accent text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
