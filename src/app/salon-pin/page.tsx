import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SalonPinClient from "./salon-pin-client";

export const metadata = {
  title: "Choisir un membre — Salonista",
};

/**
 * Choix de l'employe qui tient le comptoir.
 *
 * Ce n'est PAS un ecran de connexion : il suppose le salon deja connecte et
 * sert a basculer d'un membre de l'equipe a un autre. Une visiteuse sans
 * session est donc renvoyee vers `/login`.
 *
 * Sans cette garde, une proprietaire qui se deconnectait atterrissait ici et
 * on lui reclamait un code PIN, alors qu'elle voulait simplement se
 * reconnecter avec son email. Les 22 pages de la caisse redirigent vers cet
 * ecran quand la session manque : la garde posee ici les couvre toutes.
 */
export default async function SalonPinPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/pos");

  return (
    <Suspense fallback={null}>
      <SalonPinClient />
    </Suspense>
  );
}
