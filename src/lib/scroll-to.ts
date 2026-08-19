/**
 * Amene un element dans le champ de vision, en douceur.
 *
 * Sert a enchainer les etapes d'une reservation : « Réserver » fait descendre
 * au calendrier, choisir une date fait descendre aux horaires. Sans cela, le
 * contenu apparait plus bas que l'ecran et la cliente croit qu'il ne s'est
 * rien passe.
 *
 * Deux precautions :
 *
 * - `requestAnimationFrame` : l'element vient d'apparaitre au rendu suivant,
 *   defiler avant qu'il existe ne ferait rien.
 * - `prefers-reduced-motion` : un defilement anime declenche des nausees chez
 *   les personnes sensibles au mouvement. On saute alors directement.
 */
export function scrollToElement(el: HTMLElement | null): void {
  if (!el) return;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => {
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  });
}
