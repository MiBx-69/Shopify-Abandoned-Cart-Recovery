import "dotenv/config";
import prisma from "../app/db.server.js";

const sampleCheckouts = [
  {
    shop: "quickstart-test.myshopify.com",
    checkoutId: "9001",
    checkoutToken: "token_abc_9001",
    cartToken: "cart_token_9001",
    customerId: "cust_101",
    firstName: "Rahim",
    lastName: "Ahmed",
    email: "rahim.ahmed@example.com",
    phone: "+8801711223344",
    totalPrice: "2450.00",
    currency: "BDT",
    abandonedUrl: "https://quickstart-test.myshopify.com/checkouts/cn/c1-token_abc_9001/recover",
    lineItemsJson: JSON.stringify([
      { title: "Premium Cotton T-Shirt (L)", quantity: 2, price: "650.00" },
      { title: "Classic Denim Jeans (32)", quantity: 1, price: "1150.00" },
    ]),
    status: "pending",
  },
  {
    shop: "quickstart-test.myshopify.com",
    checkoutId: "9002",
    checkoutToken: "token_abc_9002",
    cartToken: "cart_token_9002",
    customerId: "cust_102",
    firstName: "Fatima",
    lastName: "Begum",
    email: "fatima.begum@example.com",
    phone: "+8801819887766",
    totalPrice: "1800.00",
    currency: "BDT",
    abandonedUrl: "https://quickstart-test.myshopify.com/checkouts/cn/c1-token_abc_9002/recover",
    lineItemsJson: JSON.stringify([
      { title: "Embroidered Kurti", quantity: 1, price: "1800.00" },
    ]),
    status: "pending",
  },
  {
    shop: "quickstart-test.myshopify.com",
    checkoutId: "9003",
    checkoutToken: "token_abc_9003",
    cartToken: "cart_token_9003",
    customerId: "cust_103",
    firstName: "Tanvir",
    lastName: "Hasan",
    email: "tanvir.h@example.com",
    phone: "+8801912345678",
    totalPrice: "4200.00",
    currency: "BDT",
    abandonedUrl: "https://quickstart-test.myshopify.com/checkouts/cn/c1-token_abc_9003/recover",
    lineItemsJson: JSON.stringify([
      { title: "Wireless Bluetooth Earbuds", quantity: 1, price: "3200.00" },
      { title: "Silicone Protective Case", quantity: 1, price: "1000.00" },
    ]),
    status: "pending",
  },
];

async function main() {
  console.log("Seeding test abandoned checkouts into SQLite...");

  for (const item of sampleCheckouts) {
    const record = await prisma.abandonedCheckout.upsert({
      where: {
        shop_checkoutId: {
          shop: item.shop,
          checkoutId: item.checkoutId,
        },
      },
      create: item,
      update: item,
    });
    console.log(`✅ Upserted checkout #${record.checkoutId} for ${record.firstName} ${record.lastName} (${record.phone || record.email})`);
  }

  const count = await prisma.abandonedCheckout.count();
  console.log(`\n🎉 Done! Total checkouts in database: ${count}`);
}

main()
  .catch((e) => {
    console.error("Error seeding data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
