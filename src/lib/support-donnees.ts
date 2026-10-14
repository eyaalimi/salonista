/**
 * Lecture des donnees de support — l'adaptateur Prisma.
 *
 * Les decisions vivent dans `support-salon.ts` (pur, teste).
 */

import { prisma } from "./prisma";
import { normaliserTerme, termeRecherchable } from "./support-salon";
import { statutSalon, type StatutSalon } from "./campagne-tableau";
import { lienTelephone } from "./profil-salon-complet";

/** Un resultat de recherche : les coordonnees COMPLETES, pour pouvoir rappeler. */
export type ResultatRecherche = {
  id: string;
  salonName: string;
  city: string | null;
  phone: string | null;
  /**
   * Le numero sous forme composable (`+216…`), ou `null` s'il n'y a rien a
   * composer. Calcule ICI et non dans le gabarit : la page est un server
   * component, et la regle de formatage doit vivre au meme endroit que celle
   * de la fiche.
   */
  lienTel: string | null;
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
    lienTel: lienTelephone(s.phone),
    email: s.user?.email ?? null,
    matriculeFiscal: s.matriculeFiscal,
    suspendu: s.suspendedAt !== null,
    createdAt: s.createdAt,
  }));
}

/** Combien de salons par page dans la liste complete. */
export const SALONS_PAR_PAGE = 50;

export type ListeSalons = {
  salons: ResultatRecherche[];
  /** Total en base, toutes pages confondues. */
  total: number;
  /** Nombre de suspendus dans ce total — affiche a part. */
  suspendus: number;
  page: number;
  pages: number;
};

/**
 * TOUS les salons, le plus recent d'abord.
 *
 * POURQUOI CETTE FONCTION EXISTE. La page Support n'affichait rien tant
 * qu'on n'avait pas tape une recherche : impossible de voir ses salons sans
 * savoir d'avance lequel chercher, ni meme de connaitre leur nombre. Au
 * lancement, c'est pourtant la premiere chose qu'on veut regarder.
 *
 * LES SUSPENDUS SONT INCLUS. C'est la difference avec la file d'appels, qui
 * les ecarte : la file sert a rappeler, et le silence d'un suspendu est notre
 * decision. Ici on INVENTORIE — un salon qu'on a suspendu reste un salon, et
 * le cacher donnerait un compte faux.
 *
 * Paginee : `chercherSalons` se contente de 20 resultats parce qu'on affine
 * un terme, mais une liste complete doit pouvoir etre parcourue en entier.
 */
export async function listerSalons(page = 1): Promise<ListeSalons> {
  const pageSure = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  const [total, suspendus, salons] = await Promise.all([
    prisma.providerProfile.count(),
    prisma.providerProfile.count({ where: { suspendedAt: { not: null } } }),
    prisma.providerProfile.findMany({
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
      orderBy: { createdAt: "desc" },
      skip: (pageSure - 1) * SALONS_PAR_PAGE,
      take: SALONS_PAR_PAGE,
    }),
  ]);

  return {
    salons: salons.map((s) => ({
      id: s.id,
      salonName: s.salonName,
      city: s.city,
      phone: s.phone,
      lienTel: lienTelephone(s.phone),
      email: s.user?.email ?? null,
      matriculeFiscal: s.matriculeFiscal,
      suspendu: s.suspendedAt !== null,
      createdAt: s.createdAt,
    })),
    total,
    suspendus,
    page: pageSure,
    pages: Math.max(1, Math.ceil(total / SALONS_PAR_PAGE)),
  };
}

/** La fiche complete d'un salon, pour le support. */
export type FicheSalon = {
  id: string;
  salonName: string;
  city: string | null;
  governorate: string | null;
  /** Rue et numero. Existait en base mais n'etait affiche NULLE PART. */
  address: string | null;
  phone: string | null;
  matriculeFiscal: string | null;
  /** Assujetti a la TVA : change la facturation, doit se voir. */
  vatRegistered: boolean;
  category: string;
  description: string | null;
  /** Salon de demonstration (captures marketing), pas un vrai client. */
  demo: boolean;
  verified: boolean;
  createdAt: Date;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  gerant: {
    id: string;
    nom: string | null;
    email: string;
    /** Le telephone du COMPTE, distinct de celui du salon. */
    phone: string | null;
    emailVerifie: boolean;
    mustChangePassword: boolean;
    derniereConnexion: Date | null;
  } | null;
  campagne: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Premier contact connu, quand l'attribution a fonctionne. */
  firstSeenAt: Date | null;
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
  notes: Array<{
    id: string;
    contenu: string;
    authorEmail: string;
    createdAt: Date;
    /** Resultat de l'appel, NUL pour les notes ecrites avant le cockpit. */
    resultat: string | null;
    rappelLe: Date | null;
    blocageLeve: boolean;
  }>;
};

export async function ficheSalon(id: string): Promise<FicheSalon | null> {
  const s = await prisma.providerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      salonName: true,
      city: true,
      governorate: true,
      address: true,
      phone: true,
      matriculeFiscal: true,
      vatRegistered: true,
      category: true,
      description: true,
      demo: true,
      verified: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      firstSeenAt: true,
      campaign: { select: { name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
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
        select: {
          id: true,
          contenu: true,
          authorEmail: true,
          createdAt: true,
          // Le compte rendu d'appel. `resultat` est NUL sur les notes
          // anterieures au cockpit : l'affichage doit le tolerer.
          resultat: true,
          rappelLe: true,
          blocageLeve: true,
        },
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
    address: s.address,
    phone: s.phone,
    matriculeFiscal: s.matriculeFiscal,
    vatRegistered: s.vatRegistered,
    category: s.category,
    description: s.description,
    demo: s.demo,
    verified: s.verified,
    createdAt: s.createdAt,
    suspendedAt: s.suspendedAt,
    suspendedReason: s.suspendedReason,
    gerant: s.user
      ? {
          id: s.user.id,
          nom: s.user.name,
          email: s.user.email,
          phone: s.user.phone,
          emailVerifie: s.user.emailVerified !== null,
          mustChangePassword: s.user.mustChangePassword,
          derniereConnexion: derniereConnexionEquipe,
        }
      : null,
    campagne: s.campaign?.name ?? null,
    utmSource: s.utmSource,
    utmMedium: s.utmMedium,
    utmCampaign: s.utmCampaign,
    firstSeenAt: s.firstSeenAt,
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
