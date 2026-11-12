/**
 * Validation de la saisie « WhatsApp promos » de la fiche superadmin. Pur.
 *
 * Le JETON est facultatif a la modification : il n'est jamais reaffiche, un
 * champ vide veut dire « garder celui qui est enregistre ». Il est
 * obligatoire a la creation.
 */

import { toMillimes } from "./money";

export const STATUTS_CONNEXION = ["BROUILLON", "ACTIVE", "SUSPENDUE"] as const;
export type StatutConnexion = (typeof STATUTS_CONNEXION)[number];

export type SaisieConnexion = {
  numeroAffiche: string;
  phoneNumberId: string;
  wabaId: string;
  /** null = garder le jeton enregistre. */
  jeton: string | null;
  nomModele: string;
  langueModele: string;
  texteFinModele: string;
  prixMessageDT: string | null;
  statut: StatutConnexion;
};

const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validerConnexionWhatsapp(
  corps: Record<string, unknown>,
  existe: boolean,
): { ok: true; saisie: SaisieConnexion } | { ok: false; erreur: string } {
  const numeroAffiche = texte(corps.numeroAffiche);
  const phoneNumberId = texte(corps.phoneNumberId);
  const wabaId = texte(corps.wabaId);
  const jeton = texte(corps.jeton);
  const nomModele = texte(corps.nomModele);
  const langueModele = texte(corps.langueModele) || "fr";
  const texteFinModele = texte(corps.texteFinModele);
  const prixBrut = texte(corps.prixMessageDT).replace(",", ".");
  const statut = texte(corps.statut) as StatutConnexion;

  if (!numeroAffiche) return { ok: false, erreur: "Numéro affiché manquant." };
  if (!/^\d{5,30}$/.test(phoneNumberId)) {
    return { ok: false, erreur: "Phone number ID invalide (chiffres seulement, voir WhatsApp Manager)." };
  }
  if (!/^\d{5,30}$/.test(wabaId)) return { ok: false, erreur: "WABA ID invalide (chiffres seulement)." };
  if (!existe && !jeton) return { ok: false, erreur: "Le jeton est obligatoire à la création." };
  if (jeton && (jeton.length < 20 || /\s/.test(jeton))) {
    return { ok: false, erreur: "Jeton invalide : collez le jeton permanent de l'utilisateur système." };
  }
  // Les noms de modeles Meta : minuscules, chiffres, soulignes.
  if (!/^[a-z0-9_]{1,512}$/.test(nomModele)) {
    return { ok: false, erreur: "Nom du modèle invalide (minuscules, chiffres et _ uniquement, comme dans WhatsApp Manager)." };
  }
  if (!/^[a-z]{2}(_[A-Z]{2})?$/.test(langueModele)) {
    return { ok: false, erreur: "Code de langue invalide (ex. « fr »)." };
  }
  if (!texteFinModele) {
    return { ok: false, erreur: "Texte de fin du modèle manquant : recopiez-le à l'identique du modèle approuvé." };
  }
  let prixMessageDT: string | null = null;
  if (prixBrut) {
    const n = Number(prixBrut);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return { ok: false, erreur: "Prix d'un message invalide (en DT, ex. 0,150)." };
    }
    prixMessageDT = (toMillimes(prixBrut) / 1000).toFixed(3);
  }
  if (!(STATUTS_CONNEXION as readonly string[]).includes(statut)) {
    return { ok: false, erreur: "Statut invalide." };
  }
  return {
    ok: true,
    saisie: {
      numeroAffiche,
      phoneNumberId,
      wabaId,
      jeton: jeton || null,
      nomModele,
      langueModele,
      texteFinModele,
      prixMessageDT,
      statut,
    },
  };
}
