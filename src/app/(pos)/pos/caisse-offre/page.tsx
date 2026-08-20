import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { hasModule } from "@/lib/modules";
import { CaisseOffreClient } from "./caisse-offre-client";

export const metadata = { title: "La caisse Salonista — Salonista" };

const APPORTS = [
  {
    titre: "Encaissez vos clientes",
    texte:
      "Espèces ou carte, le ticket s'imprime et la vente est enregistrée. Plus de cahier à recopier le soir.",
  },
  {
    titre: "Suivez votre stock",
    texte:
      "Chaque produit vendu se déduit tout seul. Vous savez ce qu'il vous reste et ce qu'il faut commander.",
  },
  {
    titre: "Fidélisez avec des points",
    texte:
      "Vos clientes cumulent des points à chaque passage et les échangent contre une remise.",
  },
  {
    titre: "Voyez vos chiffres",
    texte:
      "Ce que vous avez encaissé aujourd'hui, ce mois-ci, et quelles prestations rapportent le plus.",
  },
];

export default async function CaisseOffrePage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  // Inutile de vendre ce que le salon possede deja.
  if (await hasModule(employee.providerId, "POS")) redirect("/pos");

  return (
    <div className="h-full overflow-y-auto bg-creme md:p-8 p-4">
      <div className="mx-auto max-w-2xl pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-prune-soft">
          Module caisse
        </p>
        <h1 className="ds-display mt-2 text-3xl text-prune md:text-4xl">
          La caisse Salonista
        </h1>
        <p className="mt-3 text-base text-prune-soft">
          Votre salon est déjà sur Salonista et reçoit des réservations. La
          caisse est un module en plus, qui prend en charge ce qui se passe au
          comptoir.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {APPORTS.map((apport) => (
            <li
              key={apport.titre}
              className="rounded-[var(--radius-card)] border-2 border-hairline bg-white p-5"
            >
              <p className="text-base font-semibold text-prune">{apport.titre}</p>
              <p className="mt-1 text-sm text-prune-soft">{apport.texte}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <p className="text-base text-prune-soft">
            Dites-nous que cela vous intéresse : nous vous rappelons pour vous
            la présenter, sans engagement.
          </p>
          <div className="mt-4">
            <CaisseOffreClient />
          </div>
        </div>
      </div>
    </div>
  );
}
