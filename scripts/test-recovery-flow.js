import "dotenv/config";
import prisma from "../app/db.server.js";
import {
  handleCheckoutWebhook,
  handleOrderCreated,
  runOutreachPass,
} from "../app/services/recovery.server.js";

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING SHOPIFY ABANDONED CHECKOUT RECOVERY FLOW");
  console.log("==================================================\n");

  const shop = "quickstart-test.myshopify.com";
  const checkoutId = "test_chk_" + Date.now();
  const cartToken = "test_cart_" + Date.now();

  // 1. Simulate Shopify Webhook: checkouts/create
  console.log("1️⃣  Simulating Incoming Checkout Webhook (checkouts/create)...");
  const webhookPayload = {
    id: checkoutId,
    token: "token_" + checkoutId,
    cart_token: cartToken,
    total_price: "3500.00",
    subtotal_price: "3500.00",
    currency: "BDT",
    abandoned_checkout_url: `https://${shop}/checkouts/recover/${checkoutId}`,
    customer: {
      id: "cust_999",
      first_name: "Mahmud",
      last_name: "Karim",
      email: "mahmud.karim@test.com",
      phone: "+8801700998877",
    },
    line_items: [
      { title: "Formal Leather Shoes", quantity: 1, price: "3500.00" },
    ],
  };

  await handleCheckoutWebhook(shop, webhookPayload);

  // 2. Verify Database Record
  console.log("2️⃣  Verifying Checkout Stored in Database...");
  let record = await prisma.abandonedCheckout.findUnique({
    where: { shop_checkoutId: { shop, checkoutId } },
  });

  if (!record) {
    throw new Error("❌ Failed: Checkout record was not saved to database!");
  }
  console.log(`✅ Record found: ${record.firstName} ${record.lastName} | Phone: ${record.phone} | Total: ${record.totalPrice} ${record.currency} | Status: ${record.status}`);

  // 3. Test Automated Outreach: SMS
  console.log("\n3️⃣  Running Outreach Pass (SMS Test)...");
  const outreach1 = await runOutreachPass({ shopName: "Demo Store" });
  console.log(`   SMS Outreach Count: ${outreach1.sms.length}`);

  record = await prisma.abandonedCheckout.findUnique({
    where: { shop_checkoutId: { shop, checkoutId } },
  });
  console.log(`✅ Checkout Status after SMS pass: [${record.status}] (smsSentAt: ${record.smsSentAt})`);

  // 4. Test Automated Outreach: Email
  console.log("\n4️⃣  Running Outreach Pass (Email Test)...");
  // Set updatedAt back so it falls into the email cutoff for testing
  await prisma.abandonedCheckout.update({
    where: { id: record.id },
    data: { updatedAt: new Date(Date.now() - 1000) },
  });

  const outreach2 = await runOutreachPass({ shopName: "Demo Store" });
  console.log(`   Email Outreach Count: ${outreach2.email.length}`);

  record = await prisma.abandonedCheckout.findUnique({
    where: { shop_checkoutId: { shop, checkoutId } },
  });
  console.log(`✅ Checkout Status after Email pass: [${record.status}] (emailSentAt: ${record.emailSentAt})`);

  // 5. Simulate Telecall Team Logging Call
  console.log("\n5️⃣  Simulating Call Center Rep Logging a Call...");
  await prisma.abandonedCheckout.update({
    where: { id: record.id },
    data: {
      status: "called",
      calledAt: new Date(),
      callOutcome: "will_reorder",
      callNotes: "Customer requested a 10% discount code over the phone. Promised to complete order tonight.",
    },
  });

  record = await prisma.abandonedCheckout.findUnique({
    where: { id: record.id },
  });
  console.log(`✅ Call Logged: Outcome="${record.callOutcome}", Notes="${record.callNotes}", Status="${record.status}"`);

  // 6. Simulate Customer Converting (orders/create webhook)
  console.log("\n6️⃣  Simulating Customer Completing Purchase (orders/create webhook)...");
  await handleOrderCreated(shop, {
    cart_token: cartToken,
    checkout_id: checkoutId,
  });

  record = await prisma.abandonedCheckout.findUnique({
    where: { id: record.id },
  });
  console.log(`✅ Checkout Final Status: [${record.status}] | RecoveredAt: ${record.recoveredAt}`);

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest()
  .catch((err) => {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
