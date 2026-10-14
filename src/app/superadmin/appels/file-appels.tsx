/**
 * La file d'appels — qui rappeler, dans quel ordre.
 *
 * CHAQUE LIGNE NOMME LE PROBLEME, jamais la marche. La version precedente
 * affichait `LIBELLE_MARCHE`, donc « Profil pret » sur une carte dont la
 * ligne du dessous disait « Ville non renseignee ». Voir
 * `etiquetteProbleme`.
 *
 * Un SIGNAL CLE accompagne l'etiquette : « inscrit hier », « 2 refus caisse
 * fermee », « 4 paniers abandonnes ». L'etiquette dit ou le salon est
 * coince, le signal dit pourquoi l'appeler maintenant.
 *
 * Composant serveur.
 */

import Link from "next/link";
import type { SalonCockpit } from "@/lib/cockpit-appels-donnees";
import { libelleScore } from "@/lib/cockpit-appels";
import { accord, dateRelative, motAccorde } from "@/lib/format-fr";

/**
 * Le signal le plus parlant pour CE salon, ou `null`.
 *
 * Un seul : empiler trois pastilles sur une ligne de liste la rend illisible,
 * et le detail complet est a droite de toute facon. On garde donc le plus
 * actionnable, du plus urgent au plus anodin.
 */
function signalCle(s: SalonCockpit, maintenant: Date): string | null {
  if (s.securite.verrouillages > 0) {
    return `${accord(s.securite.verrouillages, "verrouillage")} de PIN`;
  }
  if (s.ventesRefuseesTiroir > 0) {
    return `${s.ventesRefuseesTiroir} ${motAccorde(s.ventesRefuseesTiroir, "refus")} caisse fermée`;
  }
  if (s.paniersAbandonnes > 0) {
    return `${accord(s.paniersAbandonnes, "panier")} ${motAccorde(s.paniersAbandonnes, "abandonné")}`;
  }
  if (s.securite.mdpIncorrects > 0) {
    return `${accord(s.securite.mdpIncorrects, "échec")} de connexion`;
  }
  // L'assistant abandonne dit CE QUI a decourage — c'est le signal le plus
  // actionnable sur un salon qui vient de s'inscrire.
  if (s.assistantEtape !== null) {
    return `assistant arrêté à l'étape ${s.assistantEtape}${
      s.assistantLibelle ? ` · ${s.assistantLibelle}` : ""
    }`;
  }
  // Rien d'alarmant : l'anciennete reste le signal utile sur un salon qui
  // vient de s'inscrire et n'a encore rien fait.
  return `inscrit ${dateRelative(s.inscritLe, maintenant)}`;
}

export function FileAppels({
  salons,
  choisi,
  lien,
  maintenant = new Date(),
}: {
  salons: readonly SalonCockpit[];
  choisi: string | null;
  lien: (salonId: string) => string;
  maintenant?: Date;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {salons.map((s) => {
        const actif = choisi === s.id;
        const signal = signalCle(s, maintenant);
        const alerte = s.securite.verrouillages > 0;
        return (
          <li key={s.id}>
            <Link
              href={lien(s.id)}
              aria-current={actif ? "true" : undefined}
              className={`ds-focus flex flex-col gap-1 rounded-[var(--radius-card)] border bg-white p-4 ${
                actif ? "border-prune" : "border-hairline hover:border-prune-soft"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate font-semibold text-prune">{s.salonName}</span>
                <span className="shrink-0 text-xs text-prune-soft">
                  {s.city ?? "Ville non renseignée"}
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-1.5">
                {s.probleme && (
                  <span
                    className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold ${
                      alerte ? "bg-rose-soft text-prune" : "bg-creme text-prune"
                    }`}
                  >
                    {s.probleme}
                  </span>
                )}
                {s.score !== null && (
                  <span className="text-xs text-prune-soft">
                    {s.score}/100 · {libelleScore(s.score)}
                  </span>
                )}
              </span>

              {signal && <span className="text-xs text-prune-soft">{signal}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
