import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { chercherSalons } from "@/lib/support-donnees";
import { masquerEmail, masquerTelephone } from "@/lib/support-salon";

export default async function RechercheSalonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await exigerSuperadmin();
  const { q } = await searchParams;
  const terme = q?.trim() ?? "";
  const resultats = terme ? await chercherSalons(terme) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="ds-display text-2xl text-prune">Support</h1>
        <p className="mt-1 text-sm text-prune-soft">
          Cherche un salon par nom, téléphone, e-mail ou matricule fiscal.
        </p>
      </div>

      {/* Formulaire en GET : la recherche est partageable par son URL, et la
          page reste un server component. */}
      <form method="GET" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={terme}
          placeholder="Salon Nour, 20123456, nour@..."
          autoFocus
          className="ds-focus min-h-[48px] flex-1 rounded-[var(--radius-pill)] border border-hairline bg-white px-5 text-base text-prune placeholder:text-prune-soft"
        />
        <button
          type="submit"
          className="ds-press ds-focus min-h-[48px] rounded-[var(--radius-pill)] bg-rose px-6 font-semibold text-prune"
        >
          Chercher
        </button>
      </form>

      {terme && resultats.length === 0 && (
        <p className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-6 text-sm text-prune-soft">
          Aucun salon ne correspond à « {terme} ».
          {terme.length < 2 && " Saisis au moins deux caractères."}
        </p>
      )}

      {resultats.length > 0 && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-white">
          {resultats.map((s) => (
            <Link
              key={s.id}
              href={`/superadmin/salons/${s.id}`}
              className="ds-focus flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline px-5 py-4 last:border-0 hover:bg-creme"
            >
              <span className="min-w-[180px] flex-1 font-semibold text-prune">
                {s.salonName}
                {s.suspendu && (
                  <span className="ml-2 rounded-[var(--radius-pill)] bg-rose-soft px-2 py-0.5 text-xs font-semibold text-prune">
                    Suspendu
                  </span>
                )}
              </span>
              <span className="text-sm text-prune-soft">{s.city ?? "—"}</span>
              <span className="text-sm text-prune-soft">{masquerTelephone(s.phone)}</span>
              <span className="text-sm text-prune-soft">{masquerEmail(s.email)}</span>
              <span className="text-xs text-prune-soft">
                {s.createdAt.toLocaleDateString("fr-FR")}
              </span>
            </Link>
          ))}
        </div>
      )}

      {!terme && (
        <p className="text-sm text-prune-soft">
          Les coordonnées sont partiellement masquées : assez pour confirmer au
          téléphone, pas assez pour les recopier.
        </p>
      )}
    </div>
  );
}
