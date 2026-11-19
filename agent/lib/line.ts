/**
 * The LINE adapter and the state store, shared by the LINE channel and the
 * tools that message LINE themselves.
 *
 * A tool can run where the channel never initialised the adapter. The
 * adapter then has no state to find a reply token in and pushes instead,
 * which is what a tool's notification is anyway: no one is waiting on a
 * reply. The state store connects on first use wherever it is touched.
 */

import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { createLineAdapter } from "@m-intelligence/chat-adapter-line";

/**
 * Chat SDK state store.
 *
 * This is not incidental for LINE. The adapter keeps each thread's single-use
 * reply token here so a reply can go out from a different serverless
 * invocation than the webhook that received the message — replies are free,
 * pushes are metered. Thread subscriptions, the greeting flag, and demo
 * bookings live here too. In-memory state loses all of it on every cold
 * start, so set `REDIS_URL` for anything beyond local experimentation.
 */
function resolveState() {
  const url = process.env.REDIS_URL;

  if (url) {
    return createRedisState({ url });
  }

  console.warn(
    "[line] REDIS_URL is not set — using in-memory state. Reply tokens, " +
      "thread subscriptions, the greeting flag, and demo bookings will not survive a cold start."
  );
  return createMemoryState();
}

export const state = resolveState();

export const line = createLineAdapter();
