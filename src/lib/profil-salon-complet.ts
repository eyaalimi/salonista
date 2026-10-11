/**
 * Ce qu'un salon a rempli, et ce qui lui manque.
 *
 * POURQUOI CE FICHIER EXISTE. L'espace superadmin affichait un « — » muet
 * pour chaque champ vide. Impossible de distinguer trois situations tres
 * differentes :
 *
 *   - le salon n'a jamais rempli ce champ ;
 *   - la donnee existe mais l'affichage la masquait ;
 *   - quelque chose est casse.
 *
 * Un tiret ne dit pas laquelle. D'ou ce module, qui nomme explicitement ce
 * qui manque.
 *
 * A SAVOIR : l'inscription (`/api/pos/signup`) ne collecte QUE le nom du
 * salon, le telephone et l'e-mail. Ville, gouvernorat, adresse, matricule
 * fiscal et nom du gerant restent donc vides jusqu'a ce que le salon
 * complete son profil. Un champ vide est la NORME au depart, pas une
 * anomalie — et c'est precisement une raison de rappeler le salon.
 *
 * Pur : aucun acces a Prisma, donc testable directement.
 */

/** Le texte affiche a la place d'une valeur absente. */
export const NON_RENSEIGNE = "Non renseigné";

/**
 * Les champs qui comptent pour juger un profil « complet », et leur libelle.
 *
 * Volontairement RESTREINT a ce qui sert au support et a la facturation.
 * `description`, `logo` ou les photos n'y sont pas : un salon peut tres bien
 * s'en passer, et les compter ferait afficher « 50 % » a un salon
 * parfaitement exploitable — l'indicateur perdrait son sens.
 */
export const CHAMPS_PROFIL = [
  { cle: "city", libelle: "ville" },
  { cle: "governorate", libelle: "gouvernorat" },
  { cle: "address", libelle: "adresse" },
  { cle: "phone", libelle: "téléphone" },
  { cle: "matriculeFiscal", libelle: "matricule fiscal" },
  { cle: "nomGerant", libelle: "nom du gérant" },
] as const;

export type CleProfil = (typeof CHAMPS_PROFIL)[number]["cle"];

/** L'etat de remplissage d'un profil. */
export type CompletionProfil = {
  /** Nombre de champs remplis. */
  remplis: number;
  /** Nombre de champs attendus. */
  total: number;
  /** Pourcentage arrondi, 0 a 100. */
  pourcentage: number;
  /** Les libelles de ce qui manque, dans l'ordre de `CHAMPS_PROFIL`. */
  manquants: string[];
};

/**
 * Une valeur est-elle reellement renseignee ?
 *
 * Une chaine d'espaces compte comme VIDE : un salon qui tape une espace dans
 * le champ ville ne l'a pas renseigne, et l'afficher comme rempli gonflerait
 * le taux sans rien apporter.
 */
export function estRenseigne(valeur: string | null | undefined): boolean {
  return typeof valeur === "string" && valeur.trim().length > 0;
}

/**
 * Le numero sous forme composable (`tel:`), sans espaces.
 *
 * Rend `null` quand il n'y a rien a composer : le gabarit sait alors ne pas
 * afficher de lien mort.
 */
export function lienTelephone(phone: string | null | undefined): string | null {
  if (!estRenseigne(phone)) return null;
  const brut = phone!.trim();
  if (brut.startsWith("walk-in-")) return null;
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length < 8) return null;
  return brut.startsWith("+") ? `+${chiffres}` : chiffres.length === 8 ? `+216${chiffres}` : `+${chiffres}`;
}

/**
 * Calcule le taux de completion d'un profil.
 *
 * Le pourcentage est arrondi a l'entier : afficher « 66,67 % » sur une fiche
 * de support n'aide personne.
 */
export function completionProfil(
  valeurs: Partial<Record<CleProfil, string | null | undefined>>,
): CompletionProfil {
  const manquants: string[] = [];
  let remplis = 0;

  for (const champ of CHAMPS_PROFIL) {
    const valeur = valeurs[champ.cle];
    /*
     * Le telephone a sa propre regle : `walk-in-…` est un identifiant interne
     * de cliente de passage, pas un numero. Sans ce cas particulier,
     * `completionProfil` comptait le champ comme rempli alors que
     * `formaterTelephone` affichait « Non renseigné » juste en dessous — les
     * deux se contredisaient a l'ecran.
     */
    const rempli =
      champ.cle === "phone" ? lienTelephone(valeur) !== null : estRenseigne(valeur);
    if (rempli) remplis += 1;
    else manquants.push(champ.libelle);
  }

  const total = CHAMPS_PROFIL.length;
  return {
    remplis,
    total,
    pourcentage: Math.round((remplis / total) * 100),
    manquants,
  };
}

/**
 * Le texte a afficher pour une valeur, ou `NON_RENSEIGNE` si elle est vide.
 *
 * Centralise la decision : sans cela, chaque ligne de la fiche repeterait son
 * propre `?? "—"` et l'un d'eux finirait par diverger.
 */
export function afficher(valeur: string | null | undefined): string {
  return estRenseigne(valeur) ? valeur!.trim() : NON_RENSEIGNE;
}

/**
 * Formate un numero tunisien pour la LECTURE A VOIX HAUTE.
 *
 * `+21620123456` devient `+216 20 123 456`. La fiche sert a appeler un salon :
 * un numero en un seul bloc de douze chiffres se lit mal au telephone et
 * s'epelle encore plus mal.
 *
 * Tout numero non tunisien ou de longueur inattendue est rendu TEL QUEL :
 * mieux vaut un format brut qu'un numero mal decoupe, qui ferait composer un
 * mauvais appel.
 */
export function formaterTelephone(phone: string | null | undefined): string {
  if (!estRenseigne(phone)) return NON_RENSEIGNE;
  const brut = phone!.trim();

  // Un identifiant de cliente passagere n'est pas un numero.
  if (brut.startsWith("walk-in-")) return NON_RENSEIGNE;

  const chiffres = brut.replace(/\D/g, "");
  /*
   * Moins de 8 chiffres : ce n'est pas un numero composable, donc on ne le
   * presente pas comme un telephone. Sans ce garde-fou, la fiche affichait
   * « 123 » en face de « Téléphone » pendant que la banniere annoncait le
   * telephone comme manquant — un test de coherence l'a attrape.
   */
  if (chiffres.length < 8) return NON_RENSEIGNE;
  // Tunisie : indicatif 216 + 8 chiffres.
  if (chiffres.length === 11 && chiffres.startsWith("216")) {
    const n = chiffres.slice(3);
    return `+216 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  }
  // 8 chiffres locaux, sans indicatif.
  if (chiffres.length === 8) {
    return `${chiffres.slice(0, 2)} ${chiffres.slice(2, 5)} ${chiffres.slice(5)}`;
  }
  return brut;
}
