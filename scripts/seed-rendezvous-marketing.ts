/**
 * Injecte des rendez-vous (passes et a venir) dans le salon marketing, pour
 * que l'agenda ait deja de l'allure en capture — voir seed-salon-marketing.ts
 * et seed-ventes-marketing.ts pour le contexte complet.
 *
 * CHEMIN WALK-IN, DELIBEREMENT. Un vrai rendez-vous pris depuis la
 * marketplace reserve un `TimeSlot` precis (voir src/app/api/pos/bookings/
 * route.ts) ; recreer cette mecanique demanderait de generer des offres avec
 * des creneaux ouverts, pour un gain visuel nul — l'agenda affiche l'heure de
 * `createdAt` pour les walk-ins exactement comme `slot.startTime` pour les
 * autres (voir pos-calendar.tsx:147). Le walk-in est donc le chemin le plus
 * simple qui produise un resultat IDENTIQUE a l'ecran.
 *
 * `clientId` retombe sur le USER DU SALON lui-meme (son propre compte) :
 * c'est exactement ce que fait la vraie route POS quand la cliente n'a pas de
 * compte lie — voir le commentaire original dans bookings/route.ts, ligne
 * ~139. Aucune astuce ici, c'est le comportement reel du produit.
 *
 * NE COMPTE PAS DANS LE CHIFFRE D'AFFAIRES DEJA INJECTE : les stats de
 * revenu n'agregent que les Booking COMPLETED qui ont au moins un
 * BookingItem (donc un lien vers une Offer) — voir analytics/summary/
 * route.ts. Les walk-ins crees ici n'en ont pas, ils sont donc invisibles
 * du cote chiffre d'affaires et n'entrent jamais en double-compte avec les
 * 47 ventes de seed-ventes-marketing.ts.
 *
 * Idempotent : supprime les bookings existants du salon marketing avant de
 * recreer.
 *
 * Usage :
 *   npx tsx scripts/seed-rendezvous-marketing.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const EMAIL = "demo.marketing@salonista.tn";

/**
 * Noms affiches dans l'agenda (Booking n'a pas de nom propre : il porte un
 * `customerId` optionnel, et l'agenda lit `customer.firstName/lastName`
 * quand il existe). On reutilise les 3 clientes du salon marketing plus
 * quelques walk-ins SANS fiche (le cas d'une cliente de passage, courant en
 * salon), pour que l'agenda ne montre pas que des noms identiques.
 */
const PRENOMS_WALKIN = ["Amira", "Ines", "Rania"];

type CreneauPasse = { joursEnArriere: number; heure: number; minute: number };
type CreneauFutur = { joursEnAvant: number; heure: number; minute: number };

// Repartition deliberement irreguliere : un agenda parfaitement regulier
// (un rendez-vous toutes les heures pile) ne ressemble a rien de reel.
const PASSES: CreneauPasse[] = [
  { joursEnArriere: 1, heure: 9, minute: 15 },
  { joursEnArriere: 1, heure: 11, minute: 0 },
  { joursEnArriere: 1, heure: 15, minute: 30 },
  { joursEnArriere: 2, heure: 10, minute: 0 },
  { joursEnArriere: 2, heure: 14, minute: 0 },
  { joursEnArriere: 3, heure: 9, minute: 30 },
  { joursEnArriere: 3, heure: 16, minute: 0 },
];

const FUTURS: Array<CreneauFutur & { statut: "PENDING" | "CONFIRMED" }> = [
  // Aujourd'hui : melange confirme / en attente, pour montrer les deux
  // etats dans l'agenda.
  { joursEnAvant: 0, heure: 14, minute: 0, statut: "CONFIRMED" },
  { joursEnAvant: 0, heure: 16, minute: 30, statut: "PENDING" },
  { joursEnAvant: 1, heure: 9, minute: 0, statut: "CONFIRMED" },
  { joursEnAvant: 1, heure: 10, minute: 30, statut: "CONFIRMED" },
  { joursEnAvant: 1, heure: 15, minute: 0, statut: "PENDING" },
  { joursEnAvant: 2, heure: 11, minute: 0, statut: "CONFIRMED" },
  { joursEnAvant: 3, heure: 9, minute: 30, statut: "PENDING" },
  { joursEnAvant: 3, heure: 14, minute: 30, statut: "CONFIRMED" },
];

