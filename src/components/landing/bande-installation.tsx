"use client";

import { useEffect, useState } from "react";
import {
  CLE_REPORT,
  DELAI_AVANT_AFFICHAGE_MS,
  decider,
  detecterIos,
  finDuReport,
  lireReport,
  type Affichage,
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
  ios: string;
};

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

      setAffichage(
        decider({
          dejaInstallee: standalone,
          invitationDisponible: invitation !== null,
          estIos: detecterIos(
            navigator.userAgent,
            (navigator as unknown as { standalone?: boolean }).standalone,
          ),
          reportJusqua: report,
        }),
      );
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

  if (!affichage.montrer) return null;

  return (
    <div className="inst" role="region" aria-label={t.titre}>
      <div className="inst-in">
        <div className="inst-txt">
          <strong>{t.titre}</strong>
          <span>{affichage.mode === "instructions-ios" ? t.ios : t.texte}</span>
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
