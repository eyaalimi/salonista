/**
 * Que faire quand `/api/pos/signup` recoit un email deja connu ?
 *
 * Cette route est PUBLIQUE et SANS AUTHENTIFICATION : n'importe qui peut la
 * joindre depuis /pos-start en saisissant l'email de son choix. Elle ne doit
 * donc JAMAIS ecrire sur une ligne User existante.
 *
 * Une version precedente reutilisait le compte trouve : elle forcait
 * `role: "PROVIDER"` et posait `emailVerified` sur le compte d'une cliente ou
 * d'une influenceuse qui n'avait rien demande. En saisissant l'email d'une
 * victime, un inconnu transformait son compte en salon. La victime n'en etait
 * prevenue par rien.
 *
 * La regle est desormais sans exception : email libre -> creation ; email
 * connu -> refus, quel que soit le role du compte trouve et qu'il possede ou
 * non un profil salon. Le refus se contente d'inviter a se connecter.
 *
 * TODO — le cas legitime « une cliente existante veut ouvrir son salon » n'est
 * pas traite ici et ne peut pas l'etre : cette route ne sait pas qui parle.
 * Il devra passer par une action AUTHENTIFIEE depuis l'espace de la cliente,
 * ou elle prouve qu'elle detient bien le compte avant de le promouvoir.
 */

/** Ce que la route doit faire du corps de la requete. */
export type PosSignupDecision =
  | { action: "create" }
  | { action: "reject"; status: number; error: string };

/**
 * Le message est identique que le compte trouve soit un salon, une cliente ou
 * une influenceuse. Distinguer les deux cas transformerait la route en oracle
 * a inscrits : on repondrait « ce n'est pas un salon » a qui teste un email,
 * ce qui revient a confirmer l'existence du compte et son type.
 */
const DEJA_INSCRIT =
  "Un compte existe déjà avec cet email. Connectez-vous pour continuer.";

/**
 * @param compteExistant `true` si un User porte deja cet email, avec ou sans
 *   profil salon. L'appelant fait la requete ; cette fonction ne decide que.
 */
export function decidePosSignup(compteExistant: boolean): PosSignupDecision {
  if (compteExistant) {
    return { action: "reject", status: 409, error: DEJA_INSCRIT };
  }
  return { action: "create" };
}
