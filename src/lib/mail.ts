import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = process.env.SMTP_FROM || "Salonista <noreply@salonista.tn>";

function layout(content: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#FBF8F4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F4;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid rgba(201,169,110,0.2);">
        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid rgba(201,169,110,0.15);">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#1F1A1C;letter-spacing:-0.01em;">
            <i>salon</i>ista<span style="color:#D4A574;">.</span>
          </span>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px 40px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;text-align:center;border-top:1px solid rgba(201,169,110,0.15);">
          <p style="margin:0;font-size:11px;color:#2D0A0A;opacity:0.3;letter-spacing:0.1em;text-transform:uppercase;">
            &copy; ${new Date().getFullYear()} Salonista &mdash; Tunisie
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email verification ───

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2D0A0A;font-weight:normal;">
      Confirmez votre compte
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.5;">
      Bonjour ${name || ""},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.6;line-height:1.6;">
      Merci de vous &ecirc;tre inscrit(e) sur Salonista. Cliquez sur le bouton ci-dessous pour v&eacute;rifier votre adresse email.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#2D0A0A;padding:14px 32px;">
        <a href="${url}" style="color:#FFFFFF;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          V&eacute;rifier mon email
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#2D0A0A;opacity:0.3;line-height:1.5;">
      Ce lien expire dans 24 heures. Si vous n&rsquo;avez pas cr&eacute;&eacute; de compte, ignorez cet email.
    </p>
  `);

  await transporter.sendMail({
    from,
    to: email,
    subject: "Vérifiez votre email — Salonista",
    html,
  });
}

// ─── Password reset ───

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1F1A1C;font-weight:normal;">
      R&eacute;initialiser votre mot de passe
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#1F1A1C;opacity:0.5;">
      Bonjour ${name || ""},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#1F1A1C;opacity:0.6;line-height:1.6;">
      Vous avez demand&eacute; &agrave; r&eacute;initialiser votre mot de passe sur Salonista.
      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="background:#1F1A1C;padding:14px 32px;">
        <a href="${url}" style="color:#FFFFFF;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          Choisir un nouveau mot de passe
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:12px;color:#1F1A1C;opacity:0.3;line-height:1.5;">
      Ce lien expire dans 1 heure. Si vous n&rsquo;avez pas demand&eacute; cette r&eacute;initialisation, ignorez cet email.
    </p>
  `);

  await transporter.sendMail({
    from,
    to: email,
    subject: "Réinitialiser votre mot de passe — Salonista",
    html,
  });
}

// ─── Booking confirmation (for client) ───

export async function sendBookingConfirmationEmail(
  email: string,
  data: {
    clientName: string;
    offerTitle: string;
    salonName: string;
    date: string;
    price: string;
  }
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2D0A0A;font-weight:normal;">
      R&eacute;servation enregistr&eacute;e
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.5;">
      Bonjour ${data.clientName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.6;line-height:1.6;">
      Votre r&eacute;servation a bien &eacute;t&eacute; enregistr&eacute;e. Voici les d&eacute;tails :
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid rgba(201,169,110,0.15);">
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Service</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Salon</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.salonName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Date</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.date}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;">Montant</td>
        <td style="padding:12px 16px;font-size:18px;color:#C9A96E;text-align:right;font-family:Georgia,'Times New Roman',serif;">${data.price} TND</td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;color:#2D0A0A;opacity:0.4;line-height:1.5;">
      Votre QR code vous attend dans votre espace. Pr&eacute;sentez-le au salon
      le jour du rendez-vous : vous r&eacute;glerez votre soin sur place.
    </p>
  `);

  await transporter.sendMail({
    from,
    to: email,
    subject: `Réservation confirmée — ${data.offerTitle}`,
    html,
  });
}

// ─── QR code de la reservation (pour la cliente) ───
//
// Anciennement « paiement confirme ». Salonista n'encaisse pas : ce mail
// porte le QR du rendez-vous, et rappelle que le reglement se fait au salon.

export async function sendBookingQrEmail(
  email: string,
  data: {
    clientName: string;
    offerTitle: string;
    salonName: string;
    date: string;
    price: string;
    qrCode: string; // base64 data URL
    qrToken: string;
  }
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2D0A0A;font-weight:normal;">
      R&eacute;servation confirm&eacute;e
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.5;">
      Bonjour ${data.clientName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.6;line-height:1.6;">
      Votre rendez-vous est confirm&eacute;. Pr&eacute;sentez le QR code ci-dessous
      au salon le jour venu : vous r&eacute;glerez vos
      <strong style="color:#C9A96E;">${data.price} TND</strong> sur place.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
      <tr><td style="text-align:center;padding:20px;border:1px solid rgba(201,169,110,0.2);">
        <img src="cid:qrcode" width="200" height="200" alt="QR Code" style="display:block;" />
        <p style="margin:12px 0 0;font-size:12px;font-family:monospace;color:#2D0A0A;opacity:0.4;">${data.qrToken}</p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid rgba(201,169,110,0.15);">
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Service</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Salon</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.salonName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;">Date</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;">${data.date}</td>
      </tr>
    </table>
  `);

  // Convert base64 data URL to buffer for inline attachment
  const base64Data = data.qrCode.replace(/^data:image\/png;base64,/, "");

  await transporter.sendMail({
    from,
    to: email,
    subject: `Réservation confirmée — ${data.offerTitle}`,
    html,
    attachments: [
      {
        filename: "qrcode.png",
        content: Buffer.from(base64Data, "base64"),
        cid: "qrcode",
      },
    ],
  });
}

