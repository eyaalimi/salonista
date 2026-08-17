"use client";

/**
 * Selecteur de role de la page de connexion.
 *
 * IMPORTANT : il n'agit PAS sur l'authentification. signIn("credentials") ne
 * prend aucun role, et /api/auth/redirect oriente APRES coup selon
 * session.user.role. Ce selecteur change l'accroche et la destination
 * d'inscription — rien d'autre. Le faire filtrer la connexion ajouterait une
 * facon d'echouer pour une information que le systeme connait deja.
 */

export type RoleKey = "CLIENT" | "PROVIDER" | "INFLUENCER";

export const ROLE_OPTIONS: Array<{
  key: RoleKey;
  label: string;
  tagline: string;
  registerHref: string;
}> = [
  {
    key: "CLIENT",
    label: "Cliente",
    tagline: "Réserve ton prochain soin.",
    registerHref: "/register?role=CLIENT",
  },
  {
    key: "PROVIDER",
    label: "Salon",
    tagline: "Gère tes rendez-vous et ta caisse.",
    registerHref: "/register?role=PROVIDER",
  },
  {
    key: "INFLUENCER",
    label: "Influenceuse",
    tagline: "Monétise ton audience.",
    registerHref: "/register?role=INFLUENCER",
  },
];

export function RoleTabs({
  value,
  onChange,
}: {
  value: RoleKey;
  onChange: (next: RoleKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Je suis"
      className="flex gap-1 rounded-[var(--radius-pill)] bg-rose-soft p-1"
    >
      {ROLE_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={
              "ds-press ds-focus flex-1 min-h-[44px] px-3 " +
              "rounded-[var(--radius-pill)] text-sm font-semibold " +
              (active
                ? "bg-rose text-prune"
                : "bg-transparent text-prune hover:bg-white/60")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
