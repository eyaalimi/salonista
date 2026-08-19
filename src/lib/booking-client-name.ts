/**
 * Nom a afficher pour la personne attendue a un rendez-vous.
 *
 * Deux origines coexistent et ne portent pas l'identite au meme endroit :
 *
 * - un rendez-vous cree a la caisse pointe une `Customer`, la fiche client du
 *   salon (prenom, nom, telephone) ;
 * - une reservation prise sur la marketplace n'a PAS de fiche client — la
 *   personne est le `client`, un `User` (nom, e-mail).
 *
 * Le calendrier ne lisait que la premiere, d'ou « Sans client » sur toute
 * reservation venue du site : le salon ne savait pas qui il allait recevoir.
 *
 * En dernier recours on affiche l'identifiant de l'e-mail plutot que l'adresse
 * entiere — « manel.manoula » se lit mieux dans une case de calendrier, et
 * evite d'etaler une adresse personnelle sur un ecran de comptoir.
 */

type CustomerLike = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
} | null;

type ClientLike = {
  name?: string | null;
  email?: string | null;
} | null;

export function bookingClientName(
  customer: CustomerLike,
  client: ClientLike,
  fallback: string,
): string {
  const full = [customer?.firstName, customer?.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");

  return (
    full ||
    customer?.phone?.trim() ||
    client?.name?.trim() ||
    client?.email?.split("@")[0]?.trim() ||
    fallback
  );
}
