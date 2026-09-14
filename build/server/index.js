var _a;
import { jsx, jsxs } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable, json, redirect } from "@remix-run/node";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useFetcher, Form, Link, useRouteError } from "@remix-run/react";
import * as isbotModule from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import "@shopify/shopify-app-remix/adapters/node";
import { shopifyApp, DeliveryMethod, AppDistribution, ApiVersion, boundary } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import { useState } from "react";
import { IndexTable, Text, Badge, Button, Page, Layout, Card, Modal, BlockStack, Select, TextField, AppProvider, FormLayout, InlineStack, Banner } from "@shopify/polaris";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
const ABORT_DELAY = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, remixContext, loadContext) {
  let prohibitOutOfOrderStreaming = isBotRequest(request.headers.get("user-agent")) || remixContext.isSpaMode;
  return prohibitOutOfOrderStreaming ? handleBotRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  ) : handleBrowserRequest(
    request,
    responseStatusCode,
    responseHeaders,
    remixContext
  );
}
function isBotRequest(userAgent) {
  if (!userAgent) {
    return false;
  }
  if ("isbot" in isbotModule && typeof isbotModule.isbot === "function") {
    return isbotModule.isbot(userAgent);
  }
  if ("default" in isbotModule && typeof isbotModule.default === "function") {
    return isbotModule.default(userAgent);
  }
  return false;
}
function handleBotRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
function handleBrowserRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url,
          abortDelay: ABORT_DELAY
        }
      ),
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest
}, Symbol.toStringTag, { value: "Module" }));
function App$1() {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1
}, Symbol.toStringTag, { value: "Module" }));
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const ALPHA_SMS_BASE_URL = process.env.ALPHA_SMS_BASE_URL || "https://api.sms.net.bd/sendsms";
const ALPHA_SMS_API_KEY = process.env.ALPHA_SMS_API_KEY;
const ALPHA_SMS_SENDER_ID = process.env.ALPHA_SMS_SENDER_ID;
async function sendSms(to, message) {
  if (!ALPHA_SMS_API_KEY || ALPHA_SMS_API_KEY === "your_alpha_sms_api_key" || ALPHA_SMS_API_KEY === "test") {
    console.log(`[SIMULATED SMS] To: ${to} | Message: ${message}`);
    return { success: true, simulated: true, raw: { status: "simulated", to, message } };
  }
  if (!to) {
    throw new Error("Cannot send SMS: customer has no phone number on file.");
  }
  const params = new URLSearchParams({
    api_key: ALPHA_SMS_API_KEY,
    msg: message,
    to
  });
  if (ALPHA_SMS_SENDER_ID) {
    params.set("sender_id", ALPHA_SMS_SENDER_ID);
  }
  const response = await fetch(`${ALPHA_SMS_BASE_URL}?${params.toString()}`, {
    method: "GET"
  });
  const text = await response.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = text;
  }
  const success = response.ok && ((raw == null ? void 0 : raw.error) === 0 || (raw == null ? void 0 : raw.status) === "success" || raw === "OK");
  if (!success) {
    throw new Error(
      `Alpha SMS send failed: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`
    );
  }
  return { success, raw };
}
function buildRecoverySmsMessage({ shopName, firstName, checkoutUrl }) {
  const name = firstName ? `${firstName}, ` : "";
  return `${name}you left something in your cart at ${shopName}! Complete your order here: ${checkoutUrl}`;
}
let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return transporter;
}
async function sendRecoveryEmail({ to, firstName, shopName, checkoutUrl, lineItems }) {
  if (!to) {
    throw new Error("Cannot send email: customer has no email on file.");
  }
  if (!process.env.SMTP_HOST) {
    console.log(`[SIMULATED EMAIL] To: ${to} | Subject: You left something in your cart at ${shopName} | Recovery URL: ${checkoutUrl}`);
    return { messageId: "simulated-" + Date.now(), response: "250 Simulated OK" };
  }
  const name = firstName || "there";
  const itemsHtml = (lineItems || []).map((item) => `<li>${item.quantity} × ${item.title}</li>`).join("");
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
    html
  });
  return info;
}
const SMS_DELAY_MINUTES = Number(process.env.SMS_DELAY_MINUTES || 30);
const EMAIL_DELAY_MINUTES = Number(process.env.EMAIL_DELAY_MINUTES || 24 * 60);
const MAX_AGE_HOURS = Number(process.env.MAX_ABANDONED_AGE_HOURS || 72);
async function handleCheckoutWebhook(shop, payload) {
  var _a2, _b, _c, _d, _e, _f, _g, _h;
  if (payload.completed_at || payload.order_id) {
    return;
  }
  const email = payload.email || ((_a2 = payload.customer) == null ? void 0 : _a2.email) || null;
  const phone = payload.phone || ((_b = payload.customer) == null ? void 0 : _b.phone) || ((_c = payload.shipping_address) == null ? void 0 : _c.phone) || null;
  const data = {
    shop,
    checkoutId: String(payload.id),
    checkoutToken: payload.token || null,
    cartToken: payload.cart_token || null,
    customerId: ((_d = payload.customer) == null ? void 0 : _d.id) ? String(payload.customer.id) : null,
    firstName: ((_e = payload.customer) == null ? void 0 : _e.first_name) || ((_f = payload.billing_address) == null ? void 0 : _f.first_name) || null,
    lastName: ((_g = payload.customer) == null ? void 0 : _g.last_name) || ((_h = payload.billing_address) == null ? void 0 : _h.last_name) || null,
    email,
    phone,
    totalPrice: payload.total_price || payload.subtotal_price || null,
    currency: payload.currency || null,
    abandonedUrl: payload.abandoned_checkout_url || null,
    lineItemsJson: JSON.stringify(
      (payload.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price
      }))
    )
  };
  await prisma.abandonedCheckout.upsert({
    where: { shop_checkoutId: { shop, checkoutId: String(payload.id) } },
    create: data,
    update: data
  });
}
async function handleOrderCreated(shop, payload) {
  const cartToken = payload.cart_token;
  const checkoutId = payload.checkout_id ? String(payload.checkout_id) : null;
  if (!cartToken && !checkoutId) return;
  await prisma.abandonedCheckout.updateMany({
    where: {
      shop,
      OR: [
        cartToken ? { cartToken } : void 0,
        checkoutId ? { checkoutId } : void 0
      ].filter(Boolean),
      status: { not: "recovered" }
    },
    data: { status: "recovered", recoveredAt: /* @__PURE__ */ new Date() }
  });
}
async function runOutreachPass({ shopName } = {}) {
  const now = Date.now();
  const smsCutoff = new Date(now - SMS_DELAY_MINUTES * 60 * 1e3);
  const emailCutoff = new Date(now - EMAIL_DELAY_MINUTES * 60 * 1e3);
  const maxAgeCutoff = new Date(now - MAX_AGE_HOURS * 60 * 60 * 1e3);
  const results = { sms: [], email: [] };
  const smsTargets = await prisma.abandonedCheckout.findMany({
    where: {
      status: "pending",
      phone: { not: null },
      updatedAt: { lte: smsCutoff, gte: maxAgeCutoff },
      smsSentAt: null
    }
  });
  for (const checkout of smsTargets) {
    try {
      const message = buildRecoverySmsMessage({
        shopName: shopName || checkout.shop,
        firstName: checkout.firstName,
        checkoutUrl: checkout.abandonedUrl
      });
      await sendSms(checkout.phone, message);
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { status: "sms_sent", smsSentAt: /* @__PURE__ */ new Date(), smsError: null }
      });
      results.sms.push({ id: checkout.id, ok: true });
    } catch (err) {
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { smsError: String(err.message || err) }
      });
      results.sms.push({ id: checkout.id, ok: false, error: String(err) });
    }
  }
  const emailTargets = await prisma.abandonedCheckout.findMany({
    where: {
      status: { in: ["pending", "sms_sent"] },
      email: { not: null },
      updatedAt: { lte: emailCutoff, gte: maxAgeCutoff },
      emailSentAt: null
    }
  });
  for (const checkout of emailTargets) {
    try {
      await sendRecoveryEmail({
        to: checkout.email,
        firstName: checkout.firstName,
        shopName: shopName || checkout.shop,
        checkoutUrl: checkout.abandonedUrl,
        lineItems: checkout.lineItemsJson ? JSON.parse(checkout.lineItemsJson) : []
      });
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { status: "email_sent", emailSentAt: /* @__PURE__ */ new Date(), emailError: null }
      });
      results.email.push({ id: checkout.id, ok: true });
    } catch (err) {
      await prisma.abandonedCheckout.update({
        where: { id: checkout.id },
        data: { emailError: String(err.message || err) }
      });
      results.email.push({ id: checkout.id, ok: false, error: String(err) });
    }
  }
  return results;
}
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July24,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  webhooks: {
    // Fired whenever a checkout is created or changes (customer typed an
    // email, added a phone number, updated the cart, etc). This is the core
    // signal we use to know a checkout exists and might be abandoned.
    // NOTE: requires the `read_checkouts` scope, and checkout webhooks are
    // only delivered for shops where Shopify considers checkouts trackable
    // (all standard Shopify Checkout on non-B2B storefronts).
    CHECKOUTS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/checkouts"
    },
    CHECKOUTS_UPDATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/checkouts"
    },
    // Lets us mark a checkout "recovered" the moment it turns into a real
    // order, so we stop texting/emailing/calling that customer.
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders"
    },
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/app/uninstalled"
    }
  },
  hooks: {
    afterAuth: async ({ session }) => {
      shopify.registerWebhooks({ session });
    }
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true
  }
});
ApiVersion.July24;
shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const action$5 = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5
}, Symbol.toStringTag, { value: "Module" }));
const action$4 = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  try {
    await handleCheckoutWebhook(shop, payload);
  } catch (err) {
    console.error("Failed to process checkout webhook", err);
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  try {
    await handleOrderCreated(shop, payload);
  } catch (err) {
    console.error("Failed to process order webhook", err);
  }
  return new Response();
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$5 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const checkouts = await prisma.abandonedCheckout.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  return json({ checkouts });
};
const action$2 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id");
  const callOutcome = formData.get("callOutcome");
  const callNotes = formData.get("callNotes");
  await prisma.abandonedCheckout.update({
    where: { id },
    data: {
      status: "called",
      calledAt: /* @__PURE__ */ new Date(),
      callOutcome: callOutcome || null,
      callNotes: callNotes || null
    }
  });
  return json({ ok: true });
};
const STATUS_TONE$1 = {
  pending: "attention",
  sms_sent: "info",
  email_sent: "info",
  called: "warning",
  recovered: "success",
  lost: "critical"
};
function Index$1() {
  const { checkouts } = useLoaderData();
  const fetcher = useFetcher();
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");
  const submitCall = () => {
    fetcher.submit(
      { id: activeCheckout.id, callOutcome: outcome, callNotes: notes },
      { method: "post" }
    );
    setActiveCheckout(null);
    setNotes("");
  };
  const rows = checkouts.map((c, index) => /* @__PURE__ */ jsxs(IndexTable.Row, { id: c.id, position: index, children: [
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Text, { as: "span", fontWeight: "semibold", children: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown" }) }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: c.email || "—" }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: c.phone || "—" }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: c.totalPrice ? `${c.totalPrice} ${c.currency || ""}` : "—" }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONE$1[c.status] || "info", children: c.status }) }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: new Date(c.updatedAt).toLocaleString() }),
    /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => setActiveCheckout(c), children: "Log call" }) })
  ] }, c.id));
  return /* @__PURE__ */ jsxs(Page, { title: "Abandoned Checkout Recovery", children: [
    /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { padding: "0", children: /* @__PURE__ */ jsx(
      IndexTable,
      {
        itemCount: checkouts.length,
        headings: [
          { title: "Customer" },
          { title: "Email" },
          { title: "Phone" },
          { title: "Cart total" },
          { title: "Status" },
          { title: "Last activity" },
          { title: "Call team" }
        ],
        selectable: false,
        children: rows
      }
    ) }) }) }),
    activeCheckout && /* @__PURE__ */ jsx(
      Modal,
      {
        open: true,
        onClose: () => setActiveCheckout(null),
        title: `Log call — ${activeCheckout.firstName || activeCheckout.email || "customer"}`,
        primaryAction: { content: "Save", onAction: submitCall },
        secondaryActions: [{ content: "Cancel", onAction: () => setActiveCheckout(null) }],
        children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(
            Select,
            {
              label: "Outcome",
              options: [
                { label: "No answer", value: "no_answer" },
                { label: "Not interested", value: "not_interested" },
                { label: "Will reorder", value: "will_reorder" },
                { label: "Recovered on call", value: "recovered" }
              ],
              value: outcome,
              onChange: setOutcome
            }
          ),
          /* @__PURE__ */ jsx(
            TextField,
            {
              label: "Notes",
              value: notes,
              onChange: setNotes,
              multiline: 3,
              autoComplete: "off"
            }
          )
        ] }) })
      }
    )
  ] });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: Index$1,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const polarisStyles = "/assets/styles-BeiPL2RV.css";
