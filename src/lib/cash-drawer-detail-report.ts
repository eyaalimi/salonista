import { prisma } from "@/lib/prisma";

export type DetailReportSale = {
  id: string;
  receiptNumber: string;
  closedAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  items: Array<{ name: string; quantity: number; price: string }>;
  paymentMethods: Array<{ method: string; amount: string }>;
  subtotal: string;
  taxTotal: string;
  total: string;
};

export type DetailReport = {
  provider: {
    salonName: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
  } | null;
  session: {
    id: string;
    sessionNumber: string;
    openedAt: Date;
    closedAt: Date | null;
    openedBy: string;
    openingFloat: string;
    expectedCash: string | null;
    closingCount: string | null;
    variance: string | null;
  };
  totals: {
    salesCount: number;
    grossTotal: string;
    discountsTotal: string;
    tipsTotal: string;
    refundsTotal: string;
    expensesTotal: string;
  };
  paymentsByMethod: Array<{ method: string; amount: string }>;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  expenses: Array<{ amount: string; reason: string; category: string }>;
  sales: DetailReportSale[];
};

export async function buildDetailReport(
  sessionId: string,
  providerId: string,
): Promise<DetailReport | null> {
  const session = await prisma.cashDrawerSession.findUnique({
    where: { id: sessionId },
    include: { employee: { select: { displayName: true } } },
  });
  if (!session || session.providerId !== providerId) return null;

  const provider = (await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: {
      salonName: true,
      address: true,
      city: true,
      phone: true,
      matriculeFiscal: true,
    } as never,
  })) as {
    salonName: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    matriculeFiscal: string | null;
  } | null;

  const closedAt = session.closedAt ?? new Date();
  const windowFilter = { gte: session.openedAt, lte: closedAt };

  const [salesAgg, refundsAgg, paymentsByMethod, taxGroups, expenses, sales] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { providerId, status: "PAID", closedAt: windowFilter },
        _count: true,
        _sum: { total: true, discountAmount: true, tipTotal: true },
      }),
      prisma.refund.aggregate({
        where: { sale: { providerId }, createdAt: windowFilter },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { cashDrawerSessionId: sessionId },
        _sum: { amount: true },
      }),
      prisma.saleItem.groupBy({
        by: ["taxRateSnapshot"],
        where: { sale: { providerId, status: "PAID", closedAt: windowFilter } },
        _sum: { lineSubtotal: true, lineTaxAmount: true },
      }),
      (prisma as never as {
        cashDrawerExpense: {
          findMany: (args: unknown) => Promise<Array<{ amount: unknown; reason: string; category: string }>>;
        };
      }).cashDrawerExpense.findMany({
        where: { cashDrawerSessionId: sessionId },
        orderBy: { createdAt: "asc" },
      }),
      (prisma as never as {
        sale: {
          findMany: (args: unknown) => Promise<unknown[]>;
        };
      }).sale.findMany({
        where: { providerId, status: "PAID", closedAt: windowFilter },
        orderBy: { closedAt: "asc" },
        select: {
          id: true,
          receiptNumber: true,
          closedAt: true,
          subtotal: true,
          taxTotal: true,
          total: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          items: {
            select: {
              nameSnapshot: true,
              quantity: true,
              priceSnapshot: true,
            },
          },
          payments: {
            select: {
              method: true,
              amount: true,
            },
          },
        },
      }),
    ]);

  type SaleRow = {
    id: string;
    receiptNumber: string;
    closedAt: Date | null;
    subtotal: unknown;
    taxTotal: unknown;
    total: unknown;
    customer: { firstName: string | null; lastName: string | null; phone: string } | null;
    items: Array<{ nameSnapshot: string; quantity: number; priceSnapshot: unknown }>;
    payments: Array<{ method: string; amount: unknown }>;
  };

  const expensesTotal = (expenses as Array<{ amount: unknown }>).reduce(
    (s: number, e: { amount: unknown }) => s + Number(String(e.amount)),
    0,
  );

  const detailSales = (sales as SaleRow[]).map((s) => {
    const phone = s.customer?.phone ?? null;
    const isWalkIn = phone?.startsWith("walk-in-") ?? false;
    return {
      id: s.id,
      receiptNumber: s.receiptNumber,
      closedAt: s.closedAt,
      customerName: s.customer
        ? `${s.customer.firstName ?? ""} ${s.customer.lastName ?? ""}`.trim() ||
          (isWalkIn ? "Client passager" : null)
        : null,
      customerPhone: isWalkIn ? null : phone,
      items: s.items.map((i) => ({
        name: i.nameSnapshot,
        quantity: i.quantity,
        price: String(i.priceSnapshot),
      })),
      paymentMethods: s.payments.map((p) => ({
        method: p.method,
        amount: String(p.amount),
      })),
      subtotal: String(s.subtotal),
      taxTotal: String(s.taxTotal),
      total: String(s.total),
    };
  });

  return {
    provider,
    session: {
      id: session.id,
      sessionNumber: session.id.slice(-4).toUpperCase(),
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openedBy: session.employee.displayName,
      openingFloat: String(session.openingFloat),
      expectedCash: session.expectedCash ? String(session.expectedCash) : null,
      closingCount: session.closingCount ? String(session.closingCount) : null,
      variance: session.variance ? String(session.variance) : null,
    },
    totals: {
      salesCount: salesAgg._count,
      grossTotal: String(salesAgg._sum.total ?? "0.000"),
      discountsTotal: String(salesAgg._sum.discountAmount ?? "0.000"),
      tipsTotal: String(salesAgg._sum.tipTotal ?? "0.000"),
      refundsTotal: String(refundsAgg._sum.totalAmount ?? "0.000"),
      expensesTotal: expensesTotal.toFixed(3),
    },
    paymentsByMethod: (paymentsByMethod as Array<{ method: string; _sum: { amount: unknown } }>).map((p) => ({
      method: p.method,
      amount: String(p._sum.amount ?? "0.000"),
    })),
    taxBreakdown: (taxGroups as Array<{ taxRateSnapshot: unknown; _sum: { lineSubtotal: unknown; lineTaxAmount: unknown } }>).map((t) => ({
      rate: String(t.taxRateSnapshot),
      base: String(t._sum.lineSubtotal ?? "0.000"),
      tax: String(t._sum.lineTaxAmount ?? "0.000"),
    })),
    expenses: (expenses as Array<{ amount: unknown; reason: string; category: string }>).map((e) => ({
      amount: String(e.amount),
      reason: e.reason,
      category: e.category,
    })),
    sales: detailSales,
  };
}

