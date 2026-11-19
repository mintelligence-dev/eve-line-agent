/**
 * Put the demo form under the agent's reply.
 *
 * The form is three small cards, one at a time: topic, preferred day, part of
 * the day. The tool sends nothing itself: the LINE channel attaches the first
 * card to the reply it is about to send, so it rides on the same free reply
 * token, and the bot answers each tap with the next card. The agent hears
 * back once, with all three choices.
 */

import { defineTool } from "eve/tools";
import { z } from "zod";
import { attach } from "../lib/demo-booking";

export default defineTool({
  description:
    "Show the customer a demo form in LINE, under your reply: three cards, one at a time, for the topic they want " +
    "to see, a preferred day on a calendar, and the part of the day. " +
    "Call it every time a customer asks to book a demo, before asking for their details, even if a form was shown " +
    "earlier in the chat: older cards stop working. Never tell the customer to use a card unless you called this " +
    "tool in the same turn. When they finish, their choices come back to you as one ordinary message.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const caller = ctx.session.auth.current;
    if (caller?.authenticator !== "line") {
      return {
        shown: false,
        nextStep: "This chat is not on LINE, so there is no form. Ask for the topic and a preferred day in text.",
      };
    }
    await attach(caller.principalId, { kind: "form" });
    return {
      shown: true,
      nextStep:
        "The first card appears under your reply and the next ones follow each tap on their own. In one short " +
        "sentence, ask the customer to pick in the card. Do not list the options, and do not ask for their name " +
        "or contact yet: ask for those after their choices arrive.",
    };
  },
});