const links$2 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$4 = async ({ request }) => {
  const errors = login(request);
  return json({ errors });
};
const action$1 = async ({ request }) => {
  const errors = await login(request);
  return json({ errors });
};
function AuthLogin() {
  const { errors } = useLoaderData();
  const [shop, setShop] = useState("");
  return /* @__PURE__ */ jsx(AppProvider, { isEmbeddedApp: false, children: /* @__PURE__ */ jsx(Page, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Log in to Abandoned Checkout Recovery" }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        type: "text",
        name: "shop",
        label: "Shop domain",
        helpText: "e.g. my-shop-domain.myshopify.com",
        value: shop,
        onChange: setShop,
        autoComplete: "on",
        error: errors == null ? void 0 : errors.shop
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, variant: "primary", children: "Log in" })
  ] }) }) }) }) });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: AuthLogin,
  links: links$2,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const loader$3 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async () => {
  return redirect("/test");
};
function Index() {
  return null;
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Index,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const links$1 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$1 = async () => {
  const checkouts = await prisma.abandonedCheckout.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  const counts = {
    total: checkouts.length,
    pending: checkouts.filter((c) => c.status === "pending").length,
    contacted: checkouts.filter((c) => ["sms_sent", "email_sent"].includes(c.status)).length,
    called: checkouts.filter((c) => c.status === "called").length,
    recovered: checkouts.filter((c) => c.status === "recovered").length
  };
  return json({ checkouts, counts });
};
const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "log_call") {
    const id = formData.get("id");
    const callOutcome = formData.get("callOutcome");
    const callNotes = formData.get("callNotes");
    await prisma.abandonedCheckout.update({
      where: { id },
      data: {
        status: "called",
        calledAt: /* @__PURE__ */ new Date(),
        callOutcome: callOutcome || null,
        callNotes: callNotes || null
      }
    });
    return json({ success: true, message: "Call logged successfully" });
  }
  if (intent === "run_outreach") {
    const results = await runOutreachPass({ shopName: process.env.SHOP_DISPLAY_NAME || "Our Store" });
    return json({
      success: true,
      message: `Outreach pass completed! SMS sent: ${results.sms.length}, Email sent: ${results.email.length}`
    });
  }
  if (intent === "create_sample") {
    const num = Math.floor(1e3 + Math.random() * 9e3);
    const mockPayload = {
      id: `chk_${num}`,
      token: `tok_${num}`,
      cart_token: `cart_${num}`,
      total_price: `${(Math.random() * 2e3 + 500).toFixed(2)}`,
      currency: "BDT",
      abandoned_checkout_url: `https://example.com/checkout/recover/${num}`,
      customer: {
        id: `cust_${num}`,
        first_name: ["Tariq", "Salma", "Arif", "Nusrat", "Kamal"][Math.floor(Math.random() * 5)],
        last_name: ["Hossain", "Chowdhury", "Islam", "Akter", "Ahmed"][Math.floor(Math.random() * 5)],
        email: `customer${num}@example.com`,
        phone: `+880171${Math.floor(1e6 + Math.random() * 9e6)}`
      },
      line_items: [
        { title: "Cotton Casual Shirt", quantity: 1, price: "1200.00" },
        { title: "Canvas Backpack", quantity: 1, price: "1500.00" }
      ]
    };
    await handleCheckoutWebhook("test-store.myshopify.com", mockPayload);
    return json({ success: true, message: `Created mock abandoned checkout #${num}` });
  }
  if (intent === "mark_recovered") {
    const id = formData.get("id");
    const checkout = await prisma.abandonedCheckout.findUnique({ where: { id } });
    if (checkout) {
      await handleOrderCreated(checkout.shop, {
        checkout_id: checkout.checkoutId,
        cart_token: checkout.cartToken
      });
    }
    return json({ success: true, message: "Marked checkout as recovered" });
  }
  return json({ ok: true });
};
const STATUS_TONE = {
  pending: "attention",
  sms_sent: "info",
  email_sent: "info",
  called: "warning",
  recovered: "success",
  lost: "critical"
};
function TestDashboard() {
  var _a2;
  const { checkouts, counts } = useLoaderData();
  const fetcher = useFetcher();
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");
  const submitCall = () => {
    fetcher.submit(
      { intent: "log_call", id: activeCheckout.id, callOutcome: outcome, callNotes: notes },
      { method: "post" }
    );
    setActiveCheckout(null);
    setNotes("");
  };
  const rows = checkouts.map((c, index) => {
    const rawPhone = (c.phone || "").replace(/[^0-9+]/g, "");
    const waPhone = rawPhone.replace("+", "");
    return /* @__PURE__ */ jsxs(IndexTable.Row, { id: c.id, position: index, children: [
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Text, { as: "span", fontWeight: "semibold", children: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown" }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "050", children: [
        c.phone ? /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
          /* @__PURE__ */ jsxs("a", { href: `tel:${rawPhone}`, style: { color: "#2c6ecb", textDecoration: "none", fontWeight: "bold" }, children: [
            "📞 ",
            c.phone
          ] }),
          /* @__PURE__ */ jsx(
            "a",
            {
              href: `https://wa.me/${waPhone}`,
              target: "_blank",
              rel: "noreferrer",
              style: { color: "#25D366", textDecoration: "none", fontSize: "12px" },
              children: "💬 WhatsApp"
            }
          )
        ] }) : /* @__PURE__ */ jsx(Text, { as: "span", tone: "subdued", children: "—" }),
        c.email && /* @__PURE__ */ jsxs("a", { href: `mailto:${c.email}`, style: { color: "#5c5f62", fontSize: "12px" }, children: [
          "✉️ ",
          c.email
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Text, { as: "span", fontWeight: "bold", children: c.totalPrice ? `${c.totalPrice} ${c.currency || ""}` : "—" }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: STATUS_TONE[c.status] || "info", children: c.status }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: c.callOutcome ? /* @__PURE__ */ jsxs(BlockStack, { gap: "050", children: [
        /* @__PURE__ */ jsxs(Text, { as: "span", variant: "bodySm", fontWeight: "semibold", children: [
          "Outcome: ",
          c.callOutcome.replace("_", " ")
        ] }),
        c.callNotes && /* @__PURE__ */ jsxs(Text, { as: "span", variant: "bodySm", tone: "subdued", children: [
          '"',
          c.callNotes,
          '"'
        ] })
      ] }) : /* @__PURE__ */ jsx(Text, { as: "span", tone: "subdued", children: "Not called yet" }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Button, { size: "slim", onClick: () => setActiveCheckout(c), children: "📞 Log Call" }),
        c.status !== "recovered" && /* @__PURE__ */ jsx(
          Button,
          {
            size: "slim",
            tone: "success",
            onClick: () => fetcher.submit({ intent: "mark_recovered", id: c.id }, { method: "post" }),
            children: "Mark Recovered"
          }
        )
      ] }) })
    ] }, c.id);
  });
  return /* @__PURE__ */ jsx(AppProvider, { isEmbeddedApp: false, children: /* @__PURE__ */ jsxs(
    Page,
    {
      title: "Abandoned Checkout Recovery — Local Test Dashboard",
      subtitle: "Test abandoned cart ingestion, SMS/Email recovery outreach, and telecalling workflow",
      primaryAction: {
        content: "⚡ Run Outreach Pass Now",
        onAction: () => fetcher.submit({ intent: "run_outreach" }, { method: "post" }),
        loading: fetcher.state === "submitting"
      },
      secondaryActions: [
        {
          content: "➕ Add Sample Checkout",
          onAction: () => fetcher.submit({ intent: "create_sample" }, { method: "post" })
        }
      ],
      children: [
        /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          ((_a2 = fetcher.data) == null ? void 0 : _a2.message) && /* @__PURE__ */ jsx(Banner, { tone: "success", onDismiss: () => {
          }, children: fetcher.data.message }),
          /* @__PURE__ */ jsxs(Layout, { children: [
            /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(InlineStack, { gap: "400", align: "space-between", children: [
              /* @__PURE__ */ jsxs(Card, { children: [
                /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "Total Captured" }),
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: counts.total })
              ] }),
              /* @__PURE__ */ jsxs(Card, { children: [
                /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "Pending Recovery" }),
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: counts.pending })
              ] }),
              /* @__PURE__ */ jsxs(Card, { children: [
                /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "SMS/Email Sent" }),
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: counts.contacted })
              ] }),
              /* @__PURE__ */ jsxs(Card, { children: [
                /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "Calls Logged" }),
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: counts.called })
              ] }),
              /* @__PURE__ */ jsxs(Card, { children: [
                /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "Recovered" }),
                /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: counts.recovered })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { padding: "0", children: /* @__PURE__ */ jsx(
              IndexTable,
              {
                itemCount: checkouts.length,
                headings: [
                  { title: "Customer Name" },
                  { title: "Contact (Call / WA / Email)" },
                  { title: "Cart Total" },
                  { title: "Status" },
                  { title: "Call History / Notes" },
                  { title: "Actions" }
                ],
                selectable: false,
                children: rows
              }
            ) }) })
          ] })
        ] }),
        activeCheckout && /* @__PURE__ */ jsx(
          Modal,
          {
            open: true,
            onClose: () => setActiveCheckout(null),
            title: `Log Call with ${activeCheckout.firstName || activeCheckout.phone || "Customer"}`,
            primaryAction: { content: "Save Call Record", onAction: submitCall },
            secondaryActions: [{ content: "Cancel", onAction: () => setActiveCheckout(null) }],
            children: /* @__PURE__ */ jsx(Modal.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsxs(Text, { as: "p", children: [
                /* @__PURE__ */ jsx("strong", { children: "Phone:" }),
                " ",
                activeCheckout.phone || "None",
                " | ",
                /* @__PURE__ */ jsx("strong", { children: "Email:" }),
                " ",
                activeCheckout.email || "None"
              ] }),
              /* @__PURE__ */ jsx(
                Select,
                {
                  label: "Call Outcome",
                  options: [
                    { label: "No answer", value: "no_answer" },
                    { label: "Not interested", value: "not_interested" },
                    { label: "Will reorder / Promised payment", value: "will_reorder" },
                    { label: "Recovered on call (Customer paid)", value: "recovered" },
                    { label: "Requested Discount Code", value: "requested_discount" },
                    { label: "Wrong number", value: "wrong_number" }
                  ],
                  value: outcome,
                  onChange: setOutcome
                }
              ),
              /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Call Notes / Customer Feedback",
                  value: notes,
                  onChange: setNotes,
                  multiline: 3,
                  autoComplete: "off",
                  placeholder: "e.g., Customer had an issue with payment gateway, agreed to pay via bKash."
                }
              )
            ] }) })
          }
        )
      ]
    }
  ) });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: TestDashboard,
  links: links$1,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader = async ({ request }) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};
