#!/usr/bin/env node
/**
 * Print the demo requests the agent recorded on this machine.
 *
 * Usage: npm run leads
 * Reads .data/demo-requests.jsonl, or DEMO_REQUESTS_FILE when set.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const file =
  process.env.DEMO_REQUESTS_FILE ??
  join(process.cwd(), ".data", "demo-requests.jsonl");
const text = await readFile(file, "utf8").catch(() => "");
const requests = text
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

if (requests.length === 0) {
  console.log(`No demo requests yet (${file}).`);
} else {
  for (const r of requests) {
    const lines = [
      `${r.reference}  ${r.createdAt}`,
      `  ${r.name} · ${r.company}`,
      `  ${[r.phone, r.email].filter(Boolean).join(" · ")}`,
      `  สนใจ: ${r.interest}`,
    ];
    if (r.preferredTime) lines.push(`  สะดวก: ${r.preferredTime}`);
    if (r.note) lines.push(`  หมายเหตุ: ${r.note}`);
    if (r.lineDisplayName) lines.push(`  LINE: ${r.lineDisplayName}`);
    console.log(`${lines.join("\n")}\n`);
  }
  console.log(`${requests.length} request(s) in ${file}`);
}
