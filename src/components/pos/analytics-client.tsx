"use client";

/**
 * Tableau de bord du salon — volontairement sans graphique.
 *
 * La version precedente affichait une courbe de revenu, deux diagrammes en
 * barres et une carte de chaleur des heures, avec un vocabulaire de gestion
 * (« revenu net », « ticket moyen », « heures d'affluence »). Pour une
 * proprietaire qui n'a pas fait d'etudes de gestion, cela se lit comme un
 * exercice de mathematiques : il faut dechiffrer avant de comprendre.
 *
 * Ici, chaque chiffre est accompagne de la phrase qui l'explique, en mots de
 * tous les jours. On ne demande jamais de lire un axe ni d'interpreter une
 * pente. Les donnees viennent des memes API qu'avant — seule la presentation
 * change.
 */

import { useEffect, useState } from "react";
import { formatDT } from "@/lib/money";

type Periode = "today" | "yesterday" | "7d" | "30d" | "thisMonth";

const PERIODES: { value: Periode; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "thisMonth", label: "Ce mois" },
];

type Summary = {
  current: {
    netRevenue: string;
    paidCount: number;
    avgTicket: string | null;
    newCustomers: number;
  };
  previous: { netRevenue: string; paidCount: number; newCustomers: number };
};

type Ligne = { name: string; quantity: number; revenue: string };
type Produit = { id: string; name: string; stockQuantity: number };

function bornes(p: Periode): { from: Date; to: Date } {
  const now = new Date();
  const debutAujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const finAujourdhui = new Date(debutAujourdhui.getTime() + 24 * 60 * 60 * 1000 - 1);
  const jour = 24 * 60 * 60 * 1000;

  switch (p) {
    case "today":
      return { from: debutAujourdhui, to: finAujourdhui };
    case "yesterday":
      return {
        from: new Date(debutAujourdhui.getTime() - jour),
        to: new Date(debutAujourdhui.getTime() - 1),
      };
    case "7d":
      return { from: new Date(debutAujourdhui.getTime() - 7 * jour), to: finAujourdhui };
    case "30d":
      return { from: new Date(debutAujourdhui.getTime() - 30 * jour), to: finAujourdhui };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: finAujourdhui };
  }
}

/**
 * Compare deux periodes en une phrase, jamais en pourcentage seul.
 *
 * « +18 % » demande de savoir par rapport a quoi. « 45 TND de plus qu'hier »
 * se comprend sans effort.
 */
function comparaison(actuel: number, precedent: number, periode: Periode): string | null {
  if (precedent === 0) return null;
  const ecart = actuel - precedent;
  if (Math.abs(ecart) < 0.001) return `Comme ${motPrecedent(periode)}`;
  const sens = ecart > 0 ? "de plus" : "de moins";
  return `${formatDT(Math.abs(ecart).toFixed(3))} ${sens} ${motPrecedent(periode)}`;
}

function comparaisonNombre(actuel: number, precedent: number, periode: Periode): string | null {
  if (precedent === 0) return null;
  const ecart = actuel - precedent;
  if (ecart === 0) return `Comme ${motPrecedent(periode)}`;
  const sens = ecart > 0 ? "de plus" : "de moins";
  return `${Math.abs(ecart)} ${sens} ${motPrecedent(periode)}`;
}

function motPrecedent(p: Periode): string {
  switch (p) {
    case "today":
      return "qu'hier";
    case "yesterday":
      return "que l'avant-veille";
    case "7d":
      return "que les 7 jours d'avant";
    case "30d":
      return "que les 30 jours d'avant";
    case "thisMonth":
      return "que le mois dernier";
  }
}

