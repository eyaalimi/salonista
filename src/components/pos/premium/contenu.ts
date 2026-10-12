/**
 * Ce que le Premium apporte, en mots simples. Un seul texte pour la page
 * /pos/premium, la fenetre de presentation et les pages verrouillees : les
 * trois ne doivent pas promettre des choses differentes.
 */

import { PRIX_PREMIUM_DT } from "@/lib/plan";

export const PRIX_PREMIUM_LIBELLE = `${PRIX_PREMIUM_DT} DT/mois`;

export const AVANTAGES_PREMIUM = [
  {
    titre: "La fidélité",
    texte:
      "Vos clientes gagnent des points à chaque visite et les utilisent pour payer. Elles reviennent plus souvent.",
  },
  {
    titre: "Toute votre équipe",
    texte:
      "Autant d'employées que vous voulez, chacune avec son code PIN. En version gratuite : la gérante et une employée.",
  },
  {
    titre: "Les commissions",
    texte:
      "La caisse calcule ce que gagne chaque employée sur ses services, et vous les réglez en un geste.",
  },
] as const;

export const CE_QUI_RESTE_GRATUIT =
  "La caisse reste gratuite pour toujours : encaissement, tickets, rendez-vous, fiches clientes, stock, statistiques, tiroir et rapport Z.";
