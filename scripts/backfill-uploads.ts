/**
 * Rattrapage des images televersees avant le lot C.
 *
 * Le lot C re-encode chaque televersement en WebP et le decline en 400/800/
 * 1600 px, servis via srcset. Il ne vaut que pour les NOUVEAUX fichiers : les
 * photos deja sur le disque sont restees en `.jpg`/`.png`, reconnues comme
 * heritees par `aDesVariantes()` et servies en pleine resolution.
 *
 * Mesure en production le 24 aout : une image de 1600 px telechargee pour
 * s'afficher dans 214 px, un premier rendu a 7,4 s en cache froid pour un TTFB
 * a 277 ms. Ce ne sont pas les serveurs qui sont lents.
 *
 * Ce script produit EXACTEMENT ce que produit `src/app/api/upload/route.ts` —
 * meme rotation EXIF, meme resize, meme qualite — en important les memes
 * helpers. Ne redis aucune de ces regles ici : c'est ce genre de duplication
 * qui fait diverger le rattrapage et la route au premier changement.
 *
 * Usage :
 *   npx tsx scripts/backfill-uploads.ts            # simule, n'ecrit RIEN
 *   npx tsx scripts/backfill-uploads.ts --apply    # convertit et reecrit
 *
 * Idempotent : un fichier deja converti est ignore. Les originaux ne sont
 * JAMAIS supprimes — si une reference en base etait manquee quelque part, elle
 * continue de fonctionner au lieu d'afficher une image cassee.
 *
 * Sequentiel a dessein : la production tourne sur une Lightsail a 1 Go de RAM.
 * Dix `sharp` en parallele sur des images de 1600 px la mettraient a genoux.
 */

// `tsx` ne charge pas `.env` comme le fait Next.js : sans ces deux lignes,
// DATABASE_URL est absente et pg echoue sur « client password must be a
// string ». Meme amorce que `scripts/create-admin.ts`.
import { config } from "dotenv";
config();

import { readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  EXTENSION_SORTIE,
  LARGEURS_VARIANTES,
  largeursAGenerer,
  nomVariante,
} from "../src/lib/upload-image";
import {
  decideFichier,
  formaterOctets,
  reecrireTableau,
  reecrireUrl,
} from "../src/lib/backfill-uploads";

const apply = process.argv.includes("--apply");

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL introuvable. Lance le script depuis le dossier qui contient" +
      "\nle fichier .env (/home/ubuntu/salonista en production).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL),
});

const DOSSIER = path.join(process.cwd(), "public", "uploads");

type Echec = { fichier: string; raison: string };

