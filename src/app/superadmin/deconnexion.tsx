"use client";

/**
 * Le bouton « Déconnexion » de l'espace superadmin.
 *
 * POURQUOI UN COMPOSANT CLIENT A PART. Le layout de /superadmin est un
 * composant SERVEUR — il lit la session et interroge Prisma pour verifier la
 * 2FA. `signOut` de NextAuth est un hook client : il ne peut pas y vivre.
 * Ce fichier isole donc la seule portion interactive de l'en-tete, sans
 * forcer tout le layout a passer cote client (ce qui lui aurait fait perdre
 * son acces direct a la base, donc son role de deuxieme garde).
 *
 * POURQUOI C'EST NECESSAIRE. L'en-tete affichait l'e-mail du compte connecte
 * mais n'offrait AUCUN moyen de partir. Sur cet espace precisement, c'est
 * genant : il donne acces aux coordonnees completes de tous les salons et
 * aux actions de support. Quitter demandait d'aller chercher la deconnexion
 * dans un autre espace de l'application, ou de vider ses cookies.
 *
 * LA DECONNEXION ANNULE AUSSI LA 2FA. La fraicheur TOTP vit dans le jeton
 * (`token.totpValideeA`, voir auth.ts), pas en base : detruire la session
 * detruit la fenetre de 30 minutes avec elle. Une reconnexion repassera donc
 * par /superadmin-acces et redemandera un code — c'est bien le comportement
 * attendu, et il n'y a rien a nettoyer en plus.
 */

import { useState } from "react";
import { signOut } from "next-auth/react";

export function BoutonDeconnexion() {
  const [enCours, setEnCours] = useState(false);

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => {
        setEnCours(true);
        // Vers l'accueil, comme partout ailleurs dans l'application.
        // `signOut` ne rend pas la main : pas de `finally` a prevoir, l'etat
        // ne sert qu'a eviter un double clic pendant la redirection.
        void signOut({ callbackUrl: "/" });
      }}
      className="ds-press ds-focus inline-flex min-h-[44px] items-center rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-prune-soft hover:text-rose-fonce disabled:opacity-50"
    >
      {enCours ? "Déconnexion…" : "Déconnexion"}
    </button>
  );
}
