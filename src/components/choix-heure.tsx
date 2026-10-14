"use client";

import { optionsPour } from "@/lib/heures-choix";

/**
 * Choix d'une heure, en 24 h, quelle que soit la langue du navigateur.
 *
 * POURQUOI PAS `<input type="time">`.
 *
 * Son format suit la LOCALE DU NAVIGATEUR — `chrome://settings/languages` —
 * et NON la langue du document. `<html lang="fr">` est pourtant deja declare
 * a la racine : poser `lang="fr"` sur le champ n'ajoute donc rien, et une
 * gerante dont le Chrome est en anglais continuait de voir « 06:00 PM ».
 * C'est une limite du champ natif, pas un oubli de configuration : aucun
 * attribut HTML ne permet d'imposer le cycle horaire d'un `type="time"`.
 *
 * Un `<select>` rend ce choix au code. L'affichage est le notre — toujours
 * « 18:00 » — et la valeur reste au meme format « HH:MM » sur 24 heures que
 * le champ natif produisait, donc rien ne change en base ni dans la
 * generation des creneaux.
 *
 * Ce que l'on perd : le petit clavier horaire des telephones. Ce que l'on
 * gagne : une liste de pas de 15 minutes, plus rapide a la souris, et des
 * heures que tout le monde lit de la meme facon.
 */

export function ChoixHeure({
  value,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (valeur: string) => void;
  "aria-label"?: string;
  className?: string;
}) {
  /*
   * Une heure enregistree hors du pas de 15 min (« 09:20 », saisie avant ce
   * changement, ou posee par un script) doit rester selectionnable : sans
   * cela le `<select>` afficherait une valeur vide et la ferait disparaitre
   * au premier enregistrement.
   */
  const options = optionsPour(value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={className}
    >
      {options.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}
