/**
 * Statuts d'une vente « realisee » : la prestation ou le produit est parti.
 *
 * UNE SEULE LISTE. Elle etait recopiee dans dix-sept requetes ; en ajouter
 * une valeur (CREDIT) dans seize d'entre elles aurait suffi a faire
 * disparaitre une vente a credit du chiffre d'affaires d'un seul ecran.
 *
 * CREDIT y figure : une vente a credit est VENDUE, seul l'argent manque. Le
 * chiffre d'affaires la compte entiere ; l'argent ENCAISSE, lui, se lit sur
 * les `Payment` (leur date, leur tiroir), jamais sur ce statut.
 *
 * Trois requetes ne comptaient que `PAID` (marge produit, rapport Z) et ne
 * passent PAS par cette liste : elles gardent leur comportement, CREDIT en
 * plus — voir `STATUTS_VENTE_PAYEE_OU_CREDIT`.
 */

import type { SaleStatus } from "@/generated/prisma/enums";

export const STATUTS_VENTE_REALISEE = [
  "PAID",
  "CREDIT",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const satisfies readonly SaleStatus[];

/** Pour les requetes qui ignoraient deja les ventes remboursees. */
export const STATUTS_VENTE_PAYEE_OU_CREDIT = ["PAID", "CREDIT"] as const satisfies readonly SaleStatus[];
