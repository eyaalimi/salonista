/**
 * Staff commissions — GET aggregated pending/paid per employee for a period,
 * PUT to mark a batch as paid (bulk update of all pending SaleItems for one
 * employee within a date range).
 *
 * Mirrors the pattern of src/app/api/admin/commissions/route.ts (list + status
 * update) but scoped to the logged-in provider's own team via requirePermission
 * — no admin-wide access.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { parseRange } from "@/lib/analytics-range";

type EmployeeRow = {
  employeeId: string;
  displayName: string;
  role: string;
  commissionRate: string | null;
  servicesCount: number;
  baseHT: string;
  commissionPending: string;
  commissionPaid: string;
};

export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const providerId = actor.providerId;
  const { from, to } = parseRange(req.nextUrl.searchParams);

  // Fetch every commissioned SaleItem in the window, grouped by employee.
  const items = (await (prisma as never as {
    saleItem: {
      findMany: (a: unknown) => Promise<Array<{
        assignedEmployeeId: string;
        commissionAmount: unknown;
        commissionPaid: boolean;
        lineSubtotal: unknown;
        taxRateSnapshot: unknown;
        quantity: number;
      }>>;
    };
  }).saleItem.findMany({
    where: {
      kind: "SERVICE",
      commissionAmount: { not: null },
      assignedEmployeeId: { not: null },
      sale: {
        providerId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
        closedAt: { gte: from, lte: to },
      },
    },
    select: {
      assignedEmployeeId: true,
      commissionAmount: true,
      commissionPaid: true,
      lineSubtotal: true,
      taxRateSnapshot: true,
      quantity: true,
    },
  })) as Array<{
    assignedEmployeeId: string;
    commissionAmount: unknown;
    commissionPaid: boolean;
    lineSubtotal: unknown;
    taxRateSnapshot: unknown;
    quantity: number;
  }>;

  type Agg = {
    displayName: string;
    role: string;
    commissionRate: string | null;
    servicesCount: number;
    baseHTM: number;
    pendingM: number;
    paidM: number;
  };
  const byEmp = new Map<string, Agg>();

  // Seed with all active employees who have a rate configured, so those with
  // zero sales in the range still surface at 0/0.
  const emps = (await (prisma as never as {
    salonEmployee: {
      findMany: (a: unknown) => Promise<Array<{
        id: string;
        displayName: string;
        role: string;
        commissionRate: unknown | null;
      }>>;
    };
  }).salonEmployee.findMany({
    where: { providerId, active: true, commissionRate: { not: null } },
    select: { id: true, displayName: true, role: true, commissionRate: true },
  })) as Array<{ id: string; displayName: string; role: string; commissionRate: unknown | null }>;
  for (const e of emps) {
    byEmp.set(e.id, {
      displayName: e.displayName,
      role: e.role,
      commissionRate:
        e.commissionRate === null || e.commissionRate === undefined
          ? null
          : String(e.commissionRate),
      servicesCount: 0,
      baseHTM: 0,
      pendingM: 0,
      paidM: 0,
    });
  }

  for (const it of items) {
    const agg = byEmp.get(it.assignedEmployeeId);
    if (!agg) continue;
    agg.servicesCount += it.quantity;
    const lineSubTTC = Number(String(it.lineSubtotal));
    const tax = Number(String(it.taxRateSnapshot));
    const baseHT = lineSubTTC / (1 + tax / 100);
    agg.baseHTM += Math.round(baseHT * 1000);
    const commissionM = Math.round(Number(String(it.commissionAmount)) * 1000);
    if (it.commissionPaid) agg.paidM += commissionM;
    else agg.pendingM += commissionM;
  }

  const rows: EmployeeRow[] = Array.from(byEmp.entries())
    .sort((a, b) => b[1].pendingM - a[1].pendingM)
    .map(([employeeId, e]) => ({
      employeeId,
      displayName: e.displayName,
      role: e.role,
      commissionRate: e.commissionRate,
      servicesCount: e.servicesCount,
      baseHT: (e.baseHTM / 1000).toFixed(3),
      commissionPending: (e.pendingM / 1000).toFixed(3),
      commissionPaid: (e.paidM / 1000).toFixed(3),
    }));

  const totals = {
    pending: rows.reduce((s, r) => s + Number(r.commissionPending), 0).toFixed(3),
    paid: rows.reduce((s, r) => s + Number(r.commissionPaid), 0).toFixed(3),
  };

  return Response.json({
    period: { from: from.toISOString(), to: to.toISOString() },
    totals,
    rows,
  });
}

/**
 * Mark all PENDING commissions for `employeeId` in [from, to] as paid.
 * Mirrors the PUT pattern from admin/commissions but bulk-updates SaleItems
 * scoped to the provider.
 */
export async function PUT(req: NextRequest) {
  let actor;
  try {
    actor = await requirePermission("employees.manage");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }

  const body = (await req.json().catch(() => null)) as {
    employeeId?: string;
    from?: string;
    to?: string;
  } | null;

  if (!body?.employeeId) {
    return Response.json({ error: "employeeId requis" }, { status: 400 });
  }
  if (!body.from || !body.to) {
    return Response.json({ error: "Période requise (from/to)" }, { status: 400 });
  }
  const from = new Date(body.from);
  const to = new Date(body.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Response.json({ error: "Dates invalides" }, { status: 400 });
  }

  // Confirm the employee belongs to this provider — no cross-provider updates.
  const emp = (await (prisma as never as {
    salonEmployee: {
      findFirst: (a: unknown) => Promise<{ id: string } | null>;
    };
  }).salonEmployee.findFirst({
    where: { id: body.employeeId, providerId: actor.providerId },
    select: { id: true },
  })) as { id: string } | null;
  if (!emp) {
    return Response.json({ error: "Employé introuvable" }, { status: 404 });
  }

  const now = new Date();
  const result = (await (prisma as never as {
    saleItem: {
      updateMany: (a: unknown) => Promise<{ count: number }>;
    };
  }).saleItem.updateMany({
    where: {
      kind: "SERVICE",
      assignedEmployeeId: body.employeeId,
      commissionAmount: { not: null },
      commissionPaid: false,
      sale: {
        providerId: actor.providerId,
        status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
        closedAt: { gte: from, lte: to },
      },
    },
    data: {
      commissionPaid: true,
      commissionPaidAt: now,
    },
  })) as { count: number };

  return Response.json({ ok: true, updated: result.count });
}
