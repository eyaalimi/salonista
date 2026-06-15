import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentEmployee } from "@/lib/employee-session";
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

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

  if (files.length === 0) {
    return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
  }

  if (files.length > 5) {
    return NextResponse.json({ error: "Maximum 5 images" }, { status: 400 });
  }

  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type non supporté: ${file.type}. Utilisez JPG, PNG ou WebP.` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 5 Mo)` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await writeFile(path.join(uploadDir, filename), buffer);

    urls.push(`/uploads/${filename}`);
  }

  // Backwards-compatible response: include both shapes so single-file callers
  // can read `url` and batch callers can read `urls`.
  return NextResponse.json({ urls, url: urls[0] ?? null });
}
