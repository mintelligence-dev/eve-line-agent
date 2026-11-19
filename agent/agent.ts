import { anthropic } from "@ai-sdk/anthropic";
import { defineAgent } from "eve";

export default defineAgent({
  // Calls Anthropic directly with ANTHROPIC_API_KEY (a Claude Console key)
  // instead of routing through Vercel AI Gateway.
  model: anthropic("claude-sonnet-5"),
});
