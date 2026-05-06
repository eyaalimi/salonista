import { NextRequest } from "next/server";
import { requireModule } from "@/lib/modules";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { createSaleFromPayload, type SalePayload } from "@/lib/pos-sale-create";

type Body = { sales: Array<SalePayload & { clientTotal?: string }> };

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
  if (!body || !Array.isArray(body.sales)) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const payload of body.sales) {
    if (!payload.offlineId) {
      results.push({ status: "error", error: "offlineId requis" });
      continue;
    }
    const result = await createSaleFromPayload({
      payload,
      providerId: employee.providerId,
      employeeId: employee.id,
      clientTotal: payload.clientTotal,
      fromSync: true,
    });
    if (result.kind === "ok") {
      results.push({
        offlineId: payload.offlineId,
        status: "ok",
        saleId: result.saleId,
        receiptNumber: result.receiptNumber,
      });
    } else if (result.kind === "duplicate") {
      results.push({
        offlineId: payload.offlineId,
        status: "duplicate",
        saleId: result.saleId,
        receiptNumber: result.receiptNumber,
      });
    } else {
      results.push({
        offlineId: payload.offlineId,
        status: "conflict",
        error: result.error,
        conflicts: result.conflicts ?? [],
      });
    }
  }

  return Response.json({ results });
}
