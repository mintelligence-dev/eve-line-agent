/**
 * Record a customer's demo request for the sales team.
 *
 * The model calls it once the customer has given their details and confirmed
 * them. With Salesforce configured (see `agent/lib/salesforce.ts`) each
 * request becomes a Lead in the company org, routed by its assignment rules.
 * Without it, requests are appended to a local JSON Lines file
 * (`.data/demo-requests.jsonl`, or `DEMO_REQUESTS_FILE`), which is enough to
 * try the flow on `eve dev`.
 *
 * Either way the request is then posted to the sales team's LINE group, where
 * they book the date (see `agent/lib/demo-booking.ts`).
 */

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineTool } from "eve/tools";
import { announceBooking, settleSummary, thaiDate } from "../lib/demo-booking";
import { demoDetailsSchema, normalizeDemoDetails } from "../lib/demo-details";
import { createLead, type LeadFields, salesforceConfig } from "../lib/salesforce";

/**
 * Where requests go without Salesforce. On Vercel only `/tmp` is writable,
 * and it belongs to one function instance and is wiped with it, so a
 * deployment also logs each record.
 */
const requestsFile = (): string =>
  process.env.DEMO_REQUESTS_FILE ??
  (process.env.VERCEL
    ? "/tmp/demo-requests.jsonl"
    : join(process.cwd(), ".data", "demo-requests.jsonl"));

interface DemoRecord {
  company: string;
  createdAt: string;
  email?: string;
  interest: string;
  lineDisplayName?: string;
  lineUserId?: string;
  name: string;
  note?: string;
  phone?: string;
  preferredDate?: string;
  preferredTime?: string;
  reference: string;
  sessionId: string;
}

/**
 * Map a request onto Lead fields. Salesforce rejects a value longer than the
 * field, so each one is cut to the standard field length.
 */
function toLead(record: DemoRecord): LeadFields {
  const [first, ...rest] = record.name.trim().split(/\s+/);
  const description = [
    `ขอเดโมผ่านแชต LINE · เลขอ้างอิง ${record.reference}`,
    `สนใจ: ${record.interest}`,
    record.preferredDate && `วันที่สะดวก: ${thaiDate(record.preferredDate)}`,
    record.preferredTime && `ช่วงเวลาที่สะดวก: ${record.preferredTime}`,
    record.note && `หมายเหตุ: ${record.note}`,
    record.lineDisplayName && `ชื่อใน LINE: ${record.lineDisplayName}`,
    record.lineUserId && `LINE user ID: ${record.lineUserId}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    Company: record.company.slice(0, 255),
    Demo_Preferred_Date__c: record.preferredDate,
    Demo_Reference__c: record.reference,
    Demo_Status__c: "Requested",
    Description: description,
    Email: record.email,
    // A one-word name is all LastName, the one name field Salesforce requires.
    FirstName: rest.length > 0 ? first.slice(0, 40) : undefined,
    LastName: (rest.length > 0 ? rest.join(" ") : first).slice(0, 80),
    LeadSource: process.env.SALESFORCE_LEAD_SOURCE?.trim() || "LINE",
    Phone: record.phone?.slice(0, 40),
  };
}

export default defineTool({
  description:
    "Save a customer's request for a product demo so the M Intelligence sales team can contact them. " +
    "Call it only after the customer has given their name, company, a phone number or an email, and what they want to see, " +
    "and has confirmed the summary from show_demo_summary, with the same details. Call it once per request. " +
    "It returns a reference code; on LINE a card with the code and the details goes under your reply.",
  inputSchema: demoDetailsSchema,
  async execute(raw, ctx) {
    const input = normalizeDemoDetails(raw);
    const { email, phone, preferredDate } = input;

    // The tool call ID survives a step replay, so a re-run after a crash
    // gets the same reference and finds its own record instead of writing a
    // second one: Salesforce refuses a repeated reference, and the local file
    // is checked before it is appended to.
    const reference = `DEMO-${createHash("sha256")
      .update(`${ctx.session.id}:${ctx.callId}`)
      .digest("hex")
      .slice(0, 6)
      .toUpperCase()}`;

    // The LINE channel attaches the customer's LINE user ID and display name
    // to each turn, so sales can also follow up in the same chat.
    const caller = ctx.session.auth.current;
    const fromLine = caller?.authenticator === "line";
    const displayName = fromLine ? caller.attributes.displayName : undefined;
    const record: DemoRecord = {
      reference,
      createdAt: new Date().toISOString(),
      ...input,
      email,
      phone,
      preferredDate,
      lineUserId: fromLine ? caller.principalId : undefined,
      lineDisplayName: typeof displayName === "string" ? displayName : undefined,
      sessionId: ctx.session.id,
    };
    const result = {
      nextStep: fromLine
        ? "A card with the reference code and the saved details appears under your reply. Thank the customer in one " +
          "short sentence and say the sales team will send the date and time in this chat to confirm. " +
          "Do not repeat the details or the reference code."
        : "Give the customer the reference code. The sales team will contact them to confirm a date and time.",
      recorded: true,
      reference,
    };
    // The saved card replaces the summary, which can no longer be confirmed.
    const settle = async () => {
      if (fromLine) {
        await settleSummary(caller.principalId, input, reference).catch((error) =>
          console.error(`[demo] ${reference}: saved card not queued: ${error instanceof Error ? error.message : error}`)
        );
      }
    };
    // The request is saved by now; telling the group must never undo that.
    const announce = (leadId?: string) =>
      announceBooking({
        company: record.company,
        createdAt: record.createdAt,
        customerUserId: record.lineUserId,
        email,
        interest: record.interest,
        leadId,
        lineDisplayName: record.lineDisplayName,
        name: record.name,
        phone,
        preferredDate,
        preferredTime: record.preferredTime,
        reference,
        status: "Requested",
      }).catch((error) =>
        console.error(
          `[demo] ${reference}: booking not tracked for the sales group: ${error instanceof Error ? error.message : error}`
        )
      );

    const salesforce = salesforceConfig();
    if (salesforce) {
      try {
        const lead = await createLead(salesforce, toLead(record));
        console.log(
          lead.created
            ? `[demo] ${reference} saved as Salesforce Lead ${lead.id}`
            : `[demo] ${reference} was already saved as Salesforce Lead ${lead.id ?? "(ID not returned)"}`
        );
        await announce(lead.id);
        await settle();
        return result;
      } catch (error) {
        // The request reached no one. Log it whole so it can be entered by
        // hand, and let the model send the customer to email instead.
        console.error(
          `[demo] ${reference} not saved to Salesforce: ${error instanceof Error ? error.message : error}`,
          JSON.stringify(record)
        );
        throw new Error(
          "The request could not be saved to the sales system. Apologize, do not give a reference code, " +
            "and ask the customer to email contact@m-intelligence.tech instead. Do not call this tool again for this request."
        );
      }
    }

    const file = requestsFile();
    const existing = await readFile(file, "utf8").catch(() => "");
    if (!existing.includes(`"reference":"${reference}"`)) {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, `${JSON.stringify(record)}\n`, "utf8");
      console.log(
        process.env.VERCEL
          ? `[demo] ${JSON.stringify(record)}`
          : `[demo] ${reference} recorded for ${input.company}`
      );
    }
    await announce();
    await settle();
    return result;
  },
});
