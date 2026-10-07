"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  CLE_REPORT,
  DELAI_AVANT_AFFICHAGE_MS,
  decider,
  detecterIos,
  finDuReport,
  lireReport,
  montrerLienPied,
  type Affichage,
  type EtatInstallation,
} from "@/lib/installation-pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Textes = {
  titre: string;
  texte: string;
  bouton: string;
  plusTard: string;
  iosEtape1: string;
  iosEtape1Fin: string;
  iosEtape2: string;
  lienPied: string;
};

/**
 * L'icone « Partager » d'iOS, dessinee plutot que decrite.
 *
 * Sur iPhone, ce dessin EST l'instruction : « appuie sur Partager » ne veut
 * rien dire pour qui ne reconnait pas le symbole, alors que tout le monde le
 * retrouve des qu'il le voit.
 */
function IconePartage() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inst-ios-icone"
    >
      <path d="M12 3v13" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}

/**
 * Place son contenu dans le pied de page de la landing.
 *
 * Le lien « Installer » appartient visuellement aux liens legaux, mais son
 * etat vit dans la bande. Un portail reconcilie les deux : l'etat reste ici,
 * le rendu part la-bas.
 *
 * `null` tant que la cible n'existe pas — au premier rendu serveur, le DOM
 * n'est pas encore la.
 */
function PortailPied({ children }: { children: React.ReactNode }) {
  /*
   * `useSyncExternalStore` plutot qu'un `useState` pose dans un effet : ce
   * dernier declenche un rendu en cascade, et React 19 le signale. Ici il n'y
   * a d'ailleurs rien a « mettre a jour » — on LIT le DOM, qui est un systeme
   * exterieur. C'est exactement ce que ce hook sait faire.
   *
   * L'instantane cote serveur est `null` : le DOM n'existe pas encore, et le
   * portail ne rend donc rien avant l'hydratation.
   */
  const cible = useSyncExternalStore(
    () => () => {},
    () => document.querySelector(".foot-liens"),
    () => null,
  );
  if (!cible) return null;
  return createPortal(children, cible);
}

/**
 * Invitation a installer l'application, en bas de la landing.
 *
 * TOUTE LA DECISION vit dans `src/lib/installation-pwa.ts` (pur, 17 tests).
 * Ce composant ne fait que brancher le navigateur dessus : Vitest tourne en
 * environnement `node`, sans DOM, donc rien de ce qui est ici ne serait
 * testable autrement.
 *
 * DEUX MODES, parce que les navigateurs ne se valent pas :
 *   - `bouton` — Chrome et consorts emettent `beforeinstallprompt`, on
 *     declenche leur propre invite ;
 *   - `instructions-ios` — Safari n'emet JAMAIS cet evenement. Sans ce
 *     second mode, la moitie des visiteurs tunisiens ne verrait rien.
 */
