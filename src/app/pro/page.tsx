import Link from "next/link";
import { HomeNav } from "@/components/home-nav";

export const metadata = {
  title: "Votre salon sur Salonista — inscription gratuite",
  description:
    "Publiez vos offres, recevez des réservations en ligne et faites-vous découvrir par de nouvelles clientes. L'inscription est gratuite.",
};

const ETAPES = [
  {
    titre: "Créez votre compte",
    texte: "Quelques minutes, sans carte bancaire.",
  },
  {
    titre: "Publiez vos offres",
    texte: "Vos prestations, vos prix, vos horaires.",
  },
  {
    titre: "Recevez des réservations",
    texte: "Les clientes réservent et paient en ligne.",
  },
];

export default function ProPage() {
  return (
    <div className="min-h-screen bg-creme">
      <HomeNav />
      {/* Compense la nav fixe : plus haute sur mobile depuis l'ajout de la
          rangee de liens secondaires. */}
      <div className="h-[104px] md:h-20" />

      <section className="mx-auto max-w-6xl px-4 pt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
          Espace professionnel
        </p>
        <h1 className="ds-display mt-2 text-3xl text-prune md:text-4xl">
          Faites découvrir votre salon
        </h1>
        <p className="mt-3 max-w-xl text-base text-prune-soft">
          Salonista met votre salon devant des clientes qui cherchent une
          coiffeuse, une esthéticienne ou un institut près de chez elles.
          L&apos;inscription est gratuite.
        </p>

        <Link
          href="/register?role=PROVIDER"
          className="ds-press ds-focus mt-6 inline-flex min-h-[52px] items-center rounded-[var(--radius-pill)] bg-rose px-8 text-base font-semibold text-prune"
        >
          Inscrire mon salon
        </Link>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <h2 className="ds-display text-xl text-prune">Comment ça marche</h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ETAPES.map((etape, i) => (
            <li
              key={etape.titre}
              className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-soft text-sm font-bold text-prune">
                {i + 1}
              </span>
              <p className="mt-3 text-base font-semibold text-prune">{etape.titre}</p>
              <p className="mt-1 text-sm text-prune-soft">{etape.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 pb-16">
        <div className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5 md:p-6">
          <h2 className="ds-display text-xl text-prune">Combien ça coûte</h2>
          <p className="mt-2 text-base text-prune-soft">
            Publier vos offres et recevoir des réservations est{" "}
            <span className="font-semibold text-prune">gratuit</span>.
          </p>
          <p className="mt-3 text-base text-prune-soft">
            Notre caisse — encaissement, stock, fidélité — est un module séparé,
            que vous pourrez activer depuis votre espace si elle vous intéresse.
            Rien ne vous y oblige.
          </p>
        </div>
      </section>
    </div>
  );
}
