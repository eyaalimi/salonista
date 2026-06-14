import { NextRequest } from "next/server";
import { requirePermission, toResponse } from "@/lib/employee-session";
import { prisma } from "@/lib/prisma";
import { buildDetailReport, renderDetailReportHtml } from "@/lib/cash-drawer-detail-report";
import { sendCashDrawerReport } from "@/lib/mail";

type Body = { to?: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  let employee;
  try {
    employee = await requirePermission("pos.cash_drawer");
  } catch (err) {
    const r = toResponse(err);
    if (r) return r;
    throw err;
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as Body | null;
  let recipient = body?.to?.trim();

  // Default: send to the salon owner's email.
  if (!recipient) {
    const owner = await prisma.user.findFirst({
      where: { providerProfile: { id: employee.providerId } },
      select: { email: true },
    });
    recipient = owner?.email ?? undefined;
    if (!recipient) {
      return Response.json(
        { error: "Aucune adresse email destinataire. Précisez-en une." },
        { status: 400 },
      );
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return Response.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const report = await buildDetailReport(id, employee.providerId);
  if (!report) {
    return Response.json({ error: "Rapport introuvable." }, { status: 404 });
  }

  const html = renderDetailReportHtml(report);
  try {
    await sendCashDrawerReport(
      recipient,
      report.provider?.salonName ?? "Salonista",
      report.session.sessionNumber,
      html,
    );
  } catch (err) {
    console.error("[rapport-email] send failed:", err);
    return Response.json(
      { error: "Envoi impossible. Vérifiez la configuration SMTP." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, to: recipient });
}