export function BandeInstallation({ t }: { t: Textes }) {
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(null);
  const [affichage, setAffichage] = useState<Affichage>({ montrer: false });
  /*
   * L'etat BRUT, conserve a part : la bande suit le report, le lien du pied
   * de page NON. Garder les deux decisions separees evite de recalculer la
   * seconde a partir de la premiere, ce qui les lierait a tort.
   */
  const [etat, setEtat] = useState<EtatInstallation | null>(null);

  useEffect(() => {
    /*
     * `beforeinstallprompt` peut arriver AVANT ou APRES notre delai de trois
     * secondes : on l'ecoute donc tout de suite, et on reevalue a chaque
     * changement plutot que de decider une fois pour toutes.
     */
    let invitation: BeforeInstallPromptEvent | null = null;

    const reevaluer = () => {
      const standalone =
        typeof window !== "undefined" &&
        (window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
          (navigator as unknown as { standalone?: boolean }).standalone === true);

      let report: number | null = null;
      try {
        report = lireReport(localStorage.getItem(CLE_REPORT));
      } catch {
        // Navigation privee, stockage refuse : on traite comme « jamais
        // reporte ». Perdre un report est sans gravite ; planter ne l'est pas.
      }

      const courant: EtatInstallation = {
        dejaInstallee: standalone,
        invitationDisponible: invitation !== null,
        estIos: detecterIos(
          navigator.userAgent,
          (navigator as unknown as { standalone?: boolean }).standalone,
        ),
        reportJusqua: report,
      };
      setEtat(courant);
      setAffichage(decider(courant));
    };

    const surInvitation = (e: Event) => {
      // Sans `preventDefault`, Chrome affiche SA propre banniere en plus de
      // la notre — deux invitations pour la meme chose.
      e.preventDefault();
      invitation = e as BeforeInstallPromptEvent;
      setEvenement(invitation);
      reevaluer();
    };

    const surInstallation = () => {
      // L'application vient d'etre installee : la bande n'a plus lieu d'etre.
      setAffichage({ montrer: false });
    };

    window.addEventListener("beforeinstallprompt", surInvitation);
    window.addEventListener("appinstalled", surInstallation);

    // Trois secondes : le visiteur a le temps de voir de quoi parle la page.
    const minuteur = setTimeout(reevaluer, DELAI_AVANT_AFFICHAGE_MS);

    return () => {
      clearTimeout(minuteur);
      window.removeEventListener("beforeinstallprompt", surInvitation);
      window.removeEventListener("appinstalled", surInstallation);
    };
  }, []);

  function reporter() {
    try {
      localStorage.setItem(CLE_REPORT, String(finDuReport()));
    } catch {
      // Stockage refuse : la bande revient a la prochaine visite. Tant pis.
    }
    setAffichage({ montrer: false });
  }

  async function installer() {
    if (!evenement) return;
    await evenement.prompt();
    await evenement.userChoice;
    // L'invitation du navigateur ne se rejoue pas : on ne la garde pas.
    setEvenement(null);
    setAffichage({ montrer: false });
  }

  /** Rouvre la bande depuis le lien du pied de page, report ignore. */
  function rouvrir() {
    if (!etat) return;
    // On EFFACE le report : sans cela, la bande se refermerait aussitot au
    // prochain calcul.
    try {
      localStorage.removeItem(CLE_REPORT);
    } catch {
      // Stockage refuse : la bande s'ouvre quand meme pour cette visite.
    }
    setAffichage(decider({ ...etat, reportJusqua: null }));
  }

  /*
   * Le lien du pied de page est rendu ICI MEME, en position fixe ? Non : il
   * doit vivre DANS le `<footer>`, au milieu des liens legaux. On le sort
   * donc du flux de la bande via un portail — c'est le seul moyen de le
   * placer ailleurs dans l'arbre tout en partageant cet etat.
   */
  if (!affichage.montrer) {
    return etat && montrerLienPied(etat) ? (
      <PortailPied>
        <button type="button" onClick={rouvrir} className="foot-install">
          {t.lienPied}
        </button>
      </PortailPied>
    ) : null;
  }

  return (
    <div className="inst" role="region" aria-label={t.titre}>
      <div className="inst-in">
        <div className="inst-txt">
          <strong>{t.titre}</strong>

          {affichage.mode === "instructions-ios" ? (
            /*
             * Sur iOS, ce bloc remplace le bouton : Safari interdit a un site
             * de declencher l'installation. Deux etapes numerotees, avec le
             * symbole de partage dessine — c'est ce qu'on cherche du regard
             * en bas de l'ecran.
             */
            <ol className="inst-ios">
              <li>
                <span className="inst-ios-no">1</span>
                {t.iosEtape1} <IconePartage /> {t.iosEtape1Fin}
              </li>
              <li>
                <span className="inst-ios-no">2</span>
                {t.iosEtape2}
              </li>
            </ol>
          ) : (
            <span>{t.texte}</span>
          )}
        </div>

        <div className="inst-act">
          {affichage.mode === "bouton" && (
            <button type="button" onClick={installer} className="inst-btn">
              {t.bouton}
            </button>
          )}
          <button type="button" onClick={reporter} className="inst-plus-tard">
            {t.plusTard}
          </button>
        </div>
      </div>
    </div>
  );
}
