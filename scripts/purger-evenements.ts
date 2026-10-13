/**
 * Purge les evenements de salon trop anciens pour servir a un appel.
 *
 * Usage :
 *   npx tsx scripts/purger-evenements.ts            # inspecte, n'efface rien
 *   npx tsx scripts/purger-evenements.ts --apply    # efface pour de bon
 *
 * INSPECTE PAR DEFAUT, comme les autres scripts de ce dossier. Une suppression
 * est irreversible : la lancer d'un coup de touche parce qu'on a oublie un
 * drapeau serait une mauvaise facon de perdre des donnees.
 *
 * CE QUI EST EFFACE, ET POURQUOI C'EST SANS CONSEQUENCE. `EvenementSalon` est
 * une table d'OBSERVATION : elle sert au cockpit d'appels, qui ne regarde
 * jamais au-dela de 90 jours. Rien d'autre ne la lit — ni la caisse, ni la
 * facturation, ni les statistiques du salon. Aucune vente, aucune
 * reservation, aucune fiche cliente n'en depend.
 *
 * A NE PAS CONFONDRE avec `SuperadminAuditLog`, qui ne se purge PAS : c'est
 * le journal des interventions humaines, et il doit survivre meme a la
 * fermeture du salon concerne (cle etrangere `SetNull`, pas `Cascade`).
 *
 * Suppression par LOTS : un `deleteMany` sur des centaines de milliers de
 * lignes tiendrait un verrou long sur la table pendant que la production
 * ecrit dedans. Mille lignes a la fois rendent la main entre chaque passe.
 */

import { prisma } from "../src/lib/prisma";
import { RETENTION_JOURS, limitePurge } from "../src/lib/evenement-salon";

const apply = process.argv.includes("--apply");
const TAILLE_LOT = 1000;

async function main() {
  const limite = limitePurge();

  const total = await prisma.evenementSalon.count();
  const aEffacer = await prisma.evenementSalon.count({
    where: { createdAt: { lt: limite } },
  });

  console.log(`Évènements en base      : ${total}`);
  console.log(`Rétention               : ${RETENTION_JOURS} jours`);
  console.log(`Plus anciens que        : ${limite.toISOString().slice(0, 10)}`);
  console.log(`À effacer               : ${aEffacer}`);
  console.log(`Restants après purge    : ${total - aEffacer}`);

  if (aEffacer === 0) {
    console.log("\nRien à purger.");
    return;
  }

  if (!apply) {
    console.log("\nAucune suppression — relance avec --apply pour effacer.");
    return;
  }

  let efface = 0;
  // `deleteMany` ne prend pas de `take` : on borne par les identifiants d'un
  // lot lu au prealable.
  for (;;) {
    const lot = await prisma.evenementSalon.findMany({
      where: { createdAt: { lt: limite } },
      select: { id: true },
      take: TAILLE_LOT,
    });
    if (lot.length === 0) break;

    const r = await prisma.evenementSalon.deleteMany({
      where: { id: { in: lot.map((e) => e.id) } },
    });
    efface += r.count;
    console.log(`  … ${efface}/${aEffacer}`);
  }

  console.log(`\n${efface} évènement(s) effacé(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
