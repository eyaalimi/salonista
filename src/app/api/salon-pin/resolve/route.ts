import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { tryNormalizePhone } from "@/lib/phone";

const REMEMBER_COOKIE = "salonista-provider";
const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

const TILE_COLORS = [
  "#D4A574",
  "#E8D2B5",
  "#4A4244",
  "#1F1A1C",
  "#8B6F47",
  "#A88565",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier) {
    return Response.json({ error: "Identifiant requis" }, { status: 400 });
  }

  let user = null;
  if (identifier.includes("@")) {
    user = await prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: { providerProfile: true },
    });
  } else {
    const phone = tryNormalizePhone(identifier);
    if (!phone) {
      return Response.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    user = await prisma.user.findFirst({
      where: { phone, role: "PROVIDER" },
      include: { providerProfile: true },
    });
  }

  if (!user?.providerProfile) {
    return Response.json({ error: "Salon introuvable" }, { status: 404 });
  }

  const provider = user.providerProfile;
  const employees = await prisma.salonEmployee.findMany({
    where: { providerId: provider.id, active: true },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      role: true,
      pinHash: true,
    },
  });

  const res = Response.json({
    providerId: provider.id,
    salonName: provider.salonName,
    employees: employees.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      role: e.role,
      hasPin: !!e.pinHash,
      avatarColor: colorFor(e.id),
    })),
  });
  res.headers.append(
    "Set-Cookie",
    `${REMEMBER_COOKIE}=${provider.id}; Path=/; Max-Age=${REMEMBER_MAX_AGE}; SameSite=Lax`,
  );
  return res;
}

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(REMEMBER_COOKIE)?.value;
  if (!cookie) {
    return Response.json({ error: "Aucun salon mémorisé" }, { status: 404 });
  }
  const provider = await prisma.providerProfile.findUnique({
    where: { id: cookie },
    select: { id: true, salonName: true },
  });
  if (!provider) {
    const res = Response.json({ error: "Salon introuvable" }, { status: 404 });
    res.headers.append(
      "Set-Cookie",
      `${REMEMBER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    );
    return res;
  }
  const employees = await prisma.salonEmployee.findMany({
    where: { providerId: provider.id, active: true },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
    select: { id: true, displayName: true, role: true, pinHash: true },
  });
  return Response.json({
    providerId: provider.id,
    salonName: provider.salonName,
    employees: employees.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      role: e.role,
      hasPin: !!e.pinHash,
      avatarColor: colorFor(e.id),
    })),
  });
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${REMEMBER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
  );
  return res;
}
