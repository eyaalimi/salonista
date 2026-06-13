"use client";
import { useState } from "react";

type Provider = {
  id: string;
  salonName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  matriculeFiscal: string | null;
  receiptFooter: string | null;
};

export function Step1Info({
  provider,
  onSaved,
  onNext,
}: {
  provider: Provider;
  onSaved: (p: Provider) => void;
  onNext: () => void;
}) {
  const [form, setForm] = useState({
    salonName: provider.salonName ?? "",
    phone: provider.phone ?? "",
    address: provider.address ?? "",
    city: provider.city ?? "",
    matriculeFiscal: provider.matriculeFiscal ?? "",
    receiptFooter: provider.receiptFooter ?? "Merci de votre visite !",
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch("/api/provider/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onSaved({ ...provider, ...form });
    } catch {
      // Échec réseau — l'utilisateur peut réessayer en éditant à nouveau.
    } finally {
      setBusy(false);
    }
  }

  const canContinue = !!form.salonName.trim() && !!form.phone.trim();

  return (
    <div className="max-w-xl space-y-4">
      <label className="block">
        <span className="text-sm text-pos-ink-2">Nom du salon</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.salonName}
          onChange={(e) => setForm({ ...form, salonName: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Téléphone</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Adresse</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Ville</span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          onBlur={save}
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">
          Matricule fiscal <span className="text-pos-ink-3">(facultatif)</span>
        </span>
        <input
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          value={form.matriculeFiscal}
          onChange={(e) => setForm({ ...form, matriculeFiscal: e.target.value })}
          onBlur={save}
          placeholder="n° d'identification fiscale, optionnel"
        />
      </label>
      <label className="block">
        <span className="text-sm text-pos-ink-2">Message en bas de ticket</span>
        <textarea
          className="mt-1 block w-full px-3 py-2 rounded border border-pos-border bg-white"
          rows={3}
          value={form.receiptFooter}
          onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
          onBlur={save}
        />
      </label>

      <div className="pt-4 flex justify-end">
        <button
          disabled={!canContinue || busy}
          onClick={onNext}
          className="px-5 py-2 rounded bg-pos-ink text-pos-bg disabled:opacity-50"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
