"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phone: string | null;
  createdAt: string;
  providerProfile: { salonName: string; verified: boolean } | null;
  influencerProfile: { instagramHandle: string; verified: boolean; followersCount: number } | null;
  _count: { bookings: number };
}

const roleLabels: Record<string, string> = {
  CLIENT: "Client",
  PROVIDER: "Prestataire",
  INFLUENCER: "Influenceuse",
  ADMIN: "Admin",
};

/**
 * Quatre roles, trois tons dans la charte (menthe, rose, prune). Plutot que
 * d'en confondre deux, le quatrieme reste neutre : c'est CLIENT, le role par
 * defaut et le plus nombreux, pour qui l'absence de couleur ne perd aucune
 * information. Les trois roles qui demandent une action de l'admin —
 * verifier un salon, une influenceuse, reperer un pair — gardent un ton.
 */
const roleStyles: Record<string, string> = {
  CLIENT: "border-hairline text-prune/60",
  PROVIDER: "border-menthe-deep/40 text-menthe-deep",
  INFLUENCER: "border-rose/40 text-rose-fonce",
  ADMIN: "border-prune/30 text-prune",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeRole(userId: string, role: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    await loadUsers();
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Supprimer l'utilisateur ${email} ? Cette action est irreversible.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    await loadUsers();
  }

  async function toggleVerified(userId: string, kind: "influencer" | "provider", next: boolean) {
    const field = kind === "influencer" ? "verifiedInfluencer" : "verifiedProvider";
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: next }),
    });
    await loadUsers();
  }

  const filtered = users.filter((u) => {
    if (filter !== "ALL" && u.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (u.name?.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        u.providerProfile?.salonName.toLowerCase().includes(q) ||
        u.influencerProfile?.instagramHandle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-prune/50">
        Chargement…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="ds-display text-3xl text-prune">Utilisateurs</h1>
        <p className="mt-2 text-base text-prune/60">
          {users.length} utilisateur{users.length > 1 ? "s" : ""} inscrit
          {users.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Recherche et filtres */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email…"
          aria-label="Rechercher un utilisateur"
          className="ds-focus min-h-[52px] flex-1 rounded-[var(--radius-pill)] border border-hairline bg-white px-4 text-base text-prune placeholder:text-prune/40"
        />
        <div className="flex flex-wrap gap-2">
          {[
            { key: "ALL", label: "Tous" },
            { key: "CLIENT", label: "Clients" },
            { key: "PROVIDER", label: "Prestataires" },
            { key: "INFLUENCER", label: "Influenceuses" },
            { key: "ADMIN", label: "Admins" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] px-4 text-sm transition-colors ${
                filter === f.key
                  ? "bg-prune text-white"
                  : "border border-hairline text-prune/70 hover:border-rose"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-hairline bg-white p-12 text-center">
          <p className="text-base text-prune/50">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="rounded-[var(--radius-card)] border border-hairline bg-white p-4 transition-colors hover:border-rose"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-prune text-base font-medium text-white">
                    {user.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-medium text-prune">
                        {user.name || "Sans nom"}
                      </p>
                      <span
                        className={`shrink-0 rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs ${roleStyles[user.role] || "border-hairline text-prune/60"}`}
                      >
                        {roleLabels[user.role] || user.role}
                      </span>
                    </div>
                    <p className="truncate text-sm text-prune/60">{user.email}</p>
                    {user.providerProfile && (
                      <p className="mt-0.5 text-sm text-prune/50">
                        Salon : {user.providerProfile.salonName}
                        {user.providerProfile.verified && (
                          <span className="ml-2 text-menthe-deep">· Vérifié</span>
                        )}
                      </p>
                    )}
                    {user.influencerProfile && (
                      <p className="mt-0.5 text-sm text-prune/50">
                        @{user.influencerProfile.instagramHandle} ·{" "}
                        {user.influencerProfile.followersCount} abonnés
                        {user.influencerProfile.verified && (
                          <span className="ml-2 text-menthe-deep">· Vérifiée</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-prune/50">
                    {user._count.bookings} résa. ·{" "}
                    {new Date(user.createdAt).toLocaleDateString("fr-TN")}
                  </span>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    aria-label={`Rôle de ${user.name || user.email}`}
                    className="ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-hairline bg-white px-3 text-sm text-prune"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="PROVIDER">Prestataire</option>
                    <option value="INFLUENCER">Influenceuse</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  {user.influencerProfile && (
                    <button
                      onClick={() => toggleVerified(user.id, "influencer", !user.influencerProfile!.verified)}
                      className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border px-3 text-sm transition-colors ${
                        user.influencerProfile.verified
                          ? "border-menthe-deep/40 text-menthe-deep"
                          : "border-hairline text-prune/70 hover:border-rose"
                      }`}
                      title={user.influencerProfile.verified ? "Retirer la vérification" : "Vérifier cette influenceuse"}
                    >
                      {user.influencerProfile.verified ? "Vérifiée" : "Vérifier"}
                    </button>
                  )}
                  {user.providerProfile && (
                    <button
                      onClick={() => toggleVerified(user.id, "provider", !user.providerProfile!.verified)}
                      className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border px-3 text-sm transition-colors ${
                        user.providerProfile.verified
                          ? "border-menthe-deep/40 text-menthe-deep"
                          : "border-hairline text-prune/70 hover:border-rose"
                      }`}
                      title={user.providerProfile.verified ? "Retirer la vérification" : "Vérifier ce prestataire"}
                    >
                      {user.providerProfile.verified ? "Vérifié" : "Vérifier"}
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    className="ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border border-rose/50 px-3 text-sm text-rose-fonce transition-colors hover:bg-rose-soft"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