// ─── Booking status change (for client) ───

export async function sendBookingStatusEmail(
  email: string,
  data: {
    clientName: string;
    offerTitle: string;
    salonName: string;
    status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  }
) {
  const statusMap = {
    CONFIRMED: { title: "R&eacute;servation confirm&eacute;e", color: "#059669", message: "Le salon a confirm&eacute; votre r&eacute;servation." },
    CANCELLED: { title: "R&eacute;servation annul&eacute;e", color: "#DC2626", message: "Votre r&eacute;servation a &eacute;t&eacute; annul&eacute;e." },
    COMPLETED: { title: "Visite termin&eacute;e", color: "#059669", message: "Merci pour votre visite ! Nous esp&eacute;rons que vous avez appr&eacute;ci&eacute; le service." },
  };
  const s = statusMap[data.status];

  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${s.color};font-weight:normal;">
      ${s.title}
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.5;">
      Bonjour ${data.clientName},
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#2D0A0A;opacity:0.6;line-height:1.6;">
      ${s.message}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid rgba(201,169,110,0.15);">
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Service</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;">Salon</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;">${data.salonName}</td>
      </tr>
    </table>
  `);

  const subjectMap = {
    CONFIRMED: `Réservation confirmée — ${data.offerTitle}`,
    CANCELLED: `Réservation annulée — ${data.offerTitle}`,
    COMPLETED: `Merci pour votre visite — ${data.salonName}`,
  };

  await transporter.sendMail({
    from,
    to: email,
    subject: subjectMap[data.status],
    html,
  });
}

// ─── New booking notification (for provider) ───

export async function sendNewBookingToProvider(
  email: string,
  data: {
    salonName: string;
    clientName: string;
    offerTitle: string;
    date: string;
    price: string;
  }
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2D0A0A;font-weight:normal;">
      Nouvelle r&eacute;servation
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#2D0A0A;opacity:0.6;line-height:1.6;">
      Vous avez re&ccedil;u une nouvelle r&eacute;servation sur Salonista.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid rgba(201,169,110,0.15);">
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Client</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.clientName}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Service</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;border-bottom:1px solid rgba(201,169,110,0.1);">Date</td>
        <td style="padding:12px 16px;font-size:14px;color:#2D0A0A;text-align:right;border-bottom:1px solid rgba(201,169,110,0.1);">${data.date}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:12px;color:#2D0A0A;opacity:0.4;text-transform:uppercase;letter-spacing:0.1em;">Montant</td>
        <td style="padding:12px 16px;font-size:18px;color:#C9A96E;text-align:right;font-family:Georgia,'Times New Roman',serif;">${data.price} TND</td>
      </tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr><td style="background:#2D0A0A;padding:14px 32px;">
        <a href="${process.env.NEXTAUTH_URL}/prestataire/reservations" style="color:#FFFFFF;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;">
          Voir les r&eacute;servations
        </a>
      </td></tr>
    </table>
  `);

  await transporter.sendMail({
    from,
    to: email,
    subject: `Nouvelle réservation — ${data.offerTitle}`,
    html,
  });
}

// ---------- POS receipt ----------

