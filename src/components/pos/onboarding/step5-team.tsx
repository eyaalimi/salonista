"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type Provider = {
  id: string;
  _count: { employees: number };
};

type Employee = {
  displayName: string;
  pin: string;
  role: "MANAGER" | "CASHIER" | "STYLIST";
};

const ROLE_OPTIONS: Array<{ value: Employee["role"]; label: string }> = [
  { value: "CASHIER", label: "Caissier·ère" },
  { value: "STYLIST", label: "Coiffeur·euse" },
  { value: "MANAGER", label: "Manager" },
];

export function Step5Team({
  provider,
  onAdded,
  onFinish,
  onBack,
}: {
  provider: Provider;
  onAdded: (p: Partial<Provider>) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addEmployee() {
    setEmployees((prev) => [
      ...prev,
      { displayName: "", pin: "", role: "CASHIER" },
    ]);
  }

  function update(i: number, patch: Partial<Employee>) {
    setEmployees((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  }

  function remove(i: number) {
    setEmployees((prev) => prev.filter((_, idx) => idx !== i));
  }

  const allValid = employees.every(
    (e) => e.displayName.trim().length >= 2 && /^\d{4}$/.test(e.pin),
  );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (employees.length > 0) {
        const res = await fetch("/api/pos/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step5: { employees: employees.filter((e) => e.displayName.trim()) },
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? "Erreur lors de la sauvegarde");
          return;
        }
        onAdded({
          _count: {
            ...provider._count,
            employees: provider._count.employees + employees.length,
          },
        });
      }
      onFinish();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-brand-ink-soft">
        Ajoutez les autres membres avec leur PIN · facultatif
      </p>

      {employees.length === 0 ? (
        <p className="text-sm text-brand-ink-soft text-center py-6">
          Aucun employé ajouté. Vous pouvez démarrer seul·e et ajouter des
          membres plus tard depuis la page Équipe.
        </p>
      ) : (
        <div className="space-y-3">
          {employees.map((e, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-brand-line bg-white space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={e.displayName}
                  onChange={(ev) =>
                    update(i, { displayName: ev.target.value })
                  }
                  placeholder="Prénom & nom (ex: Yasmine)"
                  className="flex-1 px-3 py-2 border border-brand-line rounded text-sm focus:border-pos-accent focus:outline-none"
                />
                <select
                  value={e.role}
                  onChange={(ev) =>
                    update(i, { role: ev.target.value as Employee["role"] })
                  }
                  className="px-2 py-2 border border-brand-line rounded text-sm bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-brand-ink-soft hover:text-pos-danger shrink-0"
                  aria-label="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-brand-ink-soft shrink-0">
                  PIN
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={e.pin}
                  onChange={(ev) =>
                    update(i, { pin: ev.target.value.replace(/\D/g, "") })
                  }
                  placeholder="••••"
                  className="w-24 px-3 py-2 border border-brand-line rounded text-base pos-mono tracking-widest text-center focus:border-pos-accent focus:outline-none"
                />
                <span className="text-[11px] text-brand-ink-soft">
                  4 chiffres — communiquez-le à l&apos;employé·e
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addEmployee}
        className="inline-flex items-center gap-1.5 text-sm text-pos-accent hover:text-pos-accent/80 font-medium"
      >
        <Plus size={14} /> Ajouter un membre de l&apos;équipe
      </button>

      {error && (
        <div className="text-sm text-pos-danger bg-pos-danger-soft border border-pos-danger rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {employees.length > 0 && !allValid && (
        <p className="text-[11px] text-pos-warn bg-pos-highlight px-3 py-2 rounded">
          Chaque membre doit avoir un nom et un PIN à 4 chiffres.
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-brand-line">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand-ink-soft hover:text-brand-ink"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || (employees.length > 0 && !allValid)}
          className="px-8 py-4 rounded-xl bg-pos-accent text-white font-semibold hover:bg-pos-accent disabled:opacity-50 shadow-md shadow-emerald-600/30"
        >
          {busy ? "Activation…" : "🎉  Ouvrir ma caisse"}
        </button>
      </div>
    </div>
  );
}
