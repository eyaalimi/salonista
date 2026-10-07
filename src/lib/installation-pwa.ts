/**
 * L'invitation a installer l'application — les decisions, sans le navigateur.
 *
 * Isole pour etre testable : Vitest tourne en environnement `node`, sans DOM
 * ni `window`. Tout ce qui se decide ici se verifie donc vraiment ; le
 * composant ne fait qu'appliquer.
 */

/** Cle de stockage du report. */
export const CLE_REPORT = "salonista.installation.reportee";

/**
 * Duree du report quand le visiteur ferme la bande.
 *
 * 14 jours : assez pour ne pas harceler quelqu'un qui a dit non, assez court
 * pour reproposer a un salon qui reviendrait vraiment s'inscrire. Trente
 * jours (le reglage de l'ancienne invite) rataient la deuxieme visite, qui
 * est souvent la bonne.
 */
export const REPORT_JOURS = 14;

/**
 * Delai avant d'afficher la bande, en millisecondes.
 *
 * On ne saute pas a la gorge du visiteur : il a trois secondes pour voir de
 * quoi parle la page. Une invitation qui arrive avant la premiere phrase se
 * fait fermer par reflexe, pas par choix.
 */
export const DELAI_AVANT_AFFICHAGE_MS = 3000;

/** Ce que l'appelant sait de la situation. */
export type EtatInstallation = {
  /** L'application tourne-t-elle DEJA en mode installe ? */
  dejaInstallee: boolean;
  /** Le navigateur a-t-il propose l'installation (`beforeinstallprompt`) ? */
  invitationDisponible: boolean;
  /** Est-ce un iPhone ou un iPad hors application installee ? */
  estIos: boolean;
  /** Fin du report precedent, en ms. `null` = jamais reporte. */
  reportJusqua: number | null;
};

/** Ce qu'il faut afficher. */
export type Affichage =
  | { montrer: false }
  /** Un vrai bouton : le navigateur sait installer tout seul. */
  | { montrer: true; mode: "bouton" }
  /** iOS ne propose rien : on explique le geste a la main. */
  | { montrer: true; mode: "instructions-ios" };

/**
 * Faut-il proposer l'installation ?
 *
 * L'ORDRE DES TESTS EST PORTEUR DE SENS :
 *
 * 1. Deja installee — proposer d'installer ce qui l'est deja est le genre de
 *    detail qui fait douter de tout le reste du produit.
 * 2. Report en cours — on a dit non, on respecte.
 * 3. Invitation du navigateur disponible — le cas confortable.
 * 4. iOS — Safari n'emet JAMAIS `beforeinstallprompt`. Sans ce cas, la
 *    moitie des visiteurs tunisiens ne verrait jamais rien.
 *
 * Tout le reste (Firefox pour Android, navigateurs anciens) ne voit rien :
 * mieux vaut aucune invitation qu'un bouton qui ne fait rien.
 */
export function decider(
  etat: EtatInstallation,
  maintenant: number = Date.now(),
): Affichage {
  if (etat.dejaInstallee) return { montrer: false };
  if (etat.reportJusqua !== null && etat.reportJusqua > maintenant) {
    return { montrer: false };
  }
  if (etat.invitationDisponible) return { montrer: true, mode: "bouton" };
  if (etat.estIos) return { montrer: true, mode: "instructions-ios" };
  return { montrer: false };
}

/** Fin du report, a enregistrer quand le visiteur ferme la bande. */
export function finDuReport(maintenant: number = Date.now()): number {
  return maintenant + REPORT_JOURS * 24 * 60 * 60 * 1000;
}

/**
 * Relit la date de report depuis le stockage.
 *
 * Rend `null` pour tout ce qui n'est pas un nombre exploitable : cette valeur
 * vient du navigateur, donc de n'importe qui. Une invitation ne doit jamais
 * disparaitre pour toujours a cause d'une chaine corrompue.
 */
export function lireReport(brut: string | null | undefined): number | null {
  if (!brut) return null;
  const n = Number(brut);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Est-ce un appareil iOS hors application installee ?
 *
 * `navigator.standalone` est une propriete PROPRE A SAFARI : elle vaut `true`
 * quand la page tourne depuis l'icone de l'ecran d'accueil. On ne propose
 * donc pas d'installer a quelqu'un qui a deja installe.
 */
export function detecterIos(
  userAgent: string,
  standalone: boolean | undefined,
): boolean {
  const estAppareilIos = /iPad|iPhone|iPod/.test(userAgent);
  return estAppareilIos && standalone !== true;
}
