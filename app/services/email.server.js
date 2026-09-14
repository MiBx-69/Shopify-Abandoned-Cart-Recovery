import nodemailer from "nodemailer";

/**
 * IMPORTANT: Shopify's native "abandoned checkout" recovery email
 * (Settings → Checkout → Abandoned checkout emails) is fully automatic —
 * merchants can turn it on/off and lightly edit the template, but no app
 * can trigger it programmatically per-checkout with custom timing or
 * content. If you want that native email as well, just enable it in the
 * Shopify admin — it will run independently of this app.
 *
 * This service sends a *separate*, custom email via plain SMTP so you can
 * control timing/content/branding yourself. Point it at whatever mailbox
 * or transactional email provider you like (Gmail SMTP, SES, Postmark,
 * SendGrid SMTP relay, your own mail server, etc) via the SMTP_* env vars.
 */

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendRecoveryEmail({ to, firstName, shopName, checkoutUrl, lineItems }) {
  if (!to) {
    throw new Error("Cannot send email: customer has no email on file.");
  }
  if (!process.env.SMTP_HOST) {
    throw new Error("SMTP_HOST is not set. Add SMTP_* vars to your .env before sending email.");
  }

  const name = firstName || "there";
  const itemsHtml = (lineItems || [])
    .map((item) => `<li>${item.quantity} × ${item.title}</li>`)
    .join("");

  const html = `
    <p>Hi ${name},</p>
    <p>You left some items in your cart at ${shopName}. Your cart is still waiting for you:</p>
    <ul>${itemsHtml}</ul>
    <p><a href="${checkoutUrl}">Click here to complete your order</a></p>
    <p>Thanks,<br/>${shopName}</p>
  `;

  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM || `"${shopName}" <no-reply@${shopName}.com>`,
    to,
    subject: `You left something in your cart at ${shopName}`,
    html,
  });

  return info;
}