export async function sendReceiptEmail(saleId: string, recipient: string): Promise<void> {
  const { prisma } = await import("./prisma");
  const { formatDT } = await import("./money");
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      payments: true,
      customer: { select: { firstName: true, lastName: true } },
      provider: {
        select: {
          salonName: true,
          address: true,
          city: true,
          phone: true,
          matriculeFiscal: true,
          receiptFooter: true,
        },
      },
    },
  });
  if (!sale) throw new Error("Sale not found");

  const lines = sale.items
    .map(
      (it) => `
    <tr>
      <td style="padding:8px 0;">${it.quantity}× ${escapeHtml(it.nameSnapshot)}</td>
      <td style="padding:8px 0;text-align:right;">${formatDT(String(it.lineTotal))}</td>
    </tr>`,
    )
    .join("");

  const payments = sale.payments
    .map(
      (p) => `
    <tr>
      <td style="padding:4px 0;font-size:12px;color:#4A4244;">${p.method}</td>
      <td style="padding:4px 0;text-align:right;font-size:12px;">${formatDT(String(p.amount))}</td>
    </tr>`,
    )
    .join("");

  const customerName = sale.customer
    ? [sale.customer.firstName, sale.customer.lastName].filter(Boolean).join(" ")
    : "Client";

  const html = layout(`
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#1F1A1C;margin:0 0 6px;">
      Reçu N° ${sale.receiptNumber}
    </h1>
    <p style="margin:0 0 24px;font-size:13px;color:#4A4244;">
      ${new Date(sale.closedAt ?? sale.createdAt).toLocaleString("fr-FR")} — ${escapeHtml(sale.provider?.salonName ?? "")}
    </p>
    <p style="margin:0 0 24px;font-size:14px;">${escapeHtml(customerName)}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E8E2D7;border-bottom:1px solid #E8E2D7;margin-bottom:16px;">
      ${lines}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
      <tr>
        <td>Sous-total</td>
        <td style="text-align:right;">${formatDT(String(sale.subtotal))}</td>
      </tr>
      ${
        Number(sale.discountAmount) > 0
          ? `<tr><td>Remise</td><td style="text-align:right;">-${formatDT(String(sale.discountAmount))}</td></tr>`
          : ""
      }
      <tr>
        <td>TVA</td>
        <td style="text-align:right;">${formatDT(String(sale.taxTotal))}</td>
      </tr>
      ${
        Number(sale.tipTotal) > 0
          ? `<tr><td>Pourboire</td><td style="text-align:right;">${formatDT(String(sale.tipTotal))}</td></tr>`
          : ""
      }
      <tr>
        <td style="padding-top:12px;font-weight:bold;">TOTAL</td>
        <td style="padding-top:12px;text-align:right;font-weight:bold;">${formatDT(String(sale.total))}</td>
      </tr>
    </table>
    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:0.18em;color:#4A4244;margin:24px 0 8px;">
      Paiements
    </h3>
    <table width="100%" cellpadding="0" cellspacing="0">${payments}</table>
    ${
      sale.provider?.matriculeFiscal
        ? `<p style="margin-top:24px;font-size:11px;color:#4A4244;">Matricule fiscal: ${escapeHtml(sale.provider.matriculeFiscal)}</p>`
        : ""
    }
    ${
      sale.provider?.receiptFooter
        ? `<p style="margin-top:16px;font-size:13px;color:#1F1A1C;font-style:italic;">${escapeHtml(sale.provider.receiptFooter)}</p>`
        : ""
    }
  `);

  await transporter.sendMail({
    from,
    to: recipient,
    subject: `Votre reçu Salonista — ${sale.provider?.salonName ?? ""}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Loyalty points earned notification ───

export async function sendLoyaltyEarnedEmail(
  to: string,
  customerName: string,
  salonName: string,
  earned: number,
  newBalance: number,
  bonusBreakdown?: { welcome?: number; birthday?: number },
) {
  const greeting = customerName.trim() ? `Bonjour ${escapeHtml(customerName)},` : "Bonjour,";
  const bonusBits: string[] = [];
  if (bonusBreakdown?.welcome && bonusBreakdown.welcome > 0) {
    bonusBits.push(`<li><strong>+${bonusBreakdown.welcome} pts</strong> — bonus de bienvenue 🎁</li>`);
  }
  if (bonusBreakdown?.birthday && bonusBreakdown.birthday > 0) {
    bonusBits.push(`<li><strong>+${bonusBreakdown.birthday} pts</strong> — bonus d'anniversaire 🎂</li>`);
  }
  const bonusList = bonusBits.length
    ? `<ul style="margin:16px 0;padding-left:20px;color:#2D0A0A;font-size:13px;">${bonusBits.join("")}</ul>`
    : "";

  const html = layout(`
    <h2 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#2D0A0A;font-weight:normal;">
      Merci pour votre visite ✦
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#2D0A0A;opacity:0.6;">
      ${greeting}
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#2D0A0A;opacity:0.7;line-height:1.6;">
      Vous venez de gagner <strong>${earned} points</strong> de fidélité chez <strong>${escapeHtml(salonName)}</strong>.
    </p>
    ${bonusList}
    <div style="background:#FBF8F4;border:1px solid rgba(212,165,116,0.3);padding:20px;text-align:center;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;color:#2D0A0A;opacity:0.5;text-transform:uppercase;letter-spacing:0.2em;">
        Votre solde
      </p>
      <p style="margin:0;font-family:Georgia,serif;font-size:32px;color:#D4A574;">
        ★ ${newBalance} pts
      </p>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#2D0A0A;opacity:0.5;line-height:1.6;">
      Présentez-vous au salon pour utiliser vos points lors d'une prochaine visite.
    </p>
  `);

  await transporter.sendMail({
    from,
    to,
    subject: `+${earned} pts de fidélité — ${salonName}`,
    html,
  });
}

// ─── Cash drawer report ───

export async function sendCashDrawerReport(
  to: string,
  salonName: string,
  sessionNumber: string,
  reportHtml: string,
) {
  await transporter.sendMail({
    from,
    to,
    subject: `Rapport de caisse #${sessionNumber} — ${salonName}`,
    html: reportHtml,
    attachments: [
      {
        filename: `rapport-caisse-${sessionNumber}.html`,
        content: reportHtml,
        contentType: "text/html",
      },
    ],
  });
}
