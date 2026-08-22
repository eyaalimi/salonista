/**
 * Le paiement en ligne n'existe pas : cette page redirige vers le QR code.
 *
 * Elle presentait un formulaire de carte bancaire dont les champs n'etaient
 * transmis nulle part, puis appelait POST /api/payment qui marquait la
 * reservation « payee » sans encaisser un dinar. La cliente reserve son
 * creneau ici et regle son soin au salon.
 *
 * La page est conservee plutot que supprimee : trois ecrans pointent encore
 * vers /cliente/paiement?bookingId=… et des mails deja envoyes portent ce
 * lien. Une redirection les mene au bon endroit ; une 404 les perdrait.
 */

import { redirect } from "next/navigation";

export default async function PaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;
  redirect(bookingId ? `/cliente/reservation?bookingId=${bookingId}` : "/cliente");
}
