import { Suspense } from "react";
import { getCurrentEmployee } from "@/lib/employee-session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServicesListClient } from "@/components/pos/services-list-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services — Salonista" };

export default async function ServicesPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");
  if (!employee.permissions["products.manage"]) redirect("/pos");

  const offers = await prisma.offer.findMany({
    where: { providerId: employee.providerId },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      discountPrice: true,
      durationMinutes: true,
      taxRate: true,
      active: true,
      publishedToMarketplace: true,
      photos: true,
    } as never,
  });
  // ServicesListClient lit ?edit= via useSearchParams : Next 16 exige une
  // frontiere Suspense, sinon le prerendu echoue au build.
  return (
    <Suspense
      fallback={
        <div className="h-full bg-pos-bg p-6 text-sm text-pos-ink-3" data-pos-theme>
          Chargement des services…
        </div>
      }
    >
      <ServicesListClient initialOffers={offers as never} />
    </Suspense>
  );
}
