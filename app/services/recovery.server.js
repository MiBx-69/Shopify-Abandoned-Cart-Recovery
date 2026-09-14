import prisma from "../db.server";
import { sendSms, buildRecoverySmsMessage } from "./alphaSms.server";
import { sendRecoveryEmail } from "./email.server";

// How long to wait after a checkout is last updated before we consider it
// "abandoned enough" to text, and then to email. Tune to taste.
const SMS_DELAY_MINUTES = Number(process.env.SMS_DELAY_MINUTES || 30);
const EMAIL_DELAY_MINUTES = Number(process.env.EMAIL_DELAY_MINUTES || 24 * 60);
// After this long with no conversion, stop bothering — call team can still
// see it, but the automation stops nudging the customer.
const MAX_AGE_HOURS = Number(process.env.MAX_ABANDONED_AGE_HOURS || 72);

/**
 * Called from the checkouts webhook route on every CHECKOUTS_CREATE /
 * CHECKOUTS_UPDATE event. Upserts a row keyed on (shop, checkoutId) so we
 * always have the latest snapshot of the cart + contact info.
 */
export async function handleCheckoutWebhook(shop, payload) {
  // A checkout that already has an order attached isn't abandoned.
  if (payload.completed_at || payload.order_id) {
    return;
  }

  const email = payload.email || payload.customer?.email || null;
  const phone =
    payload.phone || payload.customer?.phone || payload.shipping_address?.phone || null;

  // Nothing to contact the customer with — still worth storing for
  // visibility, but outreach will just be skipped for this row.
  const data = {
    shop,
    checkoutId: String(payload.id),
    checkoutToken: payload.token || null,
    cartToken: payload.cart_token || null,
    customerId: payload.customer?.id ? String(payload.customer.id) : null,
    firstName: payload.customer?.first_name || payload.billing_address?.first_name || null,
    lastName: payload.customer?.last_name || payload.billing_address?.last_name || null,
    email,
    phone,
    totalPrice: payload.total_price || payload.subtotal_price || null,
    currency: payload.currency || null,
    abandonedUrl: payload.abandoned_checkout_url || null,
    lineItemsJson: JSON.stringify(
      (payload.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
      })),
    ),
  };

  await prisma.abandonedCheckout.upsert({
    where: { shop_checkoutId: { shop, checkoutId: String(payload.id) } },
    create: data,
    update: data,
  });
}

/**
 * Called from the orders webhook route on ORDERS_CREATE. If the order's
 * cart_token matches a checkout we were tracking, mark it recovered so the
 * automation and call team stop chasing it.
 */
export async function handleOrderCreated(shop, payload) {
  const cartToken = payload.cart_token;
  const checkoutId = payload.checkout_id ? String(payload.checkout_id) : null;

  if (!cartToken && !checkoutId) return;

  await prisma.abandonedCheckout.updateMany({
    where: {
      shop,
      OR: [
        cartToken ? { cartToken } : undefined,
        checkoutId ? { checkoutId } : undefined,
      ].filter(Boolean),
      status: { not: "recovered" },
    },
    data: { status: "recovered", recoveredAt: new Date() },
  });
}

/**
 * The outreach step. Call this on a schedule (cron / worker) — see
 * scripts/send-reminders.js. Not triggered directly by webhooks, since we
 * want a delay before nudging a customer.
 */
export async function runOutreachPass({ shopName } = {}) {
  const now = Date.now();
  const smsCutoff = new Date(now - SMS_DELAY_MINUTES * 60 * 1000);
  const emailCutoff = new Date(now - EMAIL_DELAY_MINUTES * 60 * 1000);
  const maxAgeCutoff = new Date(now - MAX_AGE_HOURS * 60 * 60 * 1000);

  const results = { sms: [], email: [] };

  // Step 1: SMS to anyone past the SMS delay, not yet texted, with a phone
  // number, not too old, and not converted/recovered.
  const smsTargets = await prisma.abandonedCheckout.findMany({
    where: {
      status: "pending",
      phone: { not: null },
      updatedAt: { lte: smsCutoff, gte: maxAgeCutoff },
      smsSentAt: null,
    },
  });

  for (const checkout of smsTargets) {
    try {
      const message = buildRecoverySmsMessage({
        shopName: shopName || checkout.shop,
        firstName: checkout.firstName,
        checkoutUrl: checkout.abandonedUrl,
      });
      await sendSms(checkout.phone, message);
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { status: "sms_sent", smsSentAt: new Date(), smsError: null },
      });
      results.sms.push({ id: checkout.id, ok: true });
    } catch (err) {
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { smsError: String(err.message || err) },
      });
      results.sms.push({ id: checkout.id, ok: false, error: String(err) });
    }
  }

  // Step 2: Email to anyone past the (longer) email delay, not yet
  // emailed, with an email address on file, not too old.
  const emailTargets = await prisma.abandonedCheckout.findMany({
    where: {
      status: { in: ["pending", "sms_sent"] },
      email: { not: null },
      updatedAt: { lte: emailCutoff, gte: maxAgeCutoff },
      emailSentAt: null,
    },
  });

  for (const checkout of emailTargets) {
    try {
      await sendRecoveryEmail({
        to: checkout.email,
        firstName: checkout.firstName,
        shopName: shopName || checkout.shop,
        checkoutUrl: checkout.abandonedUrl,
        lineItems: checkout.lineItemsJson ? JSON.parse(checkout.lineItemsJson) : [],
      });
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { status: "email_sent", emailSentAt: new Date(), emailError: null },
      });
      results.email.push({ id: checkout.id, ok: true });
    } catch (err) {
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { emailError: String(err.message || err) },
      });
      results.email.push({ id: checkout.id, ok: false, error: String(err) });
    }
  }

  return results;
}
