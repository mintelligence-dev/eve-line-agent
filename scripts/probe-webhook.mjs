#!/usr/bin/env node
/**
 * Send a signed LINE webhook to a running agent — no LINE account needed.
 *
 * Signs the body exactly the way LINE does (HMAC-SHA256 of the raw body,
 * base64, in `x-line-signature`), so this exercises the real verification
 * path rather than bypassing it.
 *
 * Usage:
 *   node scripts/probe-webhook.mjs                      # text message
 *   node scripts/probe-webhook.mjs postback             # button tap
 *   node scripts/probe-webhook.mjs text "How much?"     # custom text
 *   node scripts/probe-webhook.mjs bad-signature       # expect 401
 *
 * Env:
 *   LINE_CHANNEL_SECRET  must match the running agent (default: dev-secret)
 *   PROBE_URL            default http://127.0.0.1:2000/eve/v1/line
 */

import { createHmac } from "node:crypto";

const SECRET = process.env.LINE_CHANNEL_SECRET ?? "dev-secret";
const URL_ = process.env.PROBE_URL ?? "http://127.0.0.1:2000/eve/v1/line";

const BOT = "Uprobebot00000000000000000000001";
const USER = "Uprobeuser0000000000000000000001";

const [mode = "text", ...rest] = process.argv.slice(2);
const text = rest.join(" ") || "M Intelligence ทำอะไรบ้างครับ";

const base = {
  deliveryContext: { isRedelivery: false },
  mode: "active",
  source: { type: "user", userId: USER },
  timestamp: Date.now(),
  webhookEventId: `01PROBE${Date.now()}`,
};

const events = {
  postback: {
    ...base,
    postback: { data: 'chat:{"a":"services"}' },
    replyToken: "probe-reply-token",
    type: "postback",
  },
  text: {
    ...base,
    message: { id: "1", quoteToken: "q", text, type: "text" },
    replyToken: "probe-reply-token",
    type: "message",
  },
};

const event = events[mode === "bad-signature" ? "text" : mode] ?? events.text;
const body = JSON.stringify({ destination: BOT, events: [event] });

const signature =
  mode === "bad-signature"
    ? "not-a-real-signature"
    : createHmac("sha256", SECRET).update(body, "utf8").digest("base64");

const response = await fetch(URL_, {
  body,
  headers: {
    "content-type": "application/json",
    "x-line-signature": signature,
  },
  method: "POST",
});

console.log(`${mode} → ${response.status} ${response.statusText}`);
console.log(await response.text());

if (mode === "bad-signature" && response.status !== 401) {
  console.error("expected 401 for a bad signature");
  process.exit(1);
}
if (mode !== "bad-signature" && response.status !== 200) {
  console.error("expected 200 — check the agent log");
  process.exit(1);
}
