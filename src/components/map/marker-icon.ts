import L from "leaflet";

/**
 * Icone de marqueur en SVG inline, aux couleurs de la marque.
 *
 * Les icones par defaut de Leaflet sont des PNG references en chemins relatifs
 * au CSS ; sous un bundler ces chemins cassent et le marqueur devient
 * invisible — panne classique et deroutante, car la carte s'affiche
 * correctement. Un SVG inline evite le probleme sans fichier a servir.
 */
export function markerIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z" fill="#D4A574"/>
      <circle cx="14" cy="14" r="5" fill="#1F1A1C"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -40],
  });
}
