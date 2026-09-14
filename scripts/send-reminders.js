/**
 * Run this on a schedule (cron, Render Cron Job, Railway Cron, a
 * server-side crontab entry, etc) — e.g. every 10-15 minutes:
 *
 *   node scripts/send-reminders.js
 *
 * It finds abandoned checkouts that have crossed the SMS_DELAY_MINUTES /
 * EMAIL_DELAY_MINUTES thresholds (see .env) and sends the outreach,
 * updating each row's status so it's never contacted twice.
 */
import "dotenv/config";
import { runOutreachPass } from "../app/services/recovery.server.js";

const shopName = process.env.SHOP_DISPLAY_NAME || "our store";

runOutreachPass({ shopName })
  .then((results) => {
    console.log(
      `Outreach pass complete. SMS: ${results.sms.length} attempted, Email: ${results.email.length} attempted.`,
    );
    const failures = [...results.sms, ...results.email].filter((r) => !r.ok);
    if (failures.length) {
      console.warn("Some messages failed to send:", failures);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("Outreach pass failed:", err);
    process.exit(1);
  });
