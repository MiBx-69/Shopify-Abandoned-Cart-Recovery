/**
 * Alternative to send-reminders.js for hosts without an external cron
 * scheduler (e.g. a single long-running dyno). Runs the outreach pass
 * every 10 minutes for as long as this process stays alive.
 *
 * Run alongside your web process, e.g. in a Procfile:
 *   worker: node scripts/watch-reminders.js
 */
import "dotenv/config";
import cron from "node-cron";
import { runOutreachPass } from "../app/services/recovery.server.js";

const shopName = process.env.SHOP_DISPLAY_NAME || "our store";

console.log("Reminder worker started — running every 10 minutes.");

cron.schedule("*/10 * * * *", async () => {
  try {
    const results = await runOutreachPass({ shopName });
    console.log(
      `[${new Date().toISOString()}] SMS: ${results.sms.length}, Email: ${results.email.length}`,
    );
  } catch (err) {
    console.error("Outreach pass failed:", err);
  }
});
