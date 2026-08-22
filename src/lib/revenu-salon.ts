/**
 * Le chiffre d'affaires d'un salon, avec ou sans le module caisse.
 *
 * Les statistiques ne comptaient que des `Sale`. Or creer une vente exige le
 * module POS : `POST /api/pos/sales` repond 403 sans lui. Un salon non abonne
 * voyait donc « 0 TND » en permanence, alors qu'il travaillait — il validait
 * les QR de ses clientes, encaissait au comptoir, et rien n'etait compte.
 *
 * On additionne desormais deux sources :
 *   - les VENTES, quand le salon a la caisse : montant reellement encaisse,
 *     remises et produits compris ;
 *   - les RENDEZ-VOUS TERMINES sans vente rattachee, sinon : le salon a
 *     valide le QR de la cliente, la prestation a bien eu lieu.
 *
 * La regle « sans vente rattachee » evite le double comptage : quand la
 * caisse encaisse un rendez-vous, elle pose `Sale.bookingId` et passe le
 * rendez-vous a COMPLETED. Le compter des deux cotes doublerait la recette.
 */

import { addMoney, subMoney } from "@/lib/money";

/** Une vente encaissee par la caisse. */
export type VenteComptee = { total: string };

/**
 * Un rendez-vous termine. `aUneVente` dit si une vente lui est deja
 * rattachee — auquel cas il ne compte pas, la vente fait foi.
 */
export type RdvCompte = { totalPrice: string; aUneVente: boolean };

export type RevenuSalon = {
  /** Recette nette, remboursements deduits. */
  netRevenue: string;
  /** Nombre de prestations comptees : ventes + rendez-vous sans vente. */
  paidCount: number;
  /** Total rembourse sur la periode. */
  refundTotal: string;
  /**
   * `true` si une partie de la recette vient de rendez-vous et non de ventes.
   * L'interface s'en sert pour expliquer d'ou vient le chiffre a un salon
   * sans caisse, plutot que de le laisser deviner.
   */
  depuisRendezVous: boolean;
};

/**
 * Consolide ventes et rendez-vous en une seule recette.
 *
 * Tout est en millimes via les aides de `money.ts` : additionner des
 * `Decimal(10,3)` en `number` perdrait des millimes sur les grands volumes.
 */
export function consoliderRevenu(
  ventes: VenteComptee[],
  rdvTermines: RdvCompte[],
  remboursements: { totalAmount: string }[],
): RevenuSalon {
  const brutVentes = ventes.reduce((s, v) => addMoney(s, v.total), "0.000");

  // Seuls les rendez-vous sans vente : sinon on compterait deux fois la meme
  // prestation, une fois par la caisse et une fois par l'agenda.
  const rdvSeuls = rdvTermines.filter((r) => !r.aUneVente);
  const brutRdv = rdvSeuls.reduce((s, r) => addMoney(s, r.totalPrice), "0.000");

  const brut = addMoney(brutVentes, brutRdv);
  const rembourse = remboursements.reduce(
    (s, r) => addMoney(s, r.totalAmount),
    "0.000",
  );

  return {
    netRevenue: subMoney(brut, rembourse),
    paidCount: ventes.length + rdvSeuls.length,
    refundTotal: rembourse,
    depuisRendezVous: rdvSeuls.length > 0,
  };
}

/**
 * Ticket moyen : recette nette divisee par le nombre de prestations.
 *
 * `null` quand il n'y a rien a diviser — l'interface affiche alors « — »
 * plutot qu'un zero qui se lirait comme un mauvais resultat.
 */
export function ticketMoyen(revenu: RevenuSalon): string | null {
  if (revenu.paidCount === 0) return null;
  return (Number(revenu.netRevenue) / revenu.paidCount).toFixed(3);
}
