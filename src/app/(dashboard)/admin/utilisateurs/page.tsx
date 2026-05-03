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

const roleStyles: Record<string, string> = {
  CLIENT: "border-blue-300 text-blue-700",
  PROVIDER: "border-emerald-300 text-emerald-700",
  INFLUENCER: "border-purple-300 text-purple-700",
  ADMIN: "border-brand-gold text-brand-gold",
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
    return <div className="flex items-center justify-center h-64 text-brand-bordeaux/40 text-xs tracking-[0.2em] uppercase">Chargement...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <p className="luxury-badge mb-3">Administration</p>
        <h1 className="luxury-heading text-3xl text-brand-bordeaux">Utilisateurs</h1>
        <p className="text-sm text-brand-bordeaux/40 mt-2">{users.length} utilisateurs inscrits</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email..."
          className="flex-1 px-4 py-3 border border-brand-gold/20 bg-white text-brand-bordeaux text-sm placeholder:text-brand-bordeaux/30 focus:outline-none focus:border-brand-gold transition-colors"
        />
        <div className="flex gap-2 flex-wrap">
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
              className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors duration-500 ${
                filter === f.key
                  ? "bg-brand-bordeaux text-white"
                  : "border border-brand-gold/20 text-brand-bordeaux/60 hover:border-brand-gold"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users list */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-brand-gold/20 p-16 text-center">
          <p className="text-brand-bordeaux/40 text-sm">Aucun utilisateur trouve</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <div key={user.id} className="bg-white border border-brand-gold/20 p-5 hover:border-brand-gold transition-colors duration-500">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-brand-bordeaux flex items-center justify-center text-white text-sm font-medium shrink-0">
                    {user.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-brand-bordeaux truncate">{user.name || "Sans nom"}</p>
                      <span className={`px-2 py-0.5 border text-[9px] tracking-[0.1em] uppercase font-medium ${roleStyles[user.role] || "border-gray-300 text-gray-600"}`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </div>
                    <p className="text-xs text-brand-bordeaux/40 truncate">{user.email}</p>
                    {user.providerProfile && (
                      <p className="text-xs text-brand-bordeaux/30 mt-0.5">
                        Salon: {user.providerProfile.salonName}
                        {user.providerProfile.verified && <span className="ml-2 text-brand-gold">· Vérifié</span>}
                      </p>
                    )}
                    {user.influencerProfile && (
                      <p className="text-xs text-brand-bordeaux/30 mt-0.5">
                        @{user.influencerProfile.instagramHandle} · {user.influencerProfile.followersCount} followers
                        {user.influencerProfile.verified && <span className="ml-2 text-brand-gold">· Vérifiée</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-brand-bordeaux/30">
                    {user._count.bookings} reserv. · {new Date(user.createdAt).toLocaleDateString("fr-TN")}
                  </span>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    className="px-3 py-1.5 border border-brand-gold/20 text-xs text-brand-bordeaux bg-transparent focus:outline-none focus:border-brand-gold transition-colors"
                  >
                    <option value="CLIENT">Client</option>
                    <option value="PROVIDER">Prestataire</option>
                    <option value="INFLUENCER">Influenceuse</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  {user.influencerProfile && (
                    <button
                      onClick={() => toggleVerified(user.id, "influencer", !user.influencerProfile!.verified)}
                      className={`px-3 py-1.5 border text-xs tracking-[0.1em] uppercase transition-colors duration-500 ${
                        user.influencerProfile.verified
                          ? "border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                          : "border-brand-gold/30 text-brand-bordeaux/60 hover:border-brand-gold hover:text-brand-gold"
                      }`}
                      title={user.influencerProfile.verified ? "Retirer la vérification" : "Vérifier cette influenceuse"}
                    >
                      {user.influencerProfile.verified ? "Vérifiée" : "Vérifier"}
                    </button>
                  )}
                  {user.providerProfile && (
                    <button
                      onClick={() => toggleVerified(user.id, "provider", !user.providerProfile!.verified)}
                      className={`px-3 py-1.5 border text-xs tracking-[0.1em] uppercase transition-colors duration-500 ${
                        user.providerProfile.verified
                          ? "border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                          : "border-brand-gold/30 text-brand-bordeaux/60 hover:border-brand-gold hover:text-brand-gold"
                      }`}
                      title={user.providerProfile.verified ? "Retirer la vérification" : "Vérifier ce prestataire"}
                    >
                      {user.providerProfile.verified ? "Vérifié" : "Vérifier"}
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(user.id, user.email)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 text-xs tracking-[0.1em] uppercase hover:bg-red-50 transition-colors duration-500"
                  >
                    Suppr.
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
