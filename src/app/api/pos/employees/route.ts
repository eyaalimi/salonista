import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type CreateBody = {
  displayName?: string;
  role?: "OWNER" | "MANAGER" | "CASHIER" | "STYLIST";
  phone?: string;
  email?: string;
  pin?: string;
};

const VALID_ROLES = new Set(["OWNER", "MANAGER", "CASHIER", "STYLIST"]);

function validatePin(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) {
    return "Le PIN doit comporter exactement 4 chiffres.";
  }
  return null;
}

export async function GET() {
  let employee;
  try {
    employee = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const employees = (await (prisma as never as {
    salonEmployee: { findMany: (args: unknown) => Promise<unknown[]> };
  }).salonEmployee.findMany({
    where: { providerId: employee.providerId },
    orderBy: [{ active: "desc" }, { role: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      role: true,
      phone: true,
      email: true,
      active: true,
      pinHash: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })) as Array<{
    id: string;
    displayName: string;
    role: string;
    phone: string | null;
    email: string | null;
    active: boolean;
    pinHash: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>;

  return Response.json({
    employees: employees.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      role: e.role,
      phone: e.phone,
      email: e.email,
      active: e.active,
      hasPin: !!e.pinHash,
      lastLoginAt: e.lastLoginAt,
      createdAt: e.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body?.displayName?.trim()) {
    return Response.json({ error: "Le nom est requis." }, { status: 400 });
  }
  const role = body.role ?? "CASHIER";
  if (!VALID_ROLES.has(role)) {
    return Response.json({ error: "Rôle invalide." }, { status: 400 });
  }
  if (body.pin) {
    const err = validatePin(body.pin);
    if (err) return Response.json({ error: err }, { status: 400 });
  }

  const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;

  const created = (await (prisma as never as {
    salonEmployee: { create: (args: unknown) => Promise<unknown> };
  }).salonEmployee.create({
    data: {
      providerId: employee.providerId,
      displayName: body.displayName.trim(),
      role,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      pinHash,
    },
    select: { id: true },
  })) as { id: string };

  return Response.json({ id: created.id }, { status: 201 });
}
