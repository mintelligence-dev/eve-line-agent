/**
 * Show the customer a summary of their demo request to confirm.
 *
 * Like the form, the card rides on the agent's reply. Its buttons come back
 * as sentences: "ยืนยันข้อมูลถูกต้อง บันทึกคำขอได้เลย", "ขอแก้ไขข้อมูล", or
 * "ยกเลิกการขอนัดเดโม". Only the newest summary can be confirmed, and only
 * once, so an old card or a double tap cannot save the request twice.
 */

import { defineTool } from "eve/tools";
import { offerSummary } from "../lib/demo-booking";
import { demoDetailsSchema, normalizeDemoDetails } from "../lib/demo-details";

export default defineTool({
  description:
    "Show the customer a card summarising their demo request, with buttons to confirm, edit, or cancel. " +
    "Call it once you have their name, company, a phone number or an email, and what they want to see, " +
    "instead of writing the summary yourself. Call it again after any change. " +
    "When they confirm, call record_demo_request with exactly the same details.",
  inputSchema: demoDetailsSchema,
  async execute(raw, ctx) {
    const details = normalizeDemoDetails(raw);
    const caller = ctx.session.auth.current;
    if (caller?.authenticator !== "line") {
      return {
        shown: false,
        nextStep: "This chat is not on LINE, so there is no card. Write the summary and ask the customer to confirm it.",
      };
    }
    await offerSummary(caller.principalId, details);
    return {
      shown: true,
      nextStep:
        "The summary card appears under your reply. In one short sentence, ask the customer to check it and tap " +
        "ยืนยัน, or แก้ไข to change something. Do not repeat the details.",
    };
  },
});
