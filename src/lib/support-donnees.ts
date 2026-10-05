/**
 * Lecture des donnees de support — l'adaptateur Prisma.
 *
 * Les decisions vivent dans `support-salon.ts` (pur, teste).
 */

import { prisma } from "./prisma";
import { normaliserTerme, termeRecherchable } from "./support-salon";
import { statutSalon, type StatutSalon } from "./campagne-tableau";

/** Un resultat de recherche, assez pour reconnaitre le salon au telephone. */
export type ResultatRecherche = {
  id: string;
  salonName: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  matriculeFiscal: string | null;
  suspendu: boolean;
  createdAt: Date;
};

/**
 * Cherche un salon par nom, telephone, e-mail ou matricule fiscal.
 *
 * Les quatre champs d'un coup : au telephone, la personne donne ce qu'elle a
 * sous la main. Lui demander « c'est un nom ou un matricule ? » ferait perdre
 * du temps a tout le monde.
 */
export async function chercherSalons(terme: string): Promise<ResultatRecherche[]> {
  if (!termeRecherchable(terme)) return [];
  const q = normaliserTerme(terme);
  // Pour le telephone, on compare les CHIFFRES seuls : la personne dit
  // « 20 123 456 » et la base contient « +21620123456 ».
  const chiffres = q.replace(/\D/g, "");

  const salons = await prisma.providerProfile.findMany({
    where: {
      OR: [
        { salonName: { contains: q, mode: "insensitive" } },
        { matriculeFiscal: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        ...(chiffres.length >= 4
          ? [
              { phone: { contains: chiffres } },
              { user: { phone: { contains: chiffres } } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      salonName: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
      suspendedAt: true,
      createdAt: true,
      user: { select: { email: true } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return salons.map((s) => ({
    id: s.id,
    salonName: s.salonName,
    city: s.city,
    phone: s.phone,
    email: s.user?.email ?? null,
    matriculeFiscal: s.matriculeFiscal,
    suspendu: s.suspendedAt !== null,
    createdAt: s.createdAt,
  }));
}

/** La fiche complete d'un salon, pour le support. */
export type FicheSalon = {
  id: string;
  salonName: string;
  city: string | null;
  governorate: string | null;
  phone: string | null;
  matriculeFiscal: string | null;
  createdAt: Date;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  gerant: {
    id: string;
    nom: string | null;
    email: string;
    emailVerifie: boolean;
    mustChangePassword: boolean;
    derniereConnexion: Date | null;
  } | null;
  campagne: string | null;
  utmSource: string | null;
  employes: Array<{
    id: string;
    displayName: string;
    role: string;
    actif: boolean;
    aUnPin: boolean;
    verrouilleJusqua: Date | null;
    derniereConnexion: Date | null;
  }>;
  nbVentes: number;
  derniereVenteAt: Date | null;
  statut: StatutSalon;
  notes: Array<{ id: string; contenu: string; authorEmail: string; createdAt: Date }>;
};

export async function ficheSalon(id: string): Promise<FicheSalon | null> {
  const s = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      salonName: true,
      city: true,
      governorate: true,
      phone: true,
      matriculeFiscal: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      utmSource: true,
      campaign: { select: { name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          mustChangePassword: true,
        },
      },
      employees: {
        select: {
          id: true,
          displayName: true,
          role: true,
          active: true,
          pinHash: true,
          pinLockedUntil: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      supportNotes: {
        select: { id: true, contenu: true, authorEmail: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!s) return null;

  const [nbVentes, derniere] = await Promise.all([
    prisma.sale.count({
      where: { providerId: id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
    }),
    prisma.sale.findFirst({
      where: { providerId: id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const derniereConnexionEquipe = s.employees
    .map((e) => e.lastLoginAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    id: s.id,
    salonName: s.salonName,
    city: s.city,
    governorate: s.governorate,
    phone: s.phone,
    matriculeFiscal: s.matriculeFiscal,
    createdAt: s.createdAt,
    suspendedAt: s.suspendedAt,
    suspendedReason: s.suspendedReason,
    gerant: s.user
      ? {
          id: s.user.id,
          nom: s.user.name,
          email: s.user.email,
          emailVerifie: s.user.emailVerified !== null,
          mustChangePassword: s.user.mustChangePassword,
          derniereConnexion: derniereConnexionEquipe,
        }
      : null,
    campagne: s.campaign?.name ?? null,
    utmSource: s.utmSource,
    employes: s.employees.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      role: e.role,
      actif: e.active,
      // On expose l'EXISTENCE d'un PIN, jamais sa valeur ni son hachage.
      aUnPin: e.pinHash !== null,
      verrouilleJusqua: e.pinLockedUntil,
      derniereConnexion: e.lastLoginAt,
    })),
    nbVentes,
    derniereVenteAt: derniere?.createdAt ?? null,
    statut: statutSalon({
      derniereVenteAt: derniere?.createdAt ?? null,
      derniereConnexionAt: derniereConnexionEquipe,
    }),
    notes: s.supportNotes,
  };
}
