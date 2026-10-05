import { cookies } from "next/headers";
import {
  COOKIE_VUE_LECTURE,
  VUE_LECTURE_MINUTES,
  vueLectureActive,
} from "@/lib/support-salon";

/**
 * Bandeau affiche pendant une consultation « voir comme le salon ».
 *
 * BIEN VISIBLE, en haut, pleine largeur, couleur d'alerte : quelqu'un qui
 * regarde le compte d'un salon ne doit jamais pouvoir oublier qu'il n'est pas
 * chez lui. Un indicateur discret serait ignore au bout de deux minutes.
 *
 * Il n'applique AUCUNE restriction : la lecture seule est garantie par
 * `requirePermission` cote serveur. Ce bandeau informe, il ne protege pas.
 */
export async function BandeauConsultation() {
  const jar = await cookies();
  const brut = jar.get(COOKIE_VUE_LECTURE)?.value;
  if (!brut) return null;

  const expire = Number(brut);
  if (!Number.isFinite(expire) || !vueLectureActive(new Date(expire))) return null;

  /*
   * PAS DE COMPTE A REBOURS. Un `Date.now()` dans le rendu serait fige a
   * l'instant du rendu serveur : il afficherait « 14 min » pendant tout le
   * reste de la consultation, ce qui est pire qu'une absence d'information.
   * La duree totale, elle, est exacte.
   */
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-rose-fonce px-4 py-2 text-center text-sm font-semibold text-white"
    >
      <span>
        Mode consultation Salonista — lecture seule, aucune modification
        possible.
      </span>
      <span className="opacity-90">
        Session de {VUE_LECTURE_MINUTES} minutes.
      </span>
    </div>
  );
}