async function convertirFichiers() {
  let fichiers: string[];
  try {
    fichiers = await readdir(DOSSIER);
  } catch {
    console.error(`Dossier introuvable : ${DOSSIER}`);
    process.exit(1);
  }

  const presents = new Set(fichiers);
  const aConvertir: { fichier: string; base: string }[] = [];
  let ignores = 0;

  for (const fichier of fichiers) {
    const decision = decideFichier(fichier, presents);
    if (decision.action === "convertir") {
      aConvertir.push({ fichier, base: decision.base });
    } else {
      ignores++;
    }
  }

  console.log(`${fichiers.length} fichier(s) dans public/uploads/`);
  console.log(`  ${aConvertir.length} a convertir, ${ignores} ignore(s)\n`);

  const basesConverties = new Set<string>();
  const echecs: Echec[] = [];
  let poidsAvant = 0;
  let poidsApres = 0;
  let poidsDisque = 0;

  for (const { fichier, base } of aConvertir) {
    const chemin = path.join(DOSSIER, fichier);

    try {
      const octetsAvant = (await stat(chemin)).size;

      // Un seul `sharp` vivant a la fois. Le buffer source est relu pour
      // chaque taille plutot que garde en memoire entre les iterations : sur
      // une machine a 1 Go, tenir un decode de 1600 px pendant qu'on en ouvre
      // un autre est precisement ce qu'il faut eviter.
      const source = await readFile(chemin);

      const metadata = await sharp(source).metadata();
      const largeurSource = metadata.width ?? 0;

      // La canonique, celle qui part en base. Identique a la route.
      const canonique = await sharp(source)
        .rotate() // respecte l'orientation EXIF avant de la perdre au re-encodage
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      let octetsDisque = canonique.length;
      // Ce que le navigateur telecharge REELLEMENT pour une vignette. Le
      // srcset ne sert qu'UNE variante, jamais la somme : additionner les
      // quatre fichiers ferait croire que la conversion alourdit le site,
      // alors qu'elle divise par dix ce qui passe sur le reseau.
      let octetsVignette = canonique.length;

      if (apply) {
        await writeFile(
          path.join(DOSSIER, `${base}.${EXTENSION_SORTIE}`),
          canonique,
        );
      }

      for (const largeur of largeursAGenerer(largeurSource)) {
        const variante = await sharp(source)
          .rotate()
          .resize({ width: largeur, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        octetsDisque += variante.length;
        if (largeur === LARGEURS_VARIANTES[0]) octetsVignette = variante.length;
        if (apply) {
          await writeFile(path.join(DOSSIER, nomVariante(base, largeur)), variante);
        }
      }

      poidsAvant += octetsAvant;
      poidsApres += octetsVignette;
      poidsDisque += octetsDisque;
      basesConverties.add(base);

      console.log(
        `  ${apply ? "converti" : "simule  "}  ${fichier}  ` +
          `${formaterOctets(octetsAvant)} -> ${formaterOctets(octetsVignette)} en vignette`,
      );
    } catch (e) {
      // Un fichier illisible ne doit pas interrompre le lot. Sa reference en
      // base reste sur l'original, qui est toujours la.
      const raison = e instanceof Error ? e.message : String(e);
      echecs.push({ fichier, raison });
      console.log(`  ECHEC     ${fichier}  ${raison}`);
    }
  }

  return { basesConverties, echecs, ignores, poidsAvant, poidsApres, poidsDisque };
}

/**
 * Reecrit les references en base.
 *
 * Une transaction PAR ENTITE, pas une transaction geante : sur plusieurs
 * centaines de lignes, un verrou unique tiendrait la base pendant toute la
 * duree du rattrapage, et le moindre echec annulerait l'ensemble d'un travail
 * par ailleurs correct.
 */
async function reecrireBase(basesConverties: ReadonlySet<string>) {
  const compte = {
    "User.avatar": 0,
    "ProviderProfile.photos": 0,
    "ProviderProfile.logo": 0,
    "Offer.photos": 0,
    "Product.photo": 0,
  };

  const users = await prisma.user.findMany({
    where: { avatar: { startsWith: "/uploads/" } },
    select: { id: true, avatar: true },
  });
  for (const u of users) {
    // `startsWith` exclut deja les null cote SQL ; le garde ci-dessous n'est
    // la que pour que TypeScript le sache.
    if (!u.avatar) continue;
    const suivant = reecrireUrl(u.avatar, basesConverties);
    if (suivant === u.avatar) continue;
    compte["User.avatar"]++;
    if (apply) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: u.id }, data: { avatar: suivant } }),
      ]);
    }
  }

  const salons = await prisma.providerProfile.findMany({
    select: { id: true, photos: true, logo: true },
  });
  for (const s of salons) {
    const photos = reecrireTableau(s.photos, basesConverties);
    const logo = s.logo ? reecrireUrl(s.logo, basesConverties) : null;
    const logoChange = logo !== null && logo !== s.logo;
    if (!photos && !logoChange) continue;

    if (photos) compte["ProviderProfile.photos"]++;
    if (logoChange) compte["ProviderProfile.logo"]++;

    if (apply) {
      await prisma.$transaction([
        prisma.providerProfile.update({
          where: { id: s.id },
          data: {
            ...(photos ? { photos } : {}),
            ...(logoChange ? { logo } : {}),
          },
        }),
      ]);
    }
  }

  const offres = await prisma.offer.findMany({ select: { id: true, photos: true } });
  for (const o of offres) {
    const photos = reecrireTableau(o.photos, basesConverties);
    if (!photos) continue;
    compte["Offer.photos"]++;
    if (apply) {
      await prisma.$transaction([
        prisma.offer.update({ where: { id: o.id }, data: { photos } }),
      ]);
    }
  }

  const produits = await prisma.product.findMany({
    where: { photo: { startsWith: "/uploads/" } },
    select: { id: true, photo: true },
  });
  for (const p of produits) {
    if (!p.photo) continue;
    const suivant = reecrireUrl(p.photo, basesConverties);
    if (suivant === p.photo) continue;
    compte["Product.photo"]++;
    if (apply) {
      await prisma.$transaction([
        prisma.product.update({ where: { id: p.id }, data: { photo: suivant } }),
      ]);
    }
  }

  return compte;
}

async function main() {
  if (!apply) {
    console.log("=== SIMULATION — rien ne sera ecrit ===\n");
  }

  const { basesConverties, echecs, ignores, poidsAvant, poidsApres, poidsDisque } =
    await convertirFichiers();

  const compte = await reecrireBase(basesConverties);

  console.log("\n--- Bilan ---");
  console.log(`Fichiers convertis : ${basesConverties.size}`);
  console.log(`Fichiers ignores   : ${ignores}`);
  console.log(`Fichiers en echec  : ${echecs.length}`);
  for (const e of echecs) {
    console.log(`    ${e.fichier} — ${e.raison}`);
  }

  // Le gain se mesure sur ce qui TRANSITE, pas sur ce qui dort sur le disque.
  const gain =
    poidsAvant > 0 ? (100 - (poidsApres / poidsAvant) * 100).toFixed(0) : "0";
  console.log(
    `\nServi aujourd'hui, en pleine resolution : ${formaterOctets(poidsAvant)}` +
      `\nServi apres, en vignette (-400)         : ${formaterOctets(poidsApres)}` +
      `  (-${gain} %)` +
      `\n\nOccupation disque ajoutee (canonique + variantes) : ` +
      `${formaterOctets(poidsDisque)}. Les originaux sont conserves en plus.`,
  );

  console.log("\nLignes de base concernees :");
  for (const [champ, n] of Object.entries(compte)) {
    console.log(`  ${champ.padEnd(24)} ${n}`);
  }

  if (!apply) {
    console.log(
      "\nSimulation seule — aucun fichier ecrit, aucune ligne modifiee." +
        "\nRelance avec --apply pour appliquer.",
    );
  } else {
    console.log(
      "\nLes originaux .jpg/.png sont CONSERVES : une reference manquee" +
        "\ncontinue de fonctionner. Le menage se fera apres verification.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
