/**
 * A quel moment a lieu un rendez-vous ? — decision pure, sans Prisma.
 *
 * LE DEFAUT QUI A FAIT NAITRE CE MODULE. Le calendrier de la caisse retenait
 * un rendez-vous pour une journee selon DEUX criteres :
 *
 *   1. l'un de ses creneaux tombe dans la journee — juste ;
 *   2. OU il a ete CREE ce jour-la — faux.
 *
 * Un rendez-vous pris aujourd'hui pour jeudi prochain remplissait donc les
 * deux criteres a deux dates differentes, et s'affichait les deux jours. Le
 * critere 2 n'avait de sens que pour les passages libres, qui n'ont aucun
 * creneau — et meme pour eux il etait faux : l'heure choisie dans le
 * formulaire n'etait jamais enregistree, si bien qu'un passage prevu jeudi
 * apparaissait AUJOURD'HUI et jamais jeudi.
 *
 * La regle, desormais, en un seul endroit :
 *
 *   - avec des services : l'heure du PREMIER creneau, et rien d'autre ;
 *   - passage libre : l'heure PREVUE (`debutPrevu`), enregistree a la creation ;
 *   - passage libre anterieur a ce correctif (pas d'heure prevue) : la date de
 *     creation, faute de mieux — c'etait leur seule information.
 *
 * La date de creation ne sert donc plus JAMAIS a placer un rendez-vous qui a
 * une heure connue.
 */

/** Duree affichee d'un passage libre dont on ne connait pas la fin. */
export const DUREE_PAR_DEFAUT_MINUTES = 30;

type DateLike = Date | string;

export type RendezVousDate = {
  items: ReadonlyArray<{
    slot: { startTime: DateLike; endTime?: DateLike | null } | null;
  }>;
  debutPrevu?: DateLike | null;
  finPrevue?: DateLike | null;
  createdAt: DateLike;
};

const enDate = (d: DateLike): Date => (d instanceof Date ? d : new Date(d));

/**
 * Le PREMIER creneau dans le temps, pas le premier de la liste : l'ordre des
 * lignes en base n'est pas garanti, et un rendez-vous de deux services
 * commencerait sinon a l'heure du second.
 */
function premierCreneau(r: RendezVousDate) {
  const creneaux = r.items
    .map((i) => i.slot)
    .filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined);
  if (creneaux.length === 0) return null;
  return creneaux.reduce((a, b) =>
    enDate(a.startTime).getTime() <= enDate(b.startTime).getTime() ? a : b,
  );
}

function dernierCreneau(r: RendezVousDate) {
  const creneaux = r.items
    .map((i) => i.slot)
    .filter((s): s is NonNullable<typeof s> => s !== null && s !== undefined);
  if (creneaux.length === 0) return null;
  return creneaux.reduce((a, b) =>
    enDate(a.startTime).getTime() >= enDate(b.startTime).getTime() ? a : b,
  );
}

/** Quand le rendez-vous commence. */
export function debutRendezVous(r: RendezVousDate): Date {
  const premier = premierCreneau(r);
  if (premier) return enDate(premier.startTime);
  if (r.debutPrevu) return enDate(r.debutPrevu);
  return enDate(r.createdAt);
}

/** Quand il se termine. */
export function finRendezVous(r: RendezVousDate): Date {
  const dernier = dernierCreneau(r);
  if (dernier?.endTime) return enDate(dernier.endTime);
  if (!dernier && r.finPrevue) return enDate(r.finPrevue);
  const debut = debutRendezVous(r);
  return new Date(debut.getTime() + DUREE_PAR_DEFAUT_MINUTES * 60_000);
}

/**
 * Le filtre Prisma des rendez-vous d'un salon sur une fenetre [from, to[.
 *
 * Construit ICI pour etre teste : c'est lui qui contenait le critere fautif.
 * Trois branches, mutuellement exclusives — un rendez-vous ne peut en
 * satisfaire qu'une, donc il n'apparait que sur le jour ou il a lieu :
 *
 *   1. un creneau d'un service du salon tombe dans la fenetre ;
 *   2. AUCUN service, et l'heure PREVUE tombe dans la fenetre ;
 *   3. AUCUN service, pas d'heure prevue (ancien passage libre), et la date
 *      de creation tombe dans la fenetre.
 *
 * `to` est EXCLUSIF (`lt`) : les appelants envoient minuit du lendemain. En
 * `lte`, un rendez-vous a 00:00 pile apparaissait lui aussi sur deux jours.
 */
export function filtreFenetreRendezVous(providerId: string, from: Date, to: Date) {
  const fenetre = { gte: from, lt: to };
  return {
    OR: [
      {
        items: {
          some: {
            offer: { providerId },
            slot: { startTime: fenetre },
          },
        },
      },
      {
        assignedEmployee: { providerId },
        items: { none: {} },
        debutPrevu: fenetre,
      },
      {
        assignedEmployee: { providerId },
        items: { none: {} },
        debutPrevu: null,
        createdAt: fenetre,
      },
    ],
  };
}
