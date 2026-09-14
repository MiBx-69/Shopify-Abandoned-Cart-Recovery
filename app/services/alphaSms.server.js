/**
 * Thin client for Alpha SMS's HTTP API.
 *
 * Alpha SMS's exact endpoint/param names vary a bit by account/region, so
 * this is written against their common HTTP GET/POST send-SMS pattern:
 *   https://api.sms.net.bd/sendsms  (Bangladesh Alpha SMS style)
 * Double-check your Alpha SMS dashboard for the exact base URL and param
 * names for your account, and adjust ALPHA_SMS_* env vars / the query
 * params below to match. Nothing else in the app needs to change if the
 * param names differ — it's all isolated to this file.
 */

const ALPHA_SMS_BASE_URL =
  process.env.ALPHA_SMS_BASE_URL || "https://api.sms.net.bd/sendsms";
const ALPHA_SMS_API_KEY = process.env.ALPHA_SMS_API_KEY;
const ALPHA_SMS_SENDER_ID = process.env.ALPHA_SMS_SENDER_ID;

/**
 * @param {string} to - customer phone number, E.164 or local format your
 *   Alpha SMS account expects (e.g. 8801XXXXXXXXX).
 * @param {string} message - SMS body text.
 * @returns {Promise<{ success: boolean, raw: any }>}
 */
export async function sendSms(to, message) {
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
    to,
  });
  if (ALPHA_SMS_SENDER_ID) {
    params.set("sender_id", ALPHA_SMS_SENDER_ID);
  }

  const response = await fetch(`${ALPHA_SMS_BASE_URL}?${params.toString()}`, {
    method: "GET",
  });

  const text = await response.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = text;
  }

  // Alpha SMS-style APIs typically return { error: 0 } or a JSON `status`
  // field on success — adjust this check to match the real response shape
  // once you've sent a test message and seen what comes back.
  const success =
    response.ok &&
    (raw?.error === 0 || raw?.status === "success" || raw === "OK");

  if (!success) {
    throw new Error(
      `Alpha SMS send failed: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`,
    );
  }

  return { success, raw };
}

export function buildRecoverySmsMessage({ shopName, firstName, checkoutUrl }) {
  const name = firstName ? `${firstName}, ` : "";
  return `${name}you left something in your cart at ${shopName}! Complete your order here: ${checkoutUrl}`;
}
