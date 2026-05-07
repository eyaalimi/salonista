import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { parseRange } from "@/lib/analytics-range";

// French CSV: comma separator (default), but the values use comma decimal
// — so we wrap numeric strings in quotes to keep the columns aligned.
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function frenchAmount(value: string | number): string {
  return `"${String(value).replace(".", ",")}"`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  let employee;
  try {
    employee = await requirePermission("analytics.view");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const params = req.nextUrl.searchParams;
  const { from, to } = parseRange(params);
  const type = params.get("type") ?? "sales";

  let csv = "";
  let filenameType = "sales";

  if (type === "sales") {
    const sales = await prisma.sale.findMany({
      where: { providerId: employee.providerId, closedAt: { gte: from, lte: to } },
      orderBy: { closedAt: "asc" },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        employee: { select: { displayName: true } },
        _count: { select: { items: true } },
      },
    });
    csv = "Numero;Date;Caissier;Client;Statut;Sous-total;TVA;Pourboire;Total;Rembourse\n";
    for (const s of sales) {
      csv +=
        [
          s.receiptNumber,
          s.closedAt ? new Date(s.closedAt).toLocaleString("fr-FR") : "",
          csvEscape(s.employee.displayName),
          csvEscape(
            s.customer
              ? [s.customer.firstName, s.customer.lastName].filter(Boolean).join(" ") ||
                  s.customer.phone
              : "",
          ),
          s.status,
          frenchAmount(String(s.subtotal)),
          frenchAmount(String(s.taxTotal)),
          frenchAmount(String(s.tipTotal)),
          frenchAmount(String(s.total)),
          frenchAmount(String(s.refundedTotal)),
        ].join(";") + "\n";
    }
  } else if (type === "refunds") {
    filenameType = "refunds";
    const refunds = await prisma.refund.findMany({
      where: {
        sale: { providerId: employee.providerId },
        createdAt: { gte: from, lte: to },
      },
      include: {
        sale: { select: { receiptNumber: true } },
        employee: { select: { displayName: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    csv = "Date;Vente;Caissier;Raison;Methode;Montant;Notes\n";
    for (const r of refunds) {
      csv +=
        [
          new Date(r.createdAt).toLocaleString("fr-FR"),
          r.sale.receiptNumber,
          csvEscape(r.employee.displayName),
          r.reason,
          r.refundMethod,
          frenchAmount(String(r.totalAmount)),
          csvEscape(r.notes ?? ""),
        ].join(";") + "\n";
    }
  } else if (type === "drawer") {
    filenameType = "drawer";
    const sessions = await prisma.cashDrawerSession.findMany({
      where: { providerId: employee.providerId, openedAt: { gte: from, lte: to } },
      include: { employee: { select: { displayName: true } } },
      orderBy: { openedAt: "asc" },
    });
    csv = "Date ouverture;Date fermeture;Employe;Statut;Fond initial;Compte final;Attendu;Variance;Notes\n";
    for (const s of sessions) {
      csv +=
        [
          new Date(s.openedAt).toLocaleString("fr-FR"),
          s.closedAt ? new Date(s.closedAt).toLocaleString("fr-FR") : "",
          csvEscape(s.employee.displayName),
          s.status,
          frenchAmount(String(s.openingFloat)),
          s.closingCount === null ? "" : frenchAmount(String(s.closingCount)),
          s.expectedCash === null ? "" : frenchAmount(String(s.expectedCash)),
          s.variance === null ? "" : frenchAmount(String(s.variance)),
          csvEscape(s.closingNotes ?? ""),
        ].join(";") + "\n";
    }
  } else {
    return Response.json({ error: "Type invalide" }, { status: 400 });
  }

  // BOM so Excel opens UTF-8 cleanly.
  const body = "﻿" + csv;
  const filename = `salonista-${filenameType}-${isoDate(from)}_${isoDate(to)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
