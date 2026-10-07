"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOM_MAX, CATEGORIES_MAX } from "@/lib/categorie-service";

type Categorie = { id: string; nom: string; position: number; nbServices: number };
type Service = { id: string; title: string; categoryId: string | null };

/**
 * Creer les categories du salon et y ranger ses services.
 *
 * DEUX COLONNES, parce que ce sont deux gestes distincts : on cree d'abord
 * ses categories (rarement), puis on y classe ses services (une fois, au
 * debut). Les melanger obligerait a naviguer entre deux ecrans pour une
 * operation qui se fait d'un trait.
 */
export function CategoriesClient({
  categoriesInitiales,
  servicesInitiaux,
}: {
  categoriesInitiales: Categorie[];
  servicesInitiaux: Service[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(categoriesInitiales);
  const [services, setServices] = useState(servicesInitiaux);
  const [nouveauNom, setNouveauNom] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErreur(null);
    const res = await fetch("/api/pos/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nouveauNom }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setErreur(data?.error ?? "Erreur");
      return;
    }
    setCategories((c) => [...c, data.categorie]);
    setNouveauNom("");
    router.refresh();
  }

  async function supprimer(cat: Categorie) {
    const avertissement =
      cat.nbServices > 0
        ? `Supprimer « ${cat.nom} » ? Ses ${cat.nbServices} service(s) ne seront PAS supprimés : ils redeviendront « non classés ».`
        : `Supprimer « ${cat.nom} » ?`;
    if (!confirm(avertissement)) return;

    setBusy(true);
    const res = await fetch(`/api/pos/categories/${cat.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return;

    setCategories((c) => c.filter((x) => x.id !== cat.id));
    // Les services de cette categorie redeviennent non classes cote serveur :
    // on reflete la meme chose ici, sans recharger la page.
    setServices((s) =>
      s.map((x) => (x.categoryId === cat.id ? { ...x, categoryId: null } : x)),
    );
    router.refresh();
  }

  async function classer(serviceId: string, categoryId: string | null) {
    // Mise a jour optimiste : au comptoir, attendre le reseau pour voir une
    // liste deroulante changer donne l'impression d'un ecran casse.
    const avant = services;
    setServices((s) =>
      s.map((x) => (x.id === serviceId ? { ...x, categoryId } : x)),
    );

    // PUT et non PATCH : c'est la methode qu'expose /api/offers/[id].
    // La route fusionne avec l'existant (`body.x ?? offer.x`), envoyer le
    // seul champ `categoryId` ne remet donc rien d'autre a zero.
    const res = await fetch(`/api/offers/${serviceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });

    if (!res.ok) {
      // En echec, on remet l'etat d'avant plutot que de laisser croire que
      // c'est enregistre.
      setServices(avant);
      setErreur("Impossible d'enregistrer. Réessaie.");
      return;
    }
    // Recompte depuis l'etat A JOUR des services, pas depuis `services` qui
    // porte encore la valeur d'avant le `setServices` ci-dessus.
    const apres = avant.map((x) =>
      x.id === serviceId ? { ...x, categoryId } : x,
    );
    setCategories((cs) =>
      cs.map((c) => ({
        ...c,
        nbServices: apres.filter((s) => s.categoryId === c.id).length,
      })),
    );
    router.refresh();
  }

  const nonClasses = services.filter((s) => s.categoryId === null).length;

  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-6" data-pos-theme>
      <div className="mx-auto flex max-w-[1000px] flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-pos-ink">
            Catégories de services
          </h1>
          <p className="mt-1 text-sm text-pos-ink-2">
            Range tes services par famille — Cheveux, Ongles, Soins… Ils
            apparaîtront en onglets dans la caisse.
          </p>
        </div>

        {erreur && (
          <p
            role="alert"
            className="rounded-md bg-pos-highlight px-4 py-3 text-sm text-pos-ink"
          >
            {erreur}
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Colonne 1 : les categories */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pos-ink-2">
              Tes catégories ({categories.length}/{CATEGORIES_MAX})
            </h2>

            <form onSubmit={creer} className="flex gap-2">
              <input
                value={nouveauNom}
                onChange={(e) => setNouveauNom(e.target.value.slice(0, NOM_MAX))}
                placeholder="Cheveux, Ongles, Soins visage…"
                className="min-h-[44px] flex-1 rounded-md border border-pos-border bg-white px-4 text-base text-pos-ink"
              />
              <button
                type="submit"
                disabled={busy || nouveauNom.trim().length < 2 || categories.length >= CATEGORIES_MAX}
                className="min-h-[44px] rounded-md bg-pos-ink px-5 text-sm font-semibold text-pos-bg disabled:opacity-50"
              >
                Ajouter
              </button>
            </form>

            {categories.length === 0 ? (
              <p className="rounded-md border border-pos-border bg-white px-4 py-6 text-sm text-pos-ink-3">
                Aucune catégorie. Crée la première ci-dessus.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-md border border-pos-border bg-white">
                {categories.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 border-b border-pos-border px-4 py-3 last:border-0"
                  >
                    <span className="font-medium text-pos-ink">{c.nom}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-pos-ink-3">
                        {c.nbServices} service{c.nbServices > 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => supprimer(c)}
                        disabled={busy}
                        className="text-xs font-semibold text-pos-danger hover:underline disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Colonne 2 : classer les services */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-pos-ink-2">
              Ranger tes services
            </h2>

            {nonClasses > 0 && categories.length > 0 && (
              <p className="rounded-md bg-pos-highlight px-4 py-2 text-xs text-pos-ink">
                {nonClasses} service{nonClasses > 1 ? "s" : ""} sans catégorie.
                Ils restent visibles dans l&apos;onglet « Toutes ».
              </p>
            )}

            {services.length === 0 ? (
              <p className="rounded-md border border-pos-border bg-white px-4 py-6 text-sm text-pos-ink-3">
                Aucun service actif.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-md border border-pos-border bg-white">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-pos-border px-4 py-2.5 last:border-0"
                  >
                    <span className="min-w-[140px] flex-1 text-sm text-pos-ink">
                      {s.title}
                    </span>
                    <select
                      value={s.categoryId ?? ""}
                      onChange={(e) => classer(s.id, e.target.value || null)}
                      disabled={categories.length === 0}
                      className="min-h-[40px] rounded-md border border-pos-border bg-white px-3 text-sm text-pos-ink disabled:opacity-50"
                    >
                      <option value="">Non classé</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
