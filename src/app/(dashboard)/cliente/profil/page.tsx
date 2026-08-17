"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ClienteProfil() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) {
          setForm({ name: data.name || "", phone: data.phone || "" });
        }
        setLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/client/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-base text-prune-soft">Chargement…</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">Paramètres</p>
        <h1 className="ds-display text-3xl text-prune">Mon profil</h1>
      </div>

      <div className="max-w-lg">
        {/* Avatar */}
        <div className="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-soft text-xl font-bold text-prune">
            {session?.user?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-base font-semibold text-prune">{session?.user?.name}</p>
            <p className="mt-1 text-sm text-prune-soft">{session?.user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-8">
          <Input
            label="Nom"
            id="profil-nom"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            label="Téléphone"
            id="profil-telephone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+216 XX XXX XXX"
          />

          <div className="rounded-[var(--radius-panel)] border-2 border-hairline bg-creme p-4 text-base text-prune-soft">
            <p><strong className="font-semibold text-prune">Email :</strong> {session?.user?.email}</p>
            <p className="mt-1 text-sm text-prune-soft">L&apos;email ne peut pas être modifié.</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
