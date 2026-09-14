import { authenticate } from "../shopify.server";
import { handleOrderCreated } from "../services/recovery.server";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await handleOrderCreated(shop, payload);
  } catch (err) {
    console.error("Failed to process order webhook", err);
  }

  return new Response();
};