function dateA(heure: number, minute: number, decalageJours: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + decalageJours);
  d.setHours(heure, minute, 0, 0);
  return d;
}

function auHasard<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}

async function main() {
  console.log("📅 Génération des rendez-vous marketing...");

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true },
  });
  if (!user) {
    console.error("❌ Salon marketing introuvable. Lance d'abord :");
    console.error("   npx tsx scripts/seed-salon-marketing.ts");
    process.exit(1);
  }

  const provider = await prisma.providerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!provider) {
    console.error("❌ ProviderProfile introuvable pour ce salon.");
    process.exit(1);
  }
  const providerId = provider.id;

  const employees = await prisma.salonEmployee.findMany({
    where: { providerId },
    select: { id: true },
  });
  if (employees.length === 0) {
    console.error("❌ Aucun employé trouvé pour ce salon.");
    process.exit(1);
  }

  const offers = await prisma.offer.findMany({
    where: { providerId, active: true },
    select: { id: true, title: true, discountPrice: true },
  });
  if (offers.length === 0) {
    console.error("❌ Aucun service actif. Relance seed-salon-marketing.ts.");
    process.exit(1);
  }

  const customers = await prisma.customer.findMany({
    where: { firstSalonId: providerId },
    select: { id: true, firstName: true, lastName: true },
  });

  // Nettoyage : uniquement les bookings DEJA RATTACHES a ce salon (via leurs
  // items ou leur employe assigne), jamais ceux des autres salons.
  const anciens = await prisma.booking.findMany({
    where: {
      OR: [
        { items: { some: { offer: { providerId } } } },
        { assignedEmployee: { providerId } },
      ],
    },
    select: { id: true },
  });
  if (anciens.length > 0) {
    console.log(`   ${anciens.length} rendez-vous existant(s) supprimé(s)...`);
    await prisma.booking.deleteMany({
      where: { id: { in: anciens.map((b) => b.id) } },
    });
  }

  let nbPasses = 0;
  let nbFuturs = 0;

  // --- Rendez-vous PASSES, termines ---
  for (const c of PASSES) {
    const offer = auHasard(offers);
    const client = Math.random() > 0.2 ? auHasard(customers) : null;
    const quand = dateA(c.heure, c.minute, -c.joursEnArriere);

    await prisma.booking.create({
      data: {
        clientId: user.id,
        customerId: client?.id ?? null,
        walkIn: true,
        createdViaPos: true,
        assignedEmployeeId: auHasard(employees).id,
        status: "COMPLETED",
        totalPrice: offer.discountPrice,
        createdAt: quand,
        // `qrVerifiedAt` : non renseigne volontairement. Le remplir ferait
        // apparaitre ce rendez-vous dans le chiffre d'affaires des stats
        // (voir le commentaire d'en-tete) — ce script ne touche QUE
        // l'agenda, les 47 ventes de seed-ventes-marketing.ts restent la
        // seule source du chiffre d'affaires affiche.
      },
    });
    nbPasses++;
  }

  // --- Rendez-vous A VENIR ---
  for (const c of FUTURS) {
    const offer = auHasard(offers);
    const client = Math.random() > 0.3 ? auHasard(customers) : null;
    const quand = dateA(c.heure, c.minute, c.joursEnAvant);

    await prisma.booking.create({
      data: {
        clientId: user.id,
        customerId: client?.id ?? null,
        walkIn: true,
        createdViaPos: true,
        assignedEmployeeId: auHasard(employees).id,
        status: c.statut,
        totalPrice: offer.discountPrice,
        createdAt: quand,
        notes: client ? null : `Cliente : ${auHasard(PRENOMS_WALKIN)}`,
      },
    });
    nbFuturs++;
  }

  console.log(`✅ ${nbPasses} rendez-vous passés (terminés), ${nbFuturs} à venir.`);
  console.log("");
  console.log("L'agenda (/pos/calendar) a maintenant de l'allure, aujourd'hui");
  console.log("et sur les prochains jours.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
