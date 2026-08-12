import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil du salon — Salonista" };

/**
 * Profil du salon en lecture seule.
 *
 * Cible de la redirection /prestataire/profil des le lot A pour ne livrer
 * aucune 404. L'edition (formulaire complet + horaires d'ouverture) arrive
 * au lot C.
 */
export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["settings.manage"]) redirect("/pos");

  const provider = await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      salonName: true,
      category: true,
      description: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
    } as never,
  }) as {
    salonName: string;
    category: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
  } | null;

  if (!provider) redirect("/pos");

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Nom du salon", value: provider.salonName },
    { label: "Catégorie", value: provider.category },
    { label: "Description", value: provider.description },
    { label: "Adresse", value: provider.address },
    { label: "Ville", value: provider.city },
    { label: "Téléphone", value: provider.phone },
    { label: "Matricule fiscal", value: provider.matriculeFiscal },
  ];

  return (
    <div className="h-full overflow-y-auto bg-pos-bg md:p-6 p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-pos-ink md:text-xl">Profil du salon</h1>
        <p className="mt-1 text-sm text-pos-ink-3">
          Ces informations apparaissent sur vos tickets et sur votre page publique.
        </p>

        <dl className="mt-6 divide-y divide-pos-border overflow-hidden rounded-lg border border-pos-border bg-pos-surface">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-xs uppercase tracking-[0.14em] text-pos-ink-3">{r.label}</dt>
              <dd className="text-right text-sm text-pos-ink">
                {r.value?.trim() ? r.value : <span className="text-pos-ink-4">Non renseigné</span>}
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-xl border border-pos-border bg-pos-surface py-3 text-sm font-medium text-pos-ink-3"
        >
          Modifier — bientôt
        </button>
      </div>
    </div>
  );
}
