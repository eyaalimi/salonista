/**
 * Faut-il creer une fiche client pour un rendez-vous pris au comptoir ?
 *
 * LE BUG QUE CETTE DECISION CORRIGE. Le tiroir de creation n'enregistrait une
 * `Customer` que si un TELEPHONE etait saisi. Avec un nom seul, rien n'etait
 * cree : le nom etait perdu, la reservation retombait sur le `User` du salon
 * (`Booking.clientId` est obligatoire) et le calendrier affichait le nom du
 * SALON a la place de celui de la cliente. Le meme rendez-vous saisi AVEC un
 * numero affichait le bon nom — d'ou un bug qui ne se voyait que sur les
 * rendez-vous sans telephone.
 *
 * `Customer.phone` est `@unique` et obligatoire en base : une fiche sans
 * numero prend donc un placeholder `walk-in-…`, la meme convention que
 * `POST /api/customers/walk-in`. Les lectures savent deja le masquer
 * (`phone.startsWith("walk-in-")`).
 */

export type DecisionFicheClient =
  | { action: "aucune" }
  | { action: "creer"; firstName: string; lastName: string | null };

/**
 * @param customerId fiche deja choisie dans la recherche, si elle existe
 * @param nomSaisi   nom tape au comptoir pour une cliente inconnue
 */
export function decideFicheClient(
  customerId: string | null | undefined,
  nomSaisi: string | null | undefined,
): DecisionFicheClient {
  // Une fiche existante l'emporte toujours : le nom tape ne doit pas ecraser
  // celui deja enregistre, ni creer un doublon.
  if (customerId) return { action: "aucune" };

  const nom = nomSaisi?.trim();
  if (!nom) return { action: "aucune" };

  const [firstName, ...reste] = nom.split(/\s+/);
  return {
    action: "creer",
    firstName,
    lastName: reste.join(" ") || null,
  };
}

/**
 * Numero de remplacement pour une fiche sans telephone. Le prefixe `walk-in-`
 * ne peut pas entrer en collision avec un vrai numero tunisien, et c'est lui
 * que les lectures reconnaissent pour masquer le champ.
 */
export function placeholderTelephone(
  alea: () => number = Math.random,
  maintenant: () => number = Date.now,
): string {
  return `walk-in-${alea().toString(36).slice(2, 8)}${maintenant().toString(36)}`;
}
