import Link from "next/link";
import { exigerSuperadmin } from "@/lib/superadmin-session";
import { chercherSalons } from "@/lib/support-donnees";
import { afficher, formaterTelephone, estRenseigne } from "@/lib/profil-salon-complet";
import { Copiable } from "./copiable";

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
        <>
          <p className="text-sm text-prune-soft">
            {resultats.length} salon{resultats.length > 1 ? "s" : ""} trouvé
            {resultats.length > 1 ? "s" : ""}
            {resultats.length === 20 && " (20 premiers — affine la recherche)"}
          </p>
          {/*
            Une LISTE DE CARTES, plus un rang d'une seule ligne : les
            coordonnees completes ne tenaient pas sur une ligne de telephone,
            et c'est justement la qu'on les consulte.

            Le nom du salon reste le seul lien vers la fiche. Les coordonnees
            portent leurs propres liens (`tel:`, `mailto:`) et un bouton
            copier — imbriques dans un `<Link>`, ils auraient ete inatteignables.
          */}
          <ul className="flex flex-col gap-3">
            {resultats.map((s) => (
              <li
                key={s.id}
                className="rounded-[var(--radius-card)] border border-hairline bg-white px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/superadmin/salons/${s.id}`}
                    className="ds-focus font-semibold text-prune underline decoration-hairline hover:decoration-prune"
                  >
                    {s.salonName}
                  </Link>
                  {s.suspendu && (
                    <span className="rounded-[var(--radius-pill)] bg-rose-soft px-2 py-0.5 text-xs font-semibold text-prune">
                      Suspendu
                    </span>
                  )}
                  <span className="text-xs text-prune-soft">
                    inscrit le {s.createdAt.toLocaleDateString("fr-FR")}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Champ label="Ville">
                    <Copiable valeur={afficher(s.city)} absent={!estRenseigne(s.city)} />
                  </Champ>
                  <Champ label="Téléphone">
                    <Copiable
                      valeur={formaterTelephone(s.phone)}
                      lien={s.lienTel}
                      absent={!s.lienTel}
                    />
                  </Champ>
                  <Champ label="E-mail">
                    <Copiable
                      valeur={afficher(s.email)}
                      lien={s.email ? `mailto:${s.email}` : null}
                      absent={!estRenseigne(s.email)}
                    />
                  </Champ>
                  <Champ label="Matricule fiscal">
                    <Copiable
                      valeur={afficher(s.matriculeFiscal)}
                      absent={!estRenseigne(s.matriculeFiscal)}
                    />
                  </Champ>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      {!terme && (
        <p className="text-sm text-prune-soft">
          Les coordonnées sont affichées en entier, avec un bouton pour les
          copier. Chaque consultation de fiche est enregistrée dans le journal
          d&apos;audit.
        </p>
      )}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-prune-soft">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}
