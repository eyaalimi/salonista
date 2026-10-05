import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MARKETPLACE_PUBLIQUE } from "@/lib/flags";
import RegisterClient from "./register-client";

const dashboardByRole: Record<string, string> = {
  PROVIDER: "/prestataire",
  INFLUENCER: "/influenceuse",
  CLIENT: "/cliente",
  ADMIN: "/admin",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  /*
   * PLACE DE MARCHE FERMEE : ce formulaire creait des comptes CLIENT et
   * INFLUENCER qui ne menaient nulle part — aucun parcours public ne leur
   * reste ouvert. Une cliente inscrite ici atterrissait sur un espace vide.
   *
   * Le redirect est place AVANT `getServerSession`, comme sur /offres et
   * /pro : il ne touche ainsi ni la base ni la session, et la page se
   * prerendre sans base accessible.
   *
   * Aucun parcours vivant n'en depend : /pro est ferme lui aussi, /login
   * pointe vers /pos-start, et un salon s'inscrit par /pos-start. Rouvrir la
   * place de marche rallume cette page avec le reste (voir la note 20).
   */
  if (!MARKETPLACE_PUBLIQUE) redirect("/pos-start");

  const session = await getServerSession(authOptions);

  if (session?.user) {
    const params = await searchParams;
    const callback = params.callbackUrl;
    if (callback && callback.startsWith("/") && !callback.startsWith("//")) {
      redirect(callback);
    }
    const dest = dashboardByRole[session.user.role] || "/";
    redirect(dest);
  }

  return <RegisterClient />;
}