export function AnalyticsClient() {
  const [periode, setPeriode] = useState<Periode>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [services, setServices] = useState<Ligne[]>([]);
  const [produits, setProduits] = useState<Ligne[]>([]);
  const [stockFaible, setStockFaible] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    // `annule` evite d'ecrire l'etat d'une periode abandonnee : si la
    // proprietaire change de periode pendant le chargement, la reponse lente
    // de la precedente ecraserait sinon la nouvelle.
    let annule = false;
    const { from, to } = bornes(periode);
    const q = `from=${from.toISOString()}&to=${to.toISOString()}`;

    async function charger() {
      try {
        const [s, ts, tp, ls] = await Promise.all([
          fetch(`/api/pos/analytics/summary?${q}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/pos/analytics/top-services?${q}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/pos/analytics/top-products?${q}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/pos/analytics/low-stock`).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (annule) return;
        setSummary(s);
        // Les deux routes renvoient `{ top }` — verifie dans le code des API,
        // pas devine : une cle erronee afficherait des listes vides sans erreur.
        setServices(ts?.top ?? []);
        setProduits(tp?.top ?? []);
        setStockFaible(ls?.products ?? []);
      } finally {
        if (!annule) setChargement(false);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [periode]);

  const gagne = summary ? Number(summary.current.netRevenue) : 0;
  const clientes = summary?.current.paidCount ?? 0;
  const moyenne = summary?.current.avgTicket;
  const nouvelles = summary?.current.newCustomers ?? 0;

  return (
    <div className="min-h-full bg-creme p-5 md:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="ds-display text-2xl text-prune md:text-3xl">Mon salon</h1>
        <p className="mt-1 text-base text-prune-soft">
          Voici comment marche ton salon.
        </p>

        {/* Choix de la periode — des boutons larges, pas un menu deroulant :
            on voit toutes les options d'un coup et la cible fait 44px. */}
        <div className="mt-5 flex flex-wrap gap-2">
          {PERIODES.map((p) => {
            const actif = p.value === periode;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  // Le voyant de chargement est arme ici, dans le clic, et non
                  // dans l'effet : y appeler setState declenche un rendu en
                  // cascade que React signale.
                  if (p.value !== periode) {
                    setChargement(true);
                    setPeriode(p.value);
                  }
                }}
                className={`ds-press ds-focus min-h-[44px] rounded-[var(--radius-pill)] border-2 px-4 text-sm font-semibold ${
                  actif
                    ? "border-rose bg-rose text-prune"
                    : "border-hairline bg-white text-prune-soft hover:border-rose"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {chargement ? (
          <p className="mt-8 text-base text-prune-soft">Chargement…</p>
        ) : (
          <>
            {/* Le chiffre qui compte, seul et en grand. */}
            <div className="mt-6 rounded-[var(--radius-card)] border-2 border-hairline bg-menthe p-6 md:p-8">
              <p className="text-base font-semibold text-prune">Tu as gagné</p>
              <p className="ds-display mt-1 text-4xl text-prune md:text-5xl">
                {formatDT(summary?.current.netRevenue ?? "0")}
              </p>
              {summary && (
                <p className="mt-2 text-sm font-semibold text-prune">
                  {comparaison(gagne, Number(summary.previous.netRevenue), periode) ??
                    "Première période enregistrée"}
                </p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Carte
                titre="Clientes servies"
                valeur={String(clientes)}
                phrase={
                  summary
                    ? comparaisonNombre(clientes, summary.previous.paidCount, periode) ??
                      "Sur cette période"
                    : ""
                }
              />
              <Carte
                titre="Chaque cliente dépense en moyenne"
                valeur={moyenne ? formatDT(moyenne) : "—"}
                phrase={
                  clientes > 0
                    ? "En moyenne, par passage en caisse"
                    : "Aucune vente sur cette période"
                }
              />
              <Carte
                titre="Nouvelles clientes"
                valeur={String(nouvelles)}
                phrase={
                  summary
                    ? comparaisonNombre(nouvelles, summary.previous.newCustomers, periode) ??
                      "Elles viennent pour la première fois"
                    : ""
                }
              />
              <Carte
                titre="Ton service le plus demandé"
                valeur={services[0]?.name ?? "—"}
                phrase={
                  services[0]
                    ? `${services[0].quantity} fois sur cette période`
                    : "Aucun service vendu sur cette période"
                }
              />
            </div>

            <Palmares titre="Tes services les plus vendus" lignes={services} vide="Aucun service vendu sur cette période." />
            <Palmares titre="Tes produits les plus vendus" lignes={produits} vide="Aucun produit vendu sur cette période." />

            {/* Le seul bloc qui appelle une action : il est en rose. */}
            {stockFaible.length > 0 && (
              <div className="mt-6 rounded-[var(--radius-card)] border-2 border-rose bg-rose-soft p-5 md:p-6">
                <h2 className="ds-display text-lg text-prune">
                  Il faut racheter {stockFaible.length === 1 ? "ce produit" : "ces produits"}
                </h2>
                <p className="mt-1 text-sm text-prune-soft">
                  Il t&apos;en reste très peu en boutique.
                </p>
                <ul className="mt-4 space-y-2">
                  {stockFaible.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-white px-4 py-3"
                    >
                      <span className="min-w-0 truncate text-base text-prune">{p.name}</span>
                      <span className="shrink-0 text-sm font-semibold text-prune">
                        {p.stockQuantity === 0
                          ? "Plus rien"
                          : `${p.stockQuantity} restant${p.stockQuantity > 1 ? "s" : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Carte({ titre, valeur, phrase }: { titre: string; valeur: string; phrase: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5">
      <p className="text-sm font-semibold text-prune-soft">{titre}</p>
      <p className="ds-display mt-1 truncate text-2xl text-prune">{valeur}</p>
      {phrase && <p className="mt-1 text-sm text-prune-soft">{phrase}</p>}
    </div>
  );
}

/**
 * Un classement en liste numerotee plutot qu'en diagramme en barres : la
 * longueur d'une barre se compare a l'oeil, un rang se lit.
 */
function Palmares({ titre, lignes, vide }: { titre: string; lignes: Ligne[]; vide: string }) {
  return (
    <div className="mt-6 rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
      <h2 className="ds-display text-lg text-prune">{titre}</h2>
      {lignes.length === 0 ? (
        <p className="mt-3 text-base text-prune-soft">{vide}</p>
      ) : (
        <ol className="mt-4 space-y-2">
          {lignes.slice(0, 5).map((l, i) => (
            <li key={`${l.name}-${i}`} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-base text-prune">{l.name}</span>
              <span className="shrink-0 text-sm text-prune-soft">
                {l.quantity} fois
              </span>
              <span className="shrink-0 text-base font-semibold text-prune">
                {formatDT(l.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
