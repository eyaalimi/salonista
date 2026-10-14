/**
 * Range a sa place la « ville » tapee librement a l'inscription.
 *
 * Usage :
 *   npx tsx scripts/reparer-adresses-salons.ts            # inspecte, n'ecrit rien
 *   npx tsx scripts/reparer-adresses-salons.ts --apply    # applique
 *
 * LE PROBLEME. Avant ce correctif, l'etape 1 de l'assistant ecrivait une
 * ville en texte libre dans `city`, que le profil lit comme une DELEGATION.
 * Une gerante qui tapait « Tunis » se retrouvait avec « Tunis » comme
 * delegation — ce n'en est pas une — et aucun gouvernorat.
 *
 * CE QUE FAIT LE SCRIPT, ET RIEN DE PLUS. Le seul cas sur : la valeur est
 * EXACTEMENT un nom de gouvernorat. Elle passe en `governorate`, et la fausse
 * delegation est videe ; la gerante n'aura plus qu'a choisir la sienne dans
 * la liste de son profil.
 *
 * Tout le reste (« Menzah 6 », « tunis centre ») est LISTE, jamais modifie :
 * deviner une delegation ecrirait une adresse fausse qui aurait l'air juste.
 * La decision vit dans `reparerAdresse` (pure, testee).
 *
 * INSPECTE PAR DEFAUT, comme les autres scripts de ce dossier.
 */

import { prisma } from "../src/lib/prisma";
import { reparerAdresse } from "../src/lib/inscription-salon";

const apply = process.argv.includes("--apply");

async function main() {
  const salons = await prisma.providerProfile.findMany({
    where: { city: { not: null } },
    select: { id: true, salonName: true, city: true, governorate: true },
    orderBy: { createdAt: "desc" },
  });

  const aReparer: Array<{ id: string; nom: string; avant: string; gouvernorat: string }> = [];
  const ambigus: Array<{ nom: string; valeur: string }> = [];

  for (const s of salons) {
    const r = reparerAdresse(s);
    if (r.action === "gouvernorat") {
      aReparer.push({ id: s.id, nom: s.salonName, avant: s.city ?? "", gouvernorat: r.gouvernorat });
    } else if (r.action === "ambigu") {
      ambigus.push({ nom: s.salonName, valeur: r.valeur });
    }
  }

  console.log(`Salons avec une ville renseignée : ${salons.length}`);
  console.log(`À ranger en gouvernorat          : ${aReparer.length}`);
  console.log(`Ambigus, laissés en l'état       : ${ambigus.length}\n`);

  for (const a of aReparer) {
    console.log(`  ✓ ${a.nom.padEnd(28)} « ${a.avant} » → gouvernorat ${a.gouvernorat}, délégation à choisir`);
  }
  if (ambigus.length > 0) {
    console.log("\nÀ corriger à la main (la gérante, depuis son profil) :");
    for (const a of ambigus) console.log(`  ? ${a.nom.padEnd(28)} « ${a.valeur} »`);
  }

  if (aReparer.length === 0) {
    console.log("\nRien à ranger.");
    return;
  }
  if (!apply) {
    console.log("\nAucune écriture — relance avec --apply pour appliquer.");
    return;
  }

  for (const a of aReparer) {
    await prisma.providerProfile.update({
      where: { id: a.id },
      data: { governorate: a.gouvernorat, city: null },
    });
  }
  console.log(`\n${aReparer.length} salon(s) mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
