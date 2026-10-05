import Link from "next/link";

/**
 * Gabarit commun aux pages legales (confidentialite, conditions).
 *
 * Elles ne partagent le style d'aucune autre partie du site : ni la landing
 * (qui a sa propre feuille `landing.css`), ni la caisse (reservee aux salons
 * connectes). Un gabarit commun evite d'avoir deux mises en page divergentes
 * a maintenir — et ces pages sont amenees a etre relues par Meta, par des
 * salons, et un jour par un juriste.
 */
export function LegalPage({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  /** Date de derniere revision, affichee en tete. Format libre, en francais. */
  miseAJour: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-creme">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-5 py-5">
          <Link href="/" className="ds-display text-2xl text-prune">
            Salonista<span className="text-rose-fonce">.</span>
          </Link>
          <Link
            href="/"
            className="ds-focus text-sm font-semibold text-prune-soft hover:text-prune"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 py-10 sm:py-14">
        <h1 className="ds-display text-3xl text-prune sm:text-4xl">{titre}</h1>
        <p className="mt-3 text-sm text-prune-soft">
          Dernière mise à jour : {miseAJour}
        </p>

        {/*
         * `legal-corps` porte la typographie du texte long (titres, listes,
         * liens). Defini dans globals.css plutot qu'ici : ces pages n'ont pas
         * de composant par paragraphe, le texte est ecrit directement en JSX.
         */}
        <div className="legal-corps mt-10">{children}</div>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-[760px] flex-wrap gap-x-6 gap-y-2 px-5 py-6 text-sm text-prune-soft">
          <Link href="/confidentialite" className="ds-focus hover:text-prune">
            Politique de confidentialité
          </Link>
          <Link href="/conditions" className="ds-focus hover:text-prune">
            Conditions d&apos;utilisation
          </Link>
          <a href="mailto:contact@salonista.tn" className="ds-focus hover:text-prune">
            contact@salonista.tn
          </a>
        </div>
      </footer>
    </div>
  );
}
