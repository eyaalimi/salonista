/**
 * Televersement d'images.
 *
 * Le format est detecte dans les OCTETS du fichier, jamais lu dans ce que
 * declare l'appelant : `file.type` est un en-tete que le navigateur envoie et
 * que n'importe qui peut falsifier. L'extension ecrite sur le disque vient
 * d'une liste blanche, jamais du nom d'origine.
 *
 * Sans ces deux regles, on deposait un `.html` ou un `.svg` en annoncant
 * `image/png`. Nginx servant `/uploads/` en direct, le fichier s'executait en
 * MEME ORIGINE que l'application — vol de session, actions au nom de la
 * victime. Voir `src/lib/upload-image.ts` pour le detail.
 *
 * Chaque image est re-encodee en WebP et declinee en 400/800/1600 px. Outre
 * la securite — re-encoder detruit toute charge utile cachee dans le fichier
 * d'origine — cela corrige une mesure de production : des vignettes de
 * 1280 px etaient servies dans 160 px.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { getCurrentEmployee } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  EXTENSION_SORTIE,
  largeursAGenerer,
  nomVariante,
  refusFormat,
  refusNombre,
  refusQuota,
  refusTaille,
} from "@/lib/upload-image";

export async function POST(req: NextRequest) {
  // Accept either a regular NextAuth web session OR a PIN-based POS employee
  // session. Either is sufficient to upload an image.
  const [session, employee] = await Promise.all([
    getServerSession(authOptions),
    getCurrentEmployee().catch(() => null),
  ]);
  if (!session && !employee) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  // Un employe de caisse n'a pas toujours de `User` : on retombe alors sur
  // son identifiant d'employe pour le compter au quota.
  const quotaKey = session?.user?.id ?? employee?.id;
  if (!quotaKey) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const formData = await req.formData();
  // Accept "file" (single, what the wizard sends) OR "files" (plural, legacy).
  const single = formData.get("file");
  const multiple = formData.getAll("files") as File[];
  const files: File[] =
    multiple.length > 0
      ? (multiple as File[])
      : single instanceof File
        ? [single]
        : [];

  const refusN = refusNombre(files.length);
  if (refusN) {
    return NextResponse.json({ error: refusN.message }, { status: refusN.status });
  }

  // Quota journalier, glissant sur 24 h.
  const depuis = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const envoisAujourdhui = await prisma.uploadLog.count({
    where: { userId: quotaKey, createdAt: { gte: depuis } },
  });
  const refusQ = refusQuota(envoisAujourdhui + files.length - 1);
  if (refusQ) {
    return NextResponse.json({ error: refusQ.message }, { status: refusQ.status });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const urls: string[] = [];

  for (const file of files) {
    const refusT = refusTaille(file.size);
    if (refusT) {
      return NextResponse.json({ error: refusT.message }, { status: refusT.status });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // La verite sur le fichier : ce que sharp lit dans ses octets. Un `.html`
    // renomme en `.png` echoue ici, quel que soit le `Content-Type` annonce.
    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer).metadata();
    } catch {
      return NextResponse.json(
        { error: "Ce fichier n'est pas une image valide." },
        { status: 400 },
      );
    }

    const refusF = refusFormat(metadata.format);
    if (refusF) {
      return NextResponse.json({ error: refusF.message }, { status: refusF.status });
    }

    const base = crypto.randomUUID();
    const largeurSource = metadata.width ?? 0;

    // Le fichier canonique, celui qui part en base. `withoutEnlargement`
    // evite de gonfler une petite image jusqu'a 1600 px pour rien.
    const canonique = await sharp(buffer)
      .rotate() // respecte l'orientation EXIF avant de la perdre au re-encodage
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(path.join(uploadDir, `${base}.${EXTENSION_SORTIE}`), canonique);

    // Les variantes servies via srcset.
    for (const largeur of largeursAGenerer(largeurSource)) {
      const variante = await sharp(buffer)
        .rotate()
        .resize({ width: largeur, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      await writeFile(path.join(uploadDir, nomVariante(base, largeur)), variante);
    }

    await prisma.uploadLog.create({
      data: { userId: quotaKey, bytes: canonique.length },
    });

    urls.push(`/uploads/${base}.${EXTENSION_SORTIE}`);
  }

  // Backwards-compatible response: include both shapes so single-file callers
  // can read `url` and batch callers can read `urls`.
  return NextResponse.json({ urls, url: urls[0] ?? null });
}
