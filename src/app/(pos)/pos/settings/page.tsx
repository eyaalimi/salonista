import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { SettingsTabs } from "@/components/pos/settings/settings-tabs";
import { isValidOpeningHours, type OpeningHours } from "@/lib/opening-hours";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil du salon — Salonista" };

/**
 * Profil du salon, editable depuis la caisse.
 *
 * Deux onglets separes : les champs de profil ne touchent jamais aux
 * creneaux, seuls les horaires declenchent regenerateAllProviderSlots.
 */
export default async function SettingsPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["settings.manage"]) redirect("/pos/calendar");

  const provider = (await prisma.providerProfile.findUnique({
    where: { id: employee.providerId },
    select: {
      salonName: true,
      category: true,
      description: true,
      address: true,
      city: true,
      phone: true,
      lat: true,
      lng: true,
      photos: true,
      matriculeFiscal: true,
      receiptFooter: true,
      openingHours: true,
    } as never,
  })) as {
    salonName: string;
    category: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    lat: number | null;
    lng: number | null;
    photos: string[];
    matriculeFiscal: string | null;
    receiptFooter: string | null;
    openingHours: unknown;
  } | null;

  if (!provider) redirect("/pos/calendar");

  const hours = isValidOpeningHours(provider.openingHours)
    ? (provider.openingHours as OpeningHours)
    : null;

  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-4 md:p-6" data-pos-theme>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold text-pos-ink md:text-xl">Profil du salon</h1>
        <p className="mt-1 text-sm text-pos-ink-3">
          Ces informations apparaissent sur vos tickets et sur votre page publique.
        </p>

        <SettingsTabs
          profile={{
            salonName: provider.salonName,
            category: provider.category,
            description: provider.description,
            address: provider.address,
            city: provider.city,
            phone: provider.phone,
            lat: provider.lat,
            lng: provider.lng,
            photos: provider.photos ?? [],
            matriculeFiscal: provider.matriculeFiscal,
            receiptFooter: provider.receiptFooter,
          }}
          openingHours={hours}
        />
      </div>
    </div>
  );
}
