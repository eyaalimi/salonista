import { prisma } from "@/lib/prisma";

export type DetailReportSale = {
  id: string;
  receiptNumber: string;
  closedAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  employeeName: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  paymentMethods: Array<{ method: string; amount: string }>;
  subtotal: string;
  taxTotal: string;
  total: string;
};

export type EmployeeBreakdown = {
  employeeId: string;
  employeeName: string;
  salesCount: number;
  articlesCount: number;
  total: string;
};

export type LoyaltyBreakdown = {
  pointsEarned: number;
  pointsRedeemed: number;
  customersAwarded: number;
  customersRedeemed: number;
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
    articlesCount: number;
    averageBasket: string;
  };
  paymentsByMethod: Array<{ method: string; count: number; amount: string }>;
  taxBreakdown: Array<{ rate: string; base: string; tax: string }>;
  expenses: Array<{ amount: string; reason: string; category: string }>;
  salesByEmployee: EmployeeBreakdown[];
  loyalty: LoyaltyBreakdown;
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
  // Whole-day window: from start of the day the session was opened up to the
  // close (or now if still open). Lets the report aggregate ALL employees'
  // sales for the day, not just sales tied to this single session.
  const dayStart = new Date(session.openedAt);
  dayStart.setHours(0, 0, 0, 0);
  const windowFilter = { gte: dayStart, lte: closedAt };

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
        _count: { _all: true },
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
          employeeId: true,
          employee: { select: { displayName: true } },
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

  // Loyalty: aggregate reward transactions across the day window.
  const rewardTxsRaw = await (prisma as never as {
    rewardTransaction: {
      findMany: (a: unknown) => Promise<Array<{
        delta: number;
        walletId: string;
        sale: { providerId: string } | null;
      }>>;
    };
  }).rewardTransaction.findMany({
    where: {
      createdAt: windowFilter,
      sale: { providerId },
    },
    select: { delta: true, walletId: true, sale: { select: { providerId: true } } },
  });
  const earnedWallets = new Set<string>();
  const redeemedWallets = new Set<string>();
  let pointsEarned = 0;
  let pointsRedeemed = 0;
  for (const tx of rewardTxsRaw) {
    if (tx.delta > 0) {
      pointsEarned += tx.delta;
      earnedWallets.add(tx.walletId);
    } else if (tx.delta < 0) {
      pointsRedeemed += -tx.delta;
      redeemedWallets.add(tx.walletId);
    }
  }
  const loyalty: LoyaltyBreakdown = {
    pointsEarned,
    pointsRedeemed,
    customersAwarded: earnedWallets.size,
    customersRedeemed: redeemedWallets.size,
  };

  type SaleRow = {
    id: string;
    receiptNumber: string;
    closedAt: Date | null;
    subtotal: unknown;
    taxTotal: unknown;
    total: unknown;
    employeeId: string;
    employee: { displayName: string } | null;
    customer: { firstName: string | null; lastName: string | null; phone: string } | null;
    items: Array<{ nameSnapshot: string; quantity: number; priceSnapshot: unknown }>;
    payments: Array<{ method: string; amount: unknown }>;
  };

  const expensesTotal = (expenses as Array<{ amount: unknown }>).reduce(
    (s: number, e: { amount: unknown }) => s + Number(String(e.amount)),
    0,
  );

  const articlesCount = (sales as SaleRow[]).reduce(
    (s, sale) => s + sale.items.reduce((ss, it) => ss + it.quantity, 0),
    0,
  );
  const grossNum = Number(String(salesAgg._sum.total ?? "0"));
  const averageBasket =
    salesAgg._count > 0 ? (grossNum / salesAgg._count).toFixed(3) : "0.000";

  const detailSales = (sales as SaleRow[]).map((s) => {
    const phone = s.customer?.phone ?? null;
    const isWalkIn = phone?.startsWith("walk-in-") ?? false;
    return {
      id: s.id,
      receiptNumber: s.receiptNumber,
      closedAt: s.closedAt,
      employeeName: s.employee?.displayName ?? "—",
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

  // Per-employee breakdown.
  const empMap = new Map<string, EmployeeBreakdown>();
  for (const s of sales as SaleRow[]) {
    const key = s.employeeId;
    const name = s.employee?.displayName ?? "—";
    const items = s.items.reduce((acc, it) => acc + it.quantity, 0);
    const cur = empMap.get(key);
    if (cur) {
      cur.salesCount += 1;
      cur.articlesCount += items;
      cur.total = (Number(cur.total) + Number(String(s.total))).toFixed(3);
    } else {
      empMap.set(key, {
        employeeId: key,
        employeeName: name,
        salesCount: 1,
        articlesCount: items,
        total: String(s.total),
      });
    }
  }
  const salesByEmployee = Array.from(empMap.values()).sort(
    (a, b) => Number(b.total) - Number(a.total),
  );

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
      articlesCount,
      averageBasket,
    },
    paymentsByMethod: (paymentsByMethod as Array<{ method: string; _sum: { amount: unknown }; _count: { _all: number } }>).map((p) => ({
      method: p.method,
      count: p._count._all,
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
    salesByEmployee,
    loyalty,
    sales: detailSales,
  };
}

export function renderDetailReportHtml(r: DetailReport): string {
  const fmtNum = (n: string | number) => {
    const num = typeof n === "string" ? Number(n) : n;
    return num.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };
  const fmtInt = (n: number) => n.toLocaleString("fr-FR");
  const fmtTime = (d: Date | null) =>
    d
      ? new Date(d).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  const fmtDateTime = (d: Date) =>
    `${new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })} ${fmtTime(d)}`;

  function diffDuration(start: Date, end: Date): string {
    const ms = end.getTime() - start.getTime();
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  }

  const methodLabel: Record<string, string> = {
    CASH: "Espèces",
    CARD: "Carte",
    BANK_TRANSFER: "Virement",
    LOYALTY_POINTS: "Points fidélité",
    REWARDS: "Points fidélité",
    OTHER: "Autre",
  };
  const methodShort: Record<string, string> = {
    CASH: "ESP",
    CARD: "CB",
    BANK_TRANSFER: "VIR",
    LOYALTY_POINTS: "PTS",
    REWARDS: "PTS",
    OTHER: "AUT",
  };
  const methodColor: Record<string, string> = {
    CASH: "#0a7d3a",
    CARD: "#1a5fb4",
    BANK_TRANSFER: "#8b4513",
    LOYALTY_POINTS: "#a8731f",
    REWARDS: "#a8731f",
    OTHER: "#555",
  };

  const cashSales = r.paymentsByMethod.find((p) => p.method === "CASH");
  const cashFromCash = cashSales ? Number(cashSales.amount) : 0;

  const openingFloat = Number(r.session.openingFloat);
  const expectedCash = r.session.expectedCash ? Number(r.session.expectedCash) : null;
  const closingCount = r.session.closingCount ? Number(r.session.closingCount) : null;
  const variance = r.session.variance ? Number(r.session.variance) : null;
  const expensesTotal = Number(r.totals.expensesTotal);

  const closedAt = r.session.closedAt ?? new Date();
  const duration = diffDuration(r.session.openedAt, closedAt);

  const paymentsRows = r.paymentsByMethod.length
    ? r.paymentsByMethod
        .map(
          (p) => `
        <tr>
          <td>${methodLabel[p.method] ?? p.method}</td>
          <td class="num">${fmtInt(p.count)}</td>
          <td class="num">${fmtNum(p.amount)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">Aucun encaissement</td></tr>`;
  const paymentsTotalAmount = r.paymentsByMethod.reduce(
    (s, p) => s + Number(p.amount),
    0,
  );

  const taxRows = r.taxBreakdown.length
    ? r.taxBreakdown
        .map(
          (t) => `
        <tr>
          <td>TVA ${Number(t.rate).toFixed(0)}%</td>
          <td class="num">${fmtNum(t.tax)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" class="muted">Aucune TVA</td></tr>`;
  const taxTotal = r.taxBreakdown.reduce((s, t) => s + Number(t.tax), 0);

  const salesRows = r.sales
    .map((s) => {
      const mainMethod = s.paymentMethods[0]?.method ?? "OTHER";
      const pillColor = methodColor[mainMethod] ?? "#555";
      const short = methodShort[mainMethod] ?? mainMethod;
      const name = s.customerName ?? "Anonyme";
      const shortId = s.receiptNumber.split("-").pop() ?? s.receiptNumber;
      return `
      <tr>
        <td>${fmtTime(s.closedAt)}</td>
        <td class="mono">#${shortId}</td>
        <td>${name}</td>
        <td>${s.employeeName}</td>
        <td><span class="pill" style="color:${pillColor};border-color:${pillColor};">${short}</span></td>
        <td class="num">${fmtNum(s.total)}</td>
      </tr>`;
    })
    .join("");

  // Per-employee breakdown rows
  const employeeRows = r.salesByEmployee.length
    ? r.salesByEmployee
        .map(
          (e) => `
        <tr>
          <td><strong>${e.employeeName}</strong></td>
          <td class="num">${fmtInt(e.salesCount)}</td>
          <td class="num">${fmtInt(e.articlesCount)}</td>
          <td class="num">${fmtNum(e.total)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">Aucune vente</td></tr>`;

  // Loyalty section
  const loyaltyHtml = `
  <h2>Fidélité</h2>
  <table>
    <thead>
      <tr>
        <th>Mouvement</th>
        <th class="num">Clients</th>
        <th class="num">Points</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Points gagnés</td>
        <td class="num">${fmtInt(r.loyalty.customersAwarded)}</td>
        <td class="num pos">+${fmtInt(r.loyalty.pointsEarned)}</td>
      </tr>
      <tr>
        <td>Points utilisés</td>
        <td class="num">${fmtInt(r.loyalty.customersRedeemed)}</td>
        <td class="num neg">−${fmtInt(r.loyalty.pointsRedeemed)}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <td>Solde net</td>
        <td></td>
        <td class="num">${r.loyalty.pointsEarned - r.loyalty.pointsRedeemed >= 0 ? "+" : ""}${fmtInt(r.loyalty.pointsEarned - r.loyalty.pointsRedeemed)}</td>
      </tr>
    </tfoot>
  </table>`;

  const salonName = (r.provider?.salonName ?? "SALONISTA").toUpperCase();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Rapport de caisse — ${salonName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 11px; margin: 0; line-height: 1.4; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #1a1a1a; }
  .header h1 { margin: 0 0 2px; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
  .header .subtitle { font-size: 11px; color: #666; }
  .header .ref { text-align: right; font-size: 11px; }
  .header .ref strong { font-weight: 700; }

  .meta-box { margin-top: 18px; padding: 14px 16px; border: 1px solid #d8d8d8; border-radius: 4px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 11px; }
  .meta-grid div { color: #333; }
  .meta-grid strong { font-weight: 600; }

  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
  .kpi { text-align: center; padding: 14px 8px; border: 1px solid #d8d8d8; border-radius: 4px; }
  .kpi .v { font-size: 18px; font-weight: 700; color: #1a1a1a; }
  .kpi .l { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

  h2 { text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; color: #555; margin: 22px 0 6px; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  table thead th { text-transform: uppercase; font-size: 9px; letter-spacing: 0.8px; color: #888; font-weight: 600; padding: 8px 10px; text-align: left; border-bottom: 1px solid #d8d8d8; }
  table thead th.num { text-align: right; }
  table tbody td { padding: 6px 10px; border-bottom: 1px solid #eee; }
  table tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table tbody td.mono { font-family: 'SF Mono', Menlo, Consolas, monospace; color: #555; }
  table tbody td.muted { color: #999; text-align: center; padding: 12px; font-style: italic; }
  table tfoot td { padding: 8px 10px; border-top: 2px solid #1a1a1a; font-weight: 700; }
  table tfoot td.num { text-align: right; font-variant-numeric: tabular-nums; }

  .section-box { border: 1px solid #d8d8d8; border-radius: 4px; margin-top: 6px; padding: 0; }
  .section-box table { border-collapse: collapse; }
  .section-box table tbody td { padding: 8px 14px; border-bottom: 1px solid #eee; }
  .section-box table tbody tr:last-child td { border-bottom: none; }
  .section-box .strong td { font-weight: 700; background: #f7f7f7; border-top: 1px solid #d8d8d8; }
  .section-box .strong-emph td { font-weight: 700; background: #f4f1e8; }
  .section-box .neg { color: #c0392b; }
  .section-box .pos { color: #1a7d3a; }

  .pill { display: inline-block; padding: 2px 8px; border: 1px solid; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }

  footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 9px; }

  @media print {
    .no-print { display: none; }
    .sales-detail { page-break-before: auto; }
  }
</style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <h1>${salonName}</h1>
      <div class="subtitle">Rapport de journée</div>
    </div>
    <div class="ref">
      <strong>SH${r.session.sessionNumber.padStart(5, "0")}</strong><br>
      <span style="color:#666;">${fmtDateTime(closedAt)}</span>
    </div>
  </div>

  <!-- META -->
  <div class="meta-box">
    <div class="meta-grid">
      <div><strong>Caisse :</strong> Caisse ${r.session.openedBy}</div>
      <div><strong>Entrepôt :</strong> ${r.provider?.city ?? r.provider?.salonName ?? "—"}</div>
      <div><strong>Caissier :</strong> ${r.session.openedBy}</div>
      <div><strong>Clôturé par :</strong> ${r.session.openedBy}</div>
      <div><strong>Ouverture :</strong> ${fmtDateTime(r.session.openedAt)}</div>
      <div><strong>Fermeture :</strong> ${fmtDateTime(closedAt)}</div>
      <div><strong>Durée :</strong> ${duration}</div>
      <div></div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpis">
    <div class="kpi"><div class="v">${fmtInt(r.totals.salesCount)}</div><div class="l">Ventes</div></div>
    <div class="kpi"><div class="v">${fmtNum(r.totals.grossTotal)}</div><div class="l">CA TTC</div></div>
    <div class="kpi"><div class="v">${fmtInt(r.totals.articlesCount)}</div><div class="l">Articles</div></div>
    <div class="kpi"><div class="v">${fmtNum(r.totals.averageBasket)}</div><div class="l">Panier moyen</div></div>
  </div>

  <!-- PAIEMENTS -->
  <h2>Paiements</h2>
  <table>
    <thead>
      <tr>
        <th>Mode</th>
        <th class="num">Nombre</th>
        <th class="num">Montant</th>
      </tr>
    </thead>
    <tbody>${paymentsRows}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${fmtInt(r.totals.salesCount)}</td>
        <td class="num">${fmtNum(paymentsTotalAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- TVA -->
  <h2>TVA</h2>
  <table>
    <thead>
      <tr>
        <th>Taux</th>
        <th class="num">Montant</th>
      </tr>
    </thead>
    <tbody>${taxRows}</tbody>
    <tfoot>
      <tr>
        <td>Total TVA</td>
        <td class="num">${fmtNum(taxTotal)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- RAPPROCHEMENT -->
  <h2>Rapprochement espèces</h2>
  <div class="section-box">
    <table>
      <tbody>
        <tr><td>Fond de caisse (ouverture)</td><td class="num">${fmtNum(openingFloat)}</td></tr>
        <tr><td>Encaissements espèces</td><td class="num">${fmtNum(cashFromCash)}</td></tr>
        <tr><td>Mouvements caisse (dépenses)</td><td class="num neg">−${fmtNum(expensesTotal)}</td></tr>
        <tr class="strong"><td>ESPÈCES ATTENDUES</td><td class="num">${expectedCash !== null ? fmtNum(expectedCash) : fmtNum(openingFloat + cashFromCash - expensesTotal)}</td></tr>
        ${closingCount !== null ? `<tr class="strong"><td>ESPÈCES COMPTÉES</td><td class="num">${fmtNum(closingCount)}</td></tr>` : ""}
        ${variance !== null ? `<tr class="strong-emph"><td>ÉCART</td><td class="num ${variance < 0 ? "neg" : "pos"}">${variance > 0 ? "+" : ""}${fmtNum(variance)}</td></tr>` : ""}
      </tbody>
    </table>
  </div>

  <!-- DÉPENSES (mouvements) -->
  ${
    r.expenses.length > 0
      ? `
  <h2>Détail des dépenses</h2>
  <table>
    <thead>
      <tr>
        <th>Catégorie</th>
        <th>Motif</th>
        <th class="num">Montant</th>
      </tr>
    </thead>
    <tbody>
      ${r.expenses.map((e) => `<tr><td>${e.category}</td><td>${e.reason || "—"}</td><td class="num">${fmtNum(e.amount)}</td></tr>`).join("")}
    </tbody>
  </table>`
      : ""
  }

  <!-- VENTES PAR EMPLOYÉ -->
  <h2>Ventes par employé</h2>
  <table>
    <thead>
      <tr>
        <th>Employé</th>
        <th class="num">Ventes</th>
        <th class="num">Articles</th>
        <th class="num">CA TTC</th>
      </tr>
    </thead>
    <tbody>${employeeRows}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num">${fmtInt(r.totals.salesCount)}</td>
        <td class="num">${fmtInt(r.totals.articlesCount)}</td>
        <td class="num">${fmtNum(r.totals.grossTotal)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- FIDÉLITÉ -->
  ${loyaltyHtml}

  <!-- DÉTAIL DES VENTES -->
  <div class="sales-detail">
    <h2>Détail des ventes</h2>
    ${
      r.sales.length === 0
        ? `<p class="muted" style="text-align:center;color:#999;padding:20px;">Aucune vente sur cette journée.</p>`
        : `<table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>N°</th>
                <th>Client</th>
                <th>Employé</th>
                <th>Paiement</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>${salesRows}</tbody>
          </table>`
    }
  </div>

  <footer>
    Généré le ${new Date().toLocaleString("fr-FR")} — Salonista POS
  </footer>

  <script>
    if (window.location && window.location.protocol !== 'mailto:') {
      setTimeout(function(){ window.print(); }, 300);
    }
  </script>
</body>
</html>`;
}
