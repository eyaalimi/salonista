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
import {
  enregistrerEvenementSalon,
  enregistrerVisiteEcran,
} from "@/lib/evenement-salon-ecriture";

/** Les seuls types que le navigateur a le droit de declarer. */
const TYPES_CLIENT = ["paiement_ouvert", "ecran_visite"] as const;

type Corps = {
  type?: string;
  /** Uniquement pour `ecran_visite` : "services" | "reglages" | "caisse". */
  ecran?: string;
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
