import { useState } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const checkouts = await prisma.abandonedCheckout.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return json({ checkouts });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
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

export default function Index() {
  const { checkouts } = useLoaderData();
  const fetcher = useFetcher();
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [outcome, setOutcome] = useState("no_answer");
  const [notes, setNotes] = useState("");

  const submitCall = () => {
    fetcher.submit(
      { id: activeCheckout.id, callOutcome: outcome, callNotes: notes },
      { method: "post" },
    );
    setActiveCheckout(null);
    setNotes("");
  };

  const rows = checkouts.map((c, index) => (
    <IndexTable.Row id={c.id} key={c.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{c.email || "—"}</IndexTable.Cell>
      <IndexTable.Cell>{c.phone || "—"}</IndexTable.Cell>
      <IndexTable.Cell>
        {c.totalPrice ? `${c.totalPrice} ${c.currency || ""}` : "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={STATUS_TONE[c.status] || "info"}>{c.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{new Date(c.updatedAt).toLocaleString()}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button size="slim" onClick={() => setActiveCheckout(c)}>
          Log call
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Abandoned Checkout Recovery">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              itemCount={checkouts.length}
              headings={[
                { title: "Customer" },
                { title: "Email" },
                { title: "Phone" },
                { title: "Cart total" },
                { title: "Status" },
                { title: "Last activity" },
                { title: "Call team" },
              ]}
              selectable={false}
            >
              {rows}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {activeCheckout && (
        <Modal
          open
          onClose={() => setActiveCheckout(null)}
          title={`Log call — ${activeCheckout.firstName || activeCheckout.email || "customer"}`}
          primaryAction={{ content: "Save", onAction: submitCall }}
          secondaryActions={[{ content: "Cancel", onAction: () => setActiveCheckout(null) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Select
                label="Outcome"
                options={[
                  { label: "No answer", value: "no_answer" },
                  { label: "Not interested", value: "not_interested" },
                  { label: "Will reorder", value: "will_reorder" },
                  { label: "Recovered on call", value: "recovered" },
                ]}
                value={outcome}
                onChange={setOutcome}
              />
              <TextField
                label="Notes"
                value={notes}
                onChange={setNotes}
                multiline={3}
                autoComplete="off"
              />
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
