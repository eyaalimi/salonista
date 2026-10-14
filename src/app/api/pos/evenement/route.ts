/**
 * POST /api/pos/evenement — les signaux que seul le navigateur connait.
 *
 * Deux evenements seulement passent par ici : l'ouverture de l'ecran de
 * paiement et la visite d'un ecran. Les autres (PIN, mot de passe, refus de
 * tiroir) sont enregistres cote serveur, la ou ils se produisent.
 *
 * LE NAVIGATEUR NE DECLARE QUE LE TYPE. Le salon et l'employee viennent de la
 * SESSION, jamais du corps de la requete — sinon n'importe qui pourrait
 * fabriquer de l'activite pour le salon d'un autre, et le cockpit d'appels
 * afficherait des chiffres inventes. Meme regle que `/api/suivi/evenement`,
 * qui n'autorise que trois etapes declarables.
 *
 * Repond TOUJOURS 204, meme en cas d'echec : la caisse ne doit jamais
 * s'inquieter d'un signal d'observation. Voir l'en-tete de
 * `evenement-salon-ecriture.ts`.
 */

import { NextRequest } from "next/server";
import { getCurrentEmployee } from "@/lib/employee-session";
import { EVENEMENTS, estEcranSuivi } from "@/lib/evenement-salon";
import { ETAPES_ASSISTANT, libelleEtapeAssistant } from "@/lib/cockpit-appels";
import {
  enregistrerEvenementSalon,
  enregistrerVisiteEcran,
} from "@/lib/evenement-salon-ecriture";

/** Les seuls types que le navigateur a le droit de declarer. */
const TYPES_CLIENT = [
  "paiement_ouvert",
  "ecran_visite",
  "onboarding_etape",
  "onboarding_termine",
  "onboarding_quitte",
] as const;

type Corps = {
  type?: string;
  /** Uniquement pour `ecran_visite` : "services" | "reglages" | "caisse". */
  ecran?: string;
  /** Uniquement pour les signaux d'assistant : le numero d'etape, 1 a 5. */
  etape?: number;
};

export async function POST(req: NextRequest) {
  // 204 sans rien faire plutot qu'une erreur : une session expiree pendant
  // qu'un ecran est ouvert ne doit pas faire apparaitre d'echec dans la
  // console d'une caissiere.
  const vide = new Response(null, { status: 204 });

  try {
    const employee = await getCurrentEmployee();
    if (!employee) return vide;

    const corps = (await req.json().catch(() => null)) as Corps | null;
    const type = corps?.type;
    if (!type || !(TYPES_CLIENT as readonly string[]).includes(type)) {
      return vide;
    }

    if (type === "paiement_ouvert") {
      void enregistrerEvenementSalon(EVENEMENTS.PAIEMENT_OUVERT, {
        providerId: employee.providerId,
        employeeId: employee.id,
      });
      return vide;
    }

    if (type.startsWith("onboarding_")) {
      // Le NUMERO est borne a la liste connue : le navigateur ne doit pas
      // pouvoir inventer une etape 42, qui fausserait le suivi.
      const etape = Number(corps?.etape);
      const valide =
        Number.isInteger(etape) && etape >= 1 && etape <= ETAPES_ASSISTANT.length;

      const typeEvenement =
        type === "onboarding_termine"
          ? EVENEMENTS.ONBOARDING_TERMINE
          : type === "onboarding_quitte"
            ? EVENEMENTS.ONBOARDING_QUITTE
            : EVENEMENTS.ONBOARDING_ETAPE_VUE;

      // « etape_vue » n'a aucun sens sans numero : on l'ecarte plutot que
      // d'ecrire une ligne qui ne dira rien au telephone.
      if (typeEvenement === EVENEMENTS.ONBOARDING_ETAPE_VUE && !valide) return vide;

      void enregistrerEvenementSalon(typeEvenement, {
        providerId: employee.providerId,
        employeeId: employee.id,
        metadata: valide
          ? { etape, libelle: libelleEtapeAssistant(etape) }
          : undefined,
      });
      return vide;
    }

    // ecran_visite — l'ecran est controle contre la liste blanche.
    if (!estEcranSuivi(corps?.ecran)) return vide;
    void enregistrerVisiteEcran(corps.ecran, {
      providerId: employee.providerId,
      employeeId: employee.id,
    });
    return vide;
  } catch {
    return vide;
  }
}
