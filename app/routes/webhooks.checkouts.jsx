import { authenticate } from "../shopify.server";
import { handleCheckoutWebhook } from "../services/recovery.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await handleCheckoutWebhook(shop, payload);
  } catch (err) {
    // Log and swallow — we don't want Shopify to keep retrying forever on
    // a transient DB error, but you may want alerting here in production.
    console.error("Failed to process checkout webhook", err);
  }

  return new Response();
};
