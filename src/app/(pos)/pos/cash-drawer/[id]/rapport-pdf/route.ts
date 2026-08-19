import { NextRequest } from "next/server";
import { getCurrentEmployee } from "@/lib/employee-session";
import { buildDetailReport, renderDetailReportHtml } from "@/lib/cash-drawer-detail-report";
import { hasModule } from "@/lib/modules";

/**
 * Serves an A4-sized HTML page that auto-opens the print dialog.
 * Choosing "Save as PDF" gives the owner a downloadable PDF of the
 * detailed cash drawer report.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!employee.permissions["pos.cash_drawer"]) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!(await hasModule(employee.providerId, "POS"))) {
    return new Response("Module non activé", { status: 403 });
  }
  const { id } = await ctx.params;
  const report = await buildDetailReport(id, employee.providerId);
  if (!report) {
    return new Response("Rapport introuvable", { status: 404 });
  }
  return new Response(renderDetailReportHtml(report), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
