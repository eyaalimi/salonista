import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getCurrentEmployee } from "@/lib/employee-session";
import { getPlan } from "@/lib/plan-serveur";
import { prisma } from "@/lib/prisma";
import { dateCourteFr, type Plan } from "@/lib/plan";
import {
  AVANTAGES_PREMIUM,
  CE_QUI_RESTE_GRATUIT,
  PRIX_PREMIUM_LIBELLE,
} from "@/components/pos/premium/contenu";

export const metadata = { title: "Premium — Salonista" };

/**
 * Coordonnees de paiement de Salonista. AUCUNE n'est ecrite dans le code :
 * elles viennent du `.env` du serveur. Une valeur absente fait simplement
 * disparaitre la ligne correspondante — mieux vaut une ligne en moins qu'un
 * faux RIB.
 */
function coordonnees() {
  return {
    whatsapp: (process.env.NEXT_PUBLIC_SALONISTA_WHATSAPP ?? "").replace(/\D/g, ""),
    rib: process.env.NEXT_PUBLIC_SALONISTA_RIB?.trim() ?? "",
    titulaire: process.env.NEXT_PUBLIC_SALONISTA_RIB_TITULAIRE?.trim() ?? "",
    d17: process.env.NEXT_PUBLIC_SALONISTA_D17?.trim() ?? "",
  };
}

function etatActuel(plan: Plan): string {
  switch (plan.etat) {
    case "AVANT_PREMIERE_VENTE":
      return "Tout est débloqué. Votre mois d'essai gratuit démarrera à votre première vente.";
    case "ESSAI":
      return `Essai Premium en cours : encore ${plan.joursRestants} jour${plan.joursRestants > 1 ? "s" : ""}, jusqu'au ${dateCourteFr(plan.finEssai)}.`;
    case "PREMIUM":
      return plan.jusquAu
        ? `Premium actif jusqu'au ${dateCourteFr(plan.jusquAu)}.`
        : "Premium actif.";
    case "GRATUIT":
      return "Vous êtes en version gratuite. La caisse fonctionne normalement ; la fidélité, l'équipe au-delà d'une employée et les commissions sont en pause.";
  }
}

export default async function PremiumPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/salon-pin");

  const [plan, salon] = await Promise.all([
    getPlan(employee.providerId),
    prisma.providerProfile.findUnique({
      where: { id: employee.providerId },
      select: { salonName: true },
    }),
  ]);
  const c = coordonnees();
  const nomSalon = salon?.salonName ?? "mon salon";
  const message = `Bonjour Salonista, je souhaite passer au Premium pour le salon « ${nomSalon} ».`;
  const lienWhatsapp = c.whatsapp
    ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="h-full overflow-y-auto bg-pos-bg p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <p className="text-[10px] uppercase tracking-[0.18em] text-pos-ink-3">Premium</p>
          <h1 className="mt-2 text-2xl font-semibold text-pos-ink md:text-3xl">
            Fidélisez vos clientes, faites travailler toute votre équipe
          </h1>
          <p className="mt-3 rounded-xl border border-pos-border bg-pos-surface p-4 text-sm text-pos-ink-2">
            {etatActuel(plan)}
          </p>
        </header>

        <section aria-labelledby="premium-apporte">
          <h2 id="premium-apporte" className="text-lg font-semibold text-pos-ink">
            Ce que le Premium apporte
          </h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {AVANTAGES_PREMIUM.map((a) => (
              <li key={a.titre} className="rounded-xl border border-pos-border bg-pos-surface p-4">
                <p className="font-semibold text-pos-ink">{a.titre}</p>
                <p className="mt-1 text-sm text-pos-ink-2">{a.texte}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="pos-mono text-2xl font-semibold text-pos-ink">{PRIX_PREMIUM_LIBELLE}</span>
            <span className="text-sm text-pos-ink-2">{CE_QUI_RESTE_GRATUIT}</span>
          </p>
        </section>

        <section aria-labelledby="premium-payer">
          <h2 id="premium-payer" className="text-lg font-semibold text-pos-ink">
            Comment payer
          </h2>
          <p className="mt-1 text-sm text-pos-ink-2">
            Le paiement se fait en dehors de l&apos;application. Dès réception, l&apos;équipe
            Salonista active votre Premium, sans que vous ayez rien à faire.
          </p>
          <dl className="mt-4 divide-y divide-pos-border rounded-xl border border-pos-border bg-pos-surface">
            <div className="p-4">
              <dt className="font-semibold text-pos-ink">Virement bancaire</dt>
              <dd className="mt-1 text-sm text-pos-ink-2">
                {c.rib ? (
                  <>
                    {c.titulaire && <span className="block">{c.titulaire}</span>}
                    <span className="pos-mono select-all text-pos-ink">{c.rib}</span>
                  </>
                ) : (
                  "Communiqué par l'équipe Salonista."
                )}
              </dd>
            </div>
            <div className="p-4">
              <dt className="font-semibold text-pos-ink">D17</dt>
              <dd className="mt-1 text-sm text-pos-ink-2">
                {c.d17 ? (
                  <span className="pos-mono select-all text-pos-ink">{c.d17}</span>
                ) : (
                  "Communiqué par l'équipe Salonista."
                )}
              </dd>
            </div>
            <div className="p-4">
              <dt className="font-semibold text-pos-ink">Espèces</dt>
              <dd className="mt-1 text-sm text-pos-ink-2">
                Lors d&apos;une visite de l&apos;équipe Salonista dans votre salon.
              </dd>
            </div>
          </dl>
        </section>

        {lienWhatsapp && (
          <section className="flex flex-col items-start gap-2">
            <a
              href={lienWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-pos-accent px-5 py-3 text-sm font-semibold text-white hover:bg-pos-accent/90"
            >
              <MessageCircle size={18} />
              Écrire à Salonista sur WhatsApp
            </a>
            <p className="text-xs text-pos-ink-3">
              Numéro : <span className="pos-mono select-all">+{c.whatsapp}</span>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
