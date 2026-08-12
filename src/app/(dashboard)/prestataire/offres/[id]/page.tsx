import { redirect } from "next/navigation";

/**
 * Le parametre ?edit= est ignore par /pos/services au lot A ; il ouvrira le
 * drawer d'edition au lot B.
 */
export default async function ProviderOfferEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pos/services?edit=${id}`);
}
