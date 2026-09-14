# Abandoned Checkout Recovery — Shopify App

Recovers abandoned checkouts by:
1. Listening for `checkouts/create` / `checkouts/update` webhooks and storing each in-progress checkout (customer name, email, phone, cart contents, total, recovery URL).
2. On a schedule, sending an SMS via **Alpha SMS** and a custom recovery email if the checkout still hasn't converted after a delay.
3. Marking a checkout **recovered** automatically when the matching order comes in (`orders/create` webhook).
4. Giving your call team a dashboard inside the Shopify admin to see every abandoned checkout and log call outcomes.

## Important notes before you start

- **Checkout webhooks require the `read_checkouts` scope**, which Shopify only grants to apps after a permission request/review for public apps — for a custom/private app on your own store this is enabled directly in the Partners dashboard. If you don't see checkout data coming in, check that the scope was actually granted (Shopify sometimes needs you to request "protected customer data" access for checkout/customer PII).
- **Shopify's native abandoned-checkout email is automatic** (Settings → Checkout → "Send abandoned checkout emails") — no app can trigger it per-checkout with custom timing/content. This app sends its own separate custom email via SMTP instead. You can run both at once, or turn Shopify's off if you only want this app's messaging.
- **Alpha SMS's exact API parameters vary by account** — `app/services/alphaSms.server.js` is written for the common `sendsms?api_key=...&msg=...&to=...` pattern. Check your Alpha SMS dashboard/docs for your account's exact base URL and parameter names and adjust that one file if needed — nothing else depends on it.

## Project structure

```
app/
  routes/
    webhooks.checkouts.jsx      # receives checkout create/update events
    webhooks.orders.jsx         # marks checkouts recovered on order creation
    webhooks.app.uninstalled.jsx
    app._index.jsx              # call-team dashboard (embedded admin UI)
  services/
    recovery.server.js          # core logic: upsert checkouts, run outreach
    alphaSms.server.js          # Alpha SMS HTTP client
    email.server.js             # SMTP-based custom recovery email
  shopify.server.js             # Shopify app + webhook registration
  db.server.js                  # Prisma client
prisma/
  schema.prisma                 # AbandonedCheckout + Session tables
scripts/
  send-reminders.js             # run via external cron every 10-15 min
  watch-reminders.js            # alternative: in-process scheduler
```

## Setup

1. **Install the Shopify CLI** (if you haven't already):
   ```
   npm install -g @shopify/cli@latest
   ```

2. **Create the app in your Partners dashboard** (or run `shopify app init` fresh and copy these files in), then fill in `shopify.app.toml` with your real `client_id` and app URL, and update `SCOPES` in `.env` / `shopify.app.toml` to include:
   - `read_checkouts`
   - `read_orders`
   - `read_customers`

3. **Set up your database.** Create a Postgres (or MySQL) database, then:
   ```
   cp .env.example .env
   # fill in DATABASE_URL, SHOPIFY_API_KEY/SECRET, ALPHA_SMS_*, SMTP_*
   npm install
   npx prisma migrate dev --name init
   ```
   If using MySQL, change `provider = "postgresql"` to `provider = "mysql"` in `prisma/schema.prisma` first.

4. **Run locally against a dev store:**
   ```
   npm run dev
   ```
   This uses the Shopify CLI to tunnel your app and install it on your dev store. Add a few items to a cart on your dev store's storefront, fill in checkout info, then abandon it — you should see a row appear in the `AbandonedCheckout` table.

5. **Set up the reminder job.** This is a separate process from the web app — webhooks only *capture* checkouts, they don't send messages immediately (you don't want to text someone the second they start checking out). Pick one:
   - **External cron** (recommended for most hosts — Railway, Render, a VPS crontab, etc): schedule `node scripts/send-reminders.js` to run every 10–15 minutes.
   - **In-process worker**: run `node scripts/watch-reminders.js` as a second long-running process (e.g. a second dyno/service) — it fires the same logic every 10 minutes on its own.

6. **Deploy:**
   ```
   npm run deploy   # registers webhooks + app config with Shopify
   ```
   Then deploy the app itself (web process + worker/cron) to your host of choice (Railway, Render, Fly.io, Heroku, your own server, etc), pointing `DATABASE_URL` at your production Postgres/MySQL instance and setting `SHOPIFY_APP_URL` to your real domain.

## Tuning the outreach timing

In `.env`:
- `SMS_DELAY_MINUTES` — how long to wait after the last checkout update before texting (default 30).
- `EMAIL_DELAY_MINUTES` — how long before sending the follow-up email (default 1440 = 24h).
- `MAX_ABANDONED_AGE_HOURS` — stop automated outreach after this long; the checkout still shows in the dashboard for your call team either way (default 72).

## Call team workflow

Inside the Shopify admin, open the app to see every abandoned checkout with status (`pending` → `sms_sent` → `email_sent` → `called` → `recovered`), contact info, and cart value. Clicking **Log call** lets the rep record the outcome and notes — this is stored in the same database, so it's all queryable for reporting later.

## Extending this

- Add filters/search to the dashboard (by status, date range, cart value) as your list grows past a page.
- Add a `PATCH` endpoint if you want your call team's phone system (dialer) to pull the list via API instead of the embedded UI.
- If you outgrow SMTP for email, swap `app/services/email.server.js`'s internals for SendGrid/Postmark/Klaviyo's API — the function signature everything else calls stays the same.