export function renderDetailReportHtml(r: DetailReport): string {
  const fmtDT = (n: string) => Number(n).toFixed(3) + " DT";
  const fmtTime = (d: Date | null) =>
    d
      ? new Date(d).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const methodLabel: Record<string, string> = {
    CASH: "Espèces",
    CARD: "Carte",
    BANK_TRANSFER: "Virement",
    REWARDS: "Points fidélité",
    OTHER: "Autre",
  };

  const salesRows = r.sales
    .map(
      (s) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;">${fmtTime(s.closedAt)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;">${s.receiptNumber}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${s.customerName ?? "—"}${s.customerPhone ? `<br><span style="color:#777;font-family:monospace;font-size:10px;">${s.customerPhone}</span>` : ""}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${s.items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;">${s.paymentMethods.map((p) => `${methodLabel[p.method] ?? p.method} ${fmtDT(p.amount)}`).join("<br>")}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;font-size:11px;font-weight:600;">${fmtDT(s.total)}</td>
    </tr>
  `,
    )
    .join("");

  const paymentsRows = r.paymentsByMethod
    .map(
      (p) =>
        `<tr><td style="padding:4px 8px;">${methodLabel[p.method] ?? p.method}</td><td style="padding:4px 8px;text-align:right;font-family:monospace;">${fmtDT(p.amount)}</td></tr>`,
    )
    .join("");

  const taxRows = r.taxBreakdown
    .map(
      (t) =>
        `<tr><td style="padding:4px 8px;">TVA ${Number(t.rate).toFixed(2)}%</td><td style="padding:4px 8px;text-align:right;font-family:monospace;">${fmtDT(t.base)} HT</td><td style="padding:4px 8px;text-align:right;font-family:monospace;">${fmtDT(t.tax)}</td></tr>`,
    )
    .join("");

  const expensesRows = r.expenses
    .map(
      (e) =>
        `<tr><td style="padding:4px 8px;">${e.category}</td><td style="padding:4px 8px;">${e.reason}</td><td style="padding:4px 8px;text-align:right;font-family:monospace;">${fmtDT(e.amount)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport de caisse — ${r.provider?.salonName ?? "Salonista"}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1F1A1C; font-size: 12px; margin: 0; }
  h1 { font-family: Georgia, serif; font-size: 22px; margin: 0 0 4px; }
  h2 { font-family: Georgia, serif; font-size: 14px; margin: 24px 0 8px; color: #4A4244; }
  .meta { font-size: 11px; color: #777; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #777; padding: 8px; text-align: left; border-bottom: 2px solid #eee; }
  .summary td { padding: 4px 8px; }
  .summary tr:last-child td { font-weight: 600; padding-top: 8px; border-top: 1px solid #ddd; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <header style="border-bottom:2px solid #1F1A1C;padding-bottom:12px;">
    <h1>${r.provider?.salonName ?? "Salonista"}</h1>
    <div class="meta">
      ${r.provider?.address ?? ""}${r.provider?.city ? `, ${r.provider.city}` : ""}<br>
      ${r.provider?.phone ?? ""}${r.provider?.matriculeFiscal ? ` · MF ${r.provider.matriculeFiscal}` : ""}
    </div>
  </header>

  <div style="margin-top:16px;">
    <strong>Rapport de caisse #${r.session.sessionNumber}</strong><br>
    <span class="meta">
      Ouverture: ${fmtDate(r.session.openedAt)} à ${fmtTime(r.session.openedAt)} par ${r.session.openedBy}<br>
      ${r.session.closedAt ? `Clôture: ${fmtDate(r.session.closedAt)} à ${fmtTime(r.session.closedAt)}` : "Session ouverte"}
    </span>
  </div>

  <div class="grid">
    <div>
      <h2>Récapitulatif</h2>
      <table class="summary">
        <tr><td>Nombre de ventes</td><td style="text-align:right;font-family:monospace;">${r.totals.salesCount}</td></tr>
        <tr><td>Chiffre brut</td><td style="text-align:right;font-family:monospace;">${fmtDT(r.totals.grossTotal)}</td></tr>
        <tr><td>Remises</td><td style="text-align:right;font-family:monospace;">−${fmtDT(r.totals.discountsTotal)}</td></tr>
        <tr><td>Pourboires</td><td style="text-align:right;font-family:monospace;">${fmtDT(r.totals.tipsTotal)}</td></tr>
        <tr><td>Remboursements</td><td style="text-align:right;font-family:monospace;">−${fmtDT(r.totals.refundsTotal)}</td></tr>
        <tr><td>Dépenses caisse</td><td style="text-align:right;font-family:monospace;">−${fmtDT(r.totals.expensesTotal)}</td></tr>
      </table>

      <h2>Encaissements par moyen</h2>
      <table>${paymentsRows || `<tr><td style="padding:4px 8px;color:#777;">Aucun</td></tr>`}</table>

      ${r.expenses.length > 0 ? `<h2>Dépenses</h2><table>${expensesRows}</table>` : ""}
    </div>

    <div>
      <h2>Tiroir</h2>
      <table class="summary">
        <tr><td>Fond d&apos;ouverture</td><td style="text-align:right;font-family:monospace;">${fmtDT(r.session.openingFloat)}</td></tr>
        ${r.session.expectedCash ? `<tr><td>Espèces attendues</td><td style="text-align:right;font-family:monospace;">${fmtDT(r.session.expectedCash)}</td></tr>` : ""}
        ${r.session.closingCount ? `<tr><td>Espèces comptées</td><td style="text-align:right;font-family:monospace;">${fmtDT(r.session.closingCount)}</td></tr>` : ""}
        ${r.session.variance ? `<tr><td>Écart</td><td style="text-align:right;font-family:monospace;color:${Number(r.session.variance) < 0 ? "#c00" : "#080"};">${fmtDT(r.session.variance)}</td></tr>` : ""}
      </table>

      ${r.taxBreakdown.length > 0 ? `<h2>TVA</h2><table>${taxRows}</table>` : ""}
    </div>
  </div>

  <h2>Détail des ventes</h2>
  ${r.sales.length === 0 ? `<p style="color:#777;font-style:italic;">Aucune vente sur cette session.</p>` : `
  <table>
    <thead>
      <tr>
        <th>Heure</th>
        <th>N° reçu</th>
        <th>Cliente</th>
        <th>Articles</th>
        <th>Paiement</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${salesRows}</tbody>
  </table>
  `}

  <footer style="margin-top:24px;text-align:center;color:#999;font-size:10px;">
    Généré le ${new Date().toLocaleString("fr-FR")} — Salonista POS
  </footer>

  <script>
    // Auto-trigger print dialog when opened in browser. The window.location
    // check skips this when the HTML is embedded in an email.
    if (window.location && window.location.protocol !== 'mailto:') {
      // Defer slightly so styles apply before the print dialog snapshots.
      setTimeout(function(){ window.print(); }, 250);
    }
  </script>
</body>
</html>`;
}
