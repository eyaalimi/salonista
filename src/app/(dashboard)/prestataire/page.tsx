import { redirect } from "next/navigation";

/**
 * Le portail prestataire est desormais la PWA POS. Cette redirection est
 * conservee pour que les liens deja envoyes par email aux salons pilotes,
 * les favoris et l'indexation continuent de fonctionner.
 */
export default function ProviderDashboardRedirect() {
  redirect("/pos");
}
