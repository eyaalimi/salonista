"use client";

import { useEffect, useMemo, useState } from "react";

type SubscriptionModule = "POS" | "REWARDS";
type SubscriptionStatus = "ACTIVE" | "TRIAL" | "SUSPENDED" | "EXPIRED";

type Subscription = {
  id: string;
  module: SubscriptionModule;
  status: SubscriptionStatus;
  activatedAt: string;
  expiresAt: string | null;
  activatedByUserId: string | null;
  pricingSnapshot: { monthlyPrice?: number; currency?: string } | null;
  notes: string | null;
  updatedAt: string;
};

type Provider = {
  id: string;
  salonName: string;
  city: string | null;
  verified: boolean;
  user: { email: string; name: string | null };
  subscriptions: Subscription[];
};

type Admin = { id: string; name: string | null; email: string };

type Filter = "ALL" | "POS_ACTIVE" | "REWARDS_ACTIVE" | "EXPIRING_SOON";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "POS_ACTIVE", label: "POS actif" },
  { value: "REWARDS_ACTIVE", label: "Rewards actif" },
  { value: "EXPIRING_SOON", label: "Expire bientôt (≤ 7 jours)" },
];

function isActive(s: Subscription | undefined): boolean {
  if (!s) return false;
  if (s.status !== "ACTIVE" && s.status !== "TRIAL") return false;
  if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

function expiringSoon(s: Subscription | undefined): boolean {
  if (!s?.expiresAt) return false;
  const ms = new Date(s.expiresAt).getTime() - Date.now();
  return ms > 0 && ms <= 7 * 24 * 60 * 60 * 1000;
}

function StatusPill({ sub }: { sub?: Subscription }) {
  if (!sub) {
    return (
      <span className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-prune/60">
        Inactif
      </span>
    );
  }
  if (sub.status === "ACTIVE") {
    return (
      <span className="inline-flex items-center rounded-full border border-menthe-deep/40 px-3 py-1 text-menthe-deep">
        Actif
      </span>
    );
  }
  if (sub.status === "TRIAL") {
    const date = sub.expiresAt ? new Date(sub.expiresAt) : null;
    const dd = date ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}` : "";
    return (
      <span className="inline-flex items-center rounded-full border border-prune/30 px-3 py-1 text-prune">
        Essai{dd ? ` (jusqu'au ${dd})` : ""}
      </span>
    );
  }
  if (sub.status === "SUSPENDED") {
    return (
      <span className="inline-flex items-center rounded-full border border-rose/40 px-3 py-1 text-rose-fonce">
        Suspendu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-prune/60">
      Expiré
    </span>
  );
}

export default function SubscriptionsClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [drawerProvider, setDrawerProvider] = useState<Provider | null>(null);

  async function load(): Promise<Provider[]> {
    const res = await fetch("/api/admin/subscriptions");
    if (!res.ok) {
      setLoading(false);
      return [];
    }
    const data = await res.json();
    setProviders(data.providers);
    setAdmins(data.admins);
    setLoading(false);
    return data.providers as Provider[];
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return providers.filter((p) => {
      if (q) {
        const hay = `${p.salonName} ${p.city ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const pos = p.subscriptions.find((s) => s.module === "POS");
      const rewards = p.subscriptions.find((s) => s.module === "REWARDS");
      if (filter === "POS_ACTIVE" && !isActive(pos)) return false;
      if (filter === "REWARDS_ACTIVE" && !isActive(rewards)) return false;
      if (filter === "EXPIRING_SOON" && !expiringSoon(pos) && !expiringSoon(rewards)) {
        return false;
      }
      return true;
    });
  }, [providers, search, filter]);

  return (
    <div>
      <h1 className="ds-display mb-6 text-3xl text-prune">Abonnements modules</h1>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <input
          type="text"
          placeholder="Rechercher un salon ou une ville…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-hairline bg-white px-4 py-3 text-sm focus:border-rose focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-4 py-2 transition ${
                filter === f.value
                  ? "border-prune bg-prune text-white"
                  : "border-hairline bg-white text-prune/60 hover:border-rose"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-prune/60">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-prune-soft text-left text-prune/60">
              <tr>
                <th className="px-4 py-3">Salon</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">POS</th>
                <th className="px-4 py-3">Rewards</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const pos = p.subscriptions.find((s) => s.module === "POS");
                const rewards = p.subscriptions.find((s) => s.module === "REWARDS");
                return (
                  <tr key={p.id} className="border-t border-hairline">
                    <td className="px-4 py-4">
                      <div className="font-medium text-prune">{p.salonName}</div>
                      <div className="text-[10px] text-prune/60">{p.user.email}</div>
                    </td>
                    <td className="px-4 py-4 text-prune/60">{p.city ?? "—"}</td>
                    <td className="px-4 py-4">
                      <StatusPill sub={pos} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill sub={rewards} />
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => setDrawerProvider(p)}
                        className="rounded-lg border border-hairline bg-white px-3 py-2 text-prune hover:border-rose"
                      >
                        Gérer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-prune/60">
                    Aucun salon ne correspond.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {drawerProvider && (
        <ManageDrawer
          provider={drawerProvider}
          admins={admins}
          onClose={() => setDrawerProvider(null)}
          onChange={async () => {
            const fresh = await load();
            const refreshed = fresh.find((p) => p.id === drawerProvider.id);
            if (refreshed) setDrawerProvider(refreshed);
          }}
        />
      )}
    </div>
  );
}

type ActivateForm = {
  status: "ACTIVE" | "TRIAL";
  expiresAt: string;
  monthlyPrice: string;
  notes: string;
};

function ManageDrawer({
  provider,
  admins,
  onClose,
  onChange,
}: {
  provider: Provider;
  admins: Admin[];
  onClose: () => void;
  onChange: () => Promise<void>;
}) {
  const pos = provider.subscriptions.find((s) => s.module === "POS");
  const rewards = provider.subscriptions.find((s) => s.module === "REWARDS");
  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="flex-1 bg-black/30"
      />
      <aside className="w-full max-w-md bg-creme p-8 shadow-xl overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="text-prune/60 hover:text-prune"
        >
          ✕ Fermer
        </button>
        <p className="mt-4 mb-2 text-sm text-prune/60">{provider.user.email}</p>
        <h2 className="ds-display text-2xl text-prune">{provider.salonName}</h2>

        <ModuleCard
          module="POS"
          providerId={provider.id}
          sub={pos}
          admins={admins}
          onChange={onChange}
        />
        <ModuleCard
          module="REWARDS"
          providerId={provider.id}
          sub={rewards}
          admins={admins}
          onChange={onChange}
        />
      </aside>
    </div>
  );
}

function ModuleCard({
  module,
  providerId,
  sub,
  admins,
  onChange,
}: {
  module: SubscriptionModule;
  providerId: string;
  sub?: Subscription;
  admins: Admin[];
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ActivateForm>({
    status: sub?.status === "TRIAL" ? "TRIAL" : "ACTIVE",
    expiresAt: sub?.expiresAt ? sub.expiresAt.slice(0, 10) : "",
    monthlyPrice: sub?.pricingSnapshot?.monthlyPrice
      ? String(sub.pricingSnapshot.monthlyPrice)
      : "",
    notes: sub?.notes ?? "",
  });

  async function save() {
    const body = {
      providerId,
      module,
      status: form.status,
      expiresAt: form.expiresAt || null,
      pricingSnapshot: form.monthlyPrice
        ? { monthlyPrice: Number(form.monthlyPrice), currency: "DT" }
        : null,
      notes: form.notes || null,
    };
    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditing(false);
      await onChange();
    }
  }

  async function setStatus(status: SubscriptionStatus) {
    if (!sub) return;
    const res = await fetch(`/api/admin/subscriptions/${sub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await onChange();
  }

  const admin = sub?.activatedByUserId
    ? admins.find((a) => a.id === sub.activatedByUserId)
    : null;

  return (
    <section className="mt-6 rounded-2xl border border-hairline bg-white p-6">
      <div className="flex items-center justify-between">
        <p className="ds-display text-lg text-prune">
          {module === "POS" ? "Caisse (POS)" : "Fidélité (Rewards)"}
        </p>
        <StatusPill sub={sub} />
      </div>

      {!editing && sub && (
        <div className="mt-4 space-y-2 text-sm text-prune/60">
          {sub.expiresAt && (
            <p>
              Expire le {new Date(sub.expiresAt).toLocaleDateString("fr-FR")}
            </p>
          )}
          {sub.pricingSnapshot?.monthlyPrice && (
            <p>
              {/* Litteral et non `currency` : le champ vaut "DT" en base (ligne 323,
                  valeur persistee laissee inchangee faute de migration). L'afficher
                  brut reintroduirait « DT » a l'ecran. La monnaie est toujours le
                  dinar tunisien, donc l'affichage est fixe. */}
              {sub.pricingSnapshot.monthlyPrice} TND{" "}
              / mois
            </p>
          )}
          {sub.notes && <p className="italic">{sub.notes}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {!sub && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg bg-prune px-4 py-2 text-white hover:bg-prune/90"
          >
            Activer
          </button>
        )}
        {sub && (sub.status === "ACTIVE" || sub.status === "TRIAL") && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-hairline bg-white px-4 py-2 text-prune hover:border-rose"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => setStatus("SUSPENDED")}
              className="rounded-lg border border-rose/50 bg-white px-4 py-2 text-rose-fonce hover:bg-rose-soft"
            >
              Suspendre
            </button>
          </>
        )}
        {sub?.status === "SUSPENDED" && (
          <button
            type="button"
            onClick={() => setStatus("ACTIVE")}
            className="rounded-lg bg-prune px-4 py-2 text-white hover:bg-prune/90"
          >
            Réactiver
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ActivateForm["status"] })
            }
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm"
          >
            <option value="ACTIVE">Actif</option>
            <option value="TRIAL">Essai</option>
          </select>
          <input
            type="date"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            placeholder="Date d'expiration"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="1"
            value={form.monthlyPrice}
            onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })}
            placeholder="Prix mensuel (TND)"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            rows={3}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-prune px-4 py-2 text-white hover:bg-prune/90"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-hairline bg-white px-4 py-2 text-prune/60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {admin && (
        <p className="mt-4 text-prune/60">
          Activé par {admin.name ?? admin.email} le{" "}
          {new Date(sub!.updatedAt).toLocaleDateString("fr-FR")}
        </p>
      )}
    </section>
  );
}