function App() {
  const { apiKey } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
    /* @__PURE__ */ jsx(NavMenu, { children: /* @__PURE__ */ jsx(Link, { to: "/app", rel: "home", children: "Dashboard" }) }),
    /* @__PURE__ */ jsx(Outlet, {})
  ] });
}
function ErrorBoundary() {
  return boundary.error(useRouteError());
}
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  headers,
  links,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-BYckSIs-.js", "imports": ["/assets/components-DFSkdVCi.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-DiRdNkC-.js", "imports": ["/assets/components-DFSkdVCi.js"], "css": [] }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.checkouts": { "id": "routes/webhooks.checkouts", "parentId": "root", "path": "webhooks/checkouts", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.checkouts-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.orders": { "id": "routes/webhooks.orders", "parentId": "root", "path": "webhooks/orders", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.orders-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app._index-C69TDY_5.js", "imports": ["/assets/components-DFSkdVCi.js", "/assets/Select-CjsIHvWa.js", "/assets/Page-DslD0T5X.js", "/assets/context-DA_6Swwd.js"], "css": [] }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/auth.login-CCadcDlT.js", "imports": ["/assets/components-DFSkdVCi.js", "/assets/styles-CjX44XVq.js", "/assets/Page-DslD0T5X.js", "/assets/context-DA_6Swwd.js"], "css": [] }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/_index-C6d-v1ok.js", "imports": [], "css": [] }, "routes/test": { "id": "routes/test", "parentId": "root", "path": "test", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/test-C_oMzihI.js", "imports": ["/assets/components-DFSkdVCi.js", "/assets/styles-CjX44XVq.js", "/assets/Select-CjsIHvWa.js", "/assets/Page-DslD0T5X.js", "/assets/context-DA_6Swwd.js"], "css": [] }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/app-DdGcC-Gc.js", "imports": ["/assets/components-DFSkdVCi.js", "/assets/styles-CjX44XVq.js", "/assets/context-DA_6Swwd.js"], "css": [] } }, "url": "/assets/manifest-08d6a6aa.js", "version": "08d6a6aa" };
const mode = "production";
const assetsBuildDirectory = "build\\client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": false, "v3_singleFetch": false, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.checkouts": {
    id: "routes/webhooks.checkouts",
    parentId: "root",
    path: "webhooks/checkouts",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/webhooks.orders": {
    id: "routes/webhooks.orders",
    parentId: "root",
    path: "webhooks/orders",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route4
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route7
  },
  "routes/test": {
    id: "routes/test",
    parentId: "root",
    path: "test",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
