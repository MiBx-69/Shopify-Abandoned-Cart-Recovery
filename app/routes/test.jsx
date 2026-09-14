import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Text,
  Button,
  Modal,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import prisma from "../db.server";
import { runOutreachPass, handleCheckoutWebhook, handleOrderCreated } from "../services/recovery.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async () => {
  const checkouts = await prisma.abandonedCheckout.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const counts = {
    total: checkouts.length,
    pending: checkouts.filter((c) => c.status === "pending").length,
    contacted: checkouts.filter((c) => ["sms_sent", "email_sent"].includes(c.status)).length,
    called: checkouts.filter((c) => c.status === "called").length,
    recovered: checkouts.filter((c) => c.status === "recovered").length,
  };

  return json({ checkouts, counts });
};

export const action = async ({ request }) => {
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
        calledAt: new Date(),
        callOutcome: callOutcome || null,
        callNotes: callNotes || null,
      },
    });
    return json({ success: true, message: "Call logged successfully" });
  }

  if (intent === "run_outreach") {
    const results = await runOutreachPass({ shopName: process.env.SHOP_DISPLAY_NAME || "Our Store" });
    return json({
      success: true,
      message: `Outreach pass completed! SMS sent: ${results.sms.length}, Email sent: ${results.email.length}`,
    });
  }

  if (intent === "create_sample") {
    const num = Math.floor(1000 + Math.random() * 9000);
    const mockPayload = {
      id: `chk_${num}`,
      token: `tok_${num}`,
      cart_token: `cart_${num}`,
      total_price: `${(Math.random() * 2000 + 500).toFixed(2)}`,
      currency: "BDT",
      abandoned_checkout_url: `https://example.com/checkout/recover/${num}`,
      customer: {
        id: `cust_${num}`,
        first_name: ["Tariq", "Salma", "Arif", "Nusrat", "Kamal"][Math.floor(Math.random() * 5)],
        last_name: ["Hossain", "Chowdhury", "Islam", "Akter", "Ahmed"][Math.floor(Math.random() * 5)],
        email: `customer${num}@example.com`,
        phone: `+880171${Math.floor(1000000 + Math.random() * 9000000)}`,
      },
      line_items: [
        { title: "Cotton Casual Shirt", quantity: 1, price: "1200.00" },
        { title: "Canvas Backpack", quantity: 1, price: "1500.00" },
      ],
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
        cart_token: checkout.cartToken,
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
  lost: "critical",
};

export default function TestDashboard() {
  const { checkouts, counts } = useLoaderData();
  const fetcher = useFetcher();
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");

  const submitCall = () => {
    fetcher.submit(
      { intent: "log_call", id: activeCheckout.id, callOutcome: outcome, callNotes: notes },
      { method: "post" },
    );
    setActiveCheckout(null);
    setNotes("");
  };

  const rows = checkouts.map((c, index) => {
    const rawPhone = (c.phone || "").replace(/[^0-9+]/g, "");
    const waPhone = rawPhone.replace("+", "");

    return (
      <IndexTable.Row id={c.id} key={c.id} position={index}>
        <IndexTable.Cell>
          <Text as="span" fontWeight="semibold">
            {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="050">
            {c.phone ? (
              <InlineStack gap="200">
                <a href={`tel:${rawPhone}`} style={{ color: "#2c6ecb", textDecoration: "none", fontWeight: "bold" }}>
                  📞 {c.phone}
                </a>
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#25D366", textDecoration: "none", fontSize: "12px" }}
                >
                  💬 WhatsApp
                </a>
              </InlineStack>
            ) : (
              <Text as="span" tone="subdued">—</Text>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`} style={{ color: "#5c5f62", fontSize: "12px" }}>
                ✉️ {c.email}
              </a>
            )}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" fontWeight="bold">
            {c.totalPrice ? `${c.totalPrice} ${c.currency || ""}` : "—"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={STATUS_TONE[c.status] || "info"}>{c.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {c.callOutcome ? (
            <BlockStack gap="050">
              <Text as="span" variant="bodySm" fontWeight="semibold">
                Outcome: {c.callOutcome.replace("_", " ")}
              </Text>
              {c.callNotes && (
                <Text as="span" variant="bodySm" tone="subdued">
                  "{c.callNotes}"
                </Text>
              )}
            </BlockStack>
          ) : (
            <Text as="span" tone="subdued">Not called yet</Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button size="slim" onClick={() => setActiveCheckout(c)}>
              📞 Log Call
            </Button>
            {c.status !== "recovered" && (
              <Button
                size="slim"
                tone="success"
                onClick={() => fetcher.submit({ intent: "mark_recovered", id: c.id }, { method: "post" })}
              >
                Mark Recovered
              </Button>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <AppProvider isEmbeddedApp={false}>
      <Page
        title="Abandoned Checkout Recovery — Local Test Dashboard"
        subtitle="Test abandoned cart ingestion, SMS/Email recovery outreach, and telecalling workflow"
        primaryAction={{
          content: "⚡ Run Outreach Pass Now",
          onAction: () => fetcher.submit({ intent: "run_outreach" }, { method: "post" }),
          loading: fetcher.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "➕ Add Sample Checkout",
            onAction: () => fetcher.submit({ intent: "create_sample" }, { method: "post" }),
          },
        ]}
      >
        <BlockStack gap="400">
          {fetcher.data?.message && (
            <Banner tone="success" onDismiss={() => {}}>
              {fetcher.data.message}
            </Banner>
          )}

          <Layout>
            <Layout.Section>
              <InlineStack gap="400" align="space-between">
                <Card>
                  <Text as="p" tone="subdued">Total Captured</Text>
                  <Text as="h2" variant="headingLg">{counts.total}</Text>
                </Card>
                <Card>
                  <Text as="p" tone="subdued">Pending Recovery</Text>
                  <Text as="h2" variant="headingLg">{counts.pending}</Text>
                </Card>
                <Card>
                  <Text as="p" tone="subdued">SMS/Email Sent</Text>
                  <Text as="h2" variant="headingLg">{counts.contacted}</Text>
                </Card>
                <Card>
                  <Text as="p" tone="subdued">Calls Logged</Text>
                  <Text as="h2" variant="headingLg">{counts.called}</Text>
                </Card>
                <Card>
                  <Text as="p" tone="subdued">Recovered</Text>
                  <Text as="h2" variant="headingLg">{counts.recovered}</Text>
                </Card>
              </InlineStack>
            </Layout.Section>

            <Layout.Section>
              <Card padding="0">
                <IndexTable
                  itemCount={checkouts.length}
                  headings={[
                    { title: "Customer Name" },
                    { title: "Contact (Call / WA / Email)" },
                    { title: "Cart Total" },
                    { title: "Status" },
                    { title: "Call History / Notes" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {rows}
                </IndexTable>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {activeCheckout && (
          <Modal
            open
            onClose={() => setActiveCheckout(null)}
            title={`Log Call with ${activeCheckout.firstName || activeCheckout.phone || "Customer"}`}
            primaryAction={{ content: "Save Call Record", onAction: submitCall }}
            secondaryActions={[{ content: "Cancel", onAction: () => setActiveCheckout(null) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <Text as="p">
                  <strong>Phone:</strong> {activeCheckout.phone || "None"} | <strong>Email:</strong> {activeCheckout.email || "None"}
                </Text>
                <Select
                  label="Call Outcome"
                  options={[
                    { label: "No answer", value: "no_answer" },
                    { label: "Not interested", value: "not_interested" },
                    { label: "Will reorder / Promised payment", value: "will_reorder" },
                    { label: "Recovered on call (Customer paid)", value: "recovered" },
                    { label: "Requested Discount Code", value: "requested_discount" },
                    { label: "Wrong number", value: "wrong_number" },
                  ]}
                  value={outcome}
                  onChange={setOutcome}
                />
                <TextField
                  label="Call Notes / Customer Feedback"
                  value={notes}
                  onChange={setNotes}
                  multiline={3}
                  autoComplete="off"
                  placeholder="e.g., Customer had an issue with payment gateway, agreed to pay via bKash."
                />
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </Page>
    </AppProvider>
  );
}
