import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { createSaleFromPayload, type SalePayload } from "@/lib/pos-sale-create";

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("bookings.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const fromStr = params.get("from");
  const toStr = params.get("to");
  const customerId = params.get("customerId");
  const employeeId = params.get("employeeId");
  const status = params.get("status");

  const where: Record<string, unknown> = { providerId: employee.providerId };
  if (fromStr || toStr) {
    where.createdAt = {
      ...(fromStr ? { gte: new Date(fromStr) } : {}),
      ...(toStr ? { lte: new Date(toStr) } : {}),
    };
  }
  if (customerId) where.customerId = customerId;
  if (employeeId) where.employeeId = employeeId;
  if (status) where.status = status;

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      employee: { select: { id: true, displayName: true } },
      _count: { select: { items: true, refunds: true } },
    },
  });
  return Response.json(sales);
}

type Body = SalePayload & { clientTotal?: string };

export async function POST(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("pos.sell");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  try {
    await requireModule(employee.providerId, "POS");
  } catch {
    return Response.json({ error: "Module POS non activé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.lines) || !Array.isArray(body.payments)) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Discount permissions.
  const usesDiscount =
    body.saleDiscount !== undefined && body.saleDiscount !== null
      ? true
      : body.lines.some((l) => l.discount);
  if (usesDiscount && !employee.permissions["pos.discount"]) {
    return Response.json({ error: "Permission insuffisante pour appliquer une remise" }, { status: 403 });
  }

  const result = await createSaleFromPayload({
    payload: body,
    providerId: employee.providerId,
    employeeId: employee.id,
    clientTotal: body.clientTotal,
  });

  if (result.kind === "validation") {
    return Response.json({ error: result.error, conflicts: result.conflicts ?? [] }, { status: 422 });
  }

  const sale = await prisma.sale.findUnique({
    where: { id: result.saleId },
    include: {
      items: true,
      payments: true,
      tipAllocations: true,
      customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      employee: { select: { id: true, displayName: true } },
    },
  });

  let rewards:
    | {
        earned: number;
        redeemed: number;
        welcomeBonus: number;
        birthdayBonus: number;
        newBalance?: number;
      }
    | undefined;
  if (result.kind === "ok" && result.rewards && sale?.customerId) {
    const wallet = await prisma.rewardWallet.findUnique({
      where: { providerId_customerId: { providerId: employee.providerId, customerId: sale.customerId } },
      select: { balance: true },
    });
    rewards = { ...result.rewards, newBalance: wallet?.balance };
  }

  return Response.json(
    { sale, duplicate: result.kind === "duplicate", rewards },
    { status: result.kind === "duplicate" ? 200 : 201 },
  );
}
