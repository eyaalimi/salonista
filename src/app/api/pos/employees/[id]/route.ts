import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";

type UpdateBody = {
  displayName?: string;
  role?: "OWNER" | "MANAGER" | "CASHIER" | "STYLIST";
  phone?: string | null;
  email?: string | null;
  active?: boolean;
  pin?: string | null; // null = remove PIN, string = set new PIN
  commissionRate?: number | string | null; // null/"" = remove commission
};

const VALID_ROLES = new Set(["OWNER", "MANAGER", "CASHIER", "STYLIST"]);

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const existing = (await (prisma as never as {
    salonEmployee: { findFirst: (args: unknown) => Promise<{ id: string; role: string } | null> };
  }).salonEmployee.findFirst({
    where: { id, providerId: actor.providerId },
    select: { id: true, role: true },
  })) as { id: string; role: string } | null;
  if (!existing) {
    return Response.json({ error: "Employé introuvable." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) {
    return Response.json({ error: "Corps requis." }, { status: 400 });
  }

  if (body.role && !VALID_ROLES.has(body.role)) {
    return Response.json({ error: "Rôle invalide." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.displayName !== undefined) {
    if (!body.displayName.trim()) {
      return Response.json({ error: "Nom requis." }, { status: 400 });
    }
    data.displayName = body.displayName.trim();
  }
  if (body.role !== undefined) {
    // Don't let a non-OWNER demote the last owner.
    if (existing.role === "OWNER" && body.role !== "OWNER") {
      const ownerCount = (await (prisma as never as {
        salonEmployee: { count: (args: unknown) => Promise<number> };
      }).salonEmployee.count({
        where: { providerId: actor.providerId, role: "OWNER", active: true },
      })) as number;
      if (ownerCount <= 1) {
        return Response.json(
          { error: "Au moins un propriétaire doit rester actif." },
          { status: 409 },
        );
      }
    }
    data.role = body.role;
  }
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.active !== undefined) data.active = body.active;
  if (body.pin !== undefined) {
    if (body.pin === null || body.pin === "") {
      data.pinHash = null;
    } else {
      if (!/^\d{4}$/.test(body.pin)) {
        return Response.json(
          { error: "Le PIN doit comporter exactement 4 chiffres." },
          { status: 400 },
        );
      }
      data.pinHash = await bcrypt.hash(body.pin, 10);
    }
  }
  if (body.commissionRate !== undefined) {
    if (body.commissionRate === null || body.commissionRate === "") {
      data.commissionRate = null;
    } else {
      const n =
        typeof body.commissionRate === "string"
          ? Number(body.commissionRate)
          : body.commissionRate;
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return Response.json(
          { error: "Taux de commission invalide (0 à 100 %)." },
          { status: 400 },
        );
      }
      data.commissionRate = n.toFixed(2);
    }
  }

  await (prisma as never as {
    salonEmployee: { update: (args: unknown) => Promise<unknown> };
  }).salonEmployee.update({ where: { id }, data });

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const existing = (await (prisma as never as {
    salonEmployee: { findFirst: (args: unknown) => Promise<{ id: string; role: string } | null> };
  }).salonEmployee.findFirst({
    where: { id, providerId: actor.providerId },
    select: { id: true, role: true },
  })) as { id: string; role: string } | null;
  if (!existing) {
    return Response.json({ error: "Employé introuvable." }, { status: 404 });
  }

  if (existing.role === "OWNER") {
    const ownerCount = (await (prisma as never as {
      salonEmployee: { count: (args: unknown) => Promise<number> };
    }).salonEmployee.count({
      where: { providerId: actor.providerId, role: "OWNER", active: true },
    })) as number;
    if (ownerCount <= 1) {
      return Response.json(
        { error: "Au moins un propriétaire doit rester actif." },
        { status: 409 },
      );
    }
  }

  // Block hard delete if the employee has any FK history; deactivate instead.
  const hasHistory = (await (prisma as never as {
    sale: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  }).sale.findFirst({
    where: { employeeId: id },
    select: { id: true },
  })) as { id: string } | null;

  if (hasHistory) {
    await (prisma as never as {
      salonEmployee: { update: (args: unknown) => Promise<unknown> };
    }).salonEmployee.update({
      where: { id },
      data: { active: false },
    });
    return Response.json({ ok: true, deactivated: true });
  }

  await (prisma as never as {
    salonEmployee: { delete: (args: unknown) => Promise<unknown> };
  }).salonEmployee.delete({ where: { id } });

  return Response.json({ ok: true });
}
