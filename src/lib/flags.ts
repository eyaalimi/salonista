/**
 * Drapeaux d'exposition publique.
 *
 * Salonista lance d'abord sa caisse, gratuitement, avant d'ouvrir sa place de
 * marche. Tant que `MARKETPLACE_PUBLIQUE` vaut false :
 *
 *   - la racine "/" sert la landing de la caisse ;
 *   - /offres, /offre/[id], /salon/[id] et /pro redirigent vers "/" ;
 *   - le plan du site n'annonce plus que "/" et "/pos-start" ;
 *   - la navigation basse de la cliente disparait.
 *
 * Repasser ce drapeau a true, redeplacer
 * src/components/legacy/marketplace-home.tsx en src/app/page.tsx, et la place
 * de marche est de retour — aucune donnee n'a ete touchee entre-temps.
 *
 * Les parcours d'authentification (/login, /register, /salon-pin, /pos-start)
 * et toute la caisse (/pos/*) restent ouverts dans les deux cas : des salons
 * s'en servent deja.
 */
export const MARKETPLACE_PUBLIQUE = false;
