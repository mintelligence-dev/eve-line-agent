/**
 * What a demo request holds, shared by the tool that shows the customer a
 * summary to confirm and the tool that saves the request, so both check the
 * details the same way.
 */

import { z } from "zod";
import { isBookableDay } from "./demo-booking";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const demoDetailsSchema = z.object({
  company: z.string().min(1).describe("Company name"),
  email: z.string().optional().describe("Email, if the customer gave one"),
  interest: z
    .string()
    .min(1)
    .describe("What they want to see, for example Sales solution or a problem they described"),
  name: z
    .string()
    .min(1)
    .describe("Contact person's name, first name then surname, without a title such as คุณ or Mr."),
  note: z.string().optional().describe("Anything else the customer told you that sales should know"),
  phone: z.string().optional().describe("Phone number, if the customer gave one"),
  preferredDate: z
    .string()
    .optional()
    .describe("The customer's preferred day as YYYY-MM-DD, when they picked or named a specific day"),
  preferredTime: z
    .string()
    .optional()
    .describe("When in the day they would like the demo, in their own words, such as ช่วงเช้า"),
});

export type DemoDetails = z.infer<typeof demoDetailsSchema>;

/**
 * Trim the details and check what the model cannot be trusted to: a way to
 * reach the customer, a plausible email, and a day that can still be booked.
 * Each error tells the model what to ask the customer.
 */
export function normalizeDemoDetails(input: DemoDetails): DemoDetails {
  const email = input.email?.trim() || undefined;
  const phone = input.phone?.trim() || undefined;
  if (!(phone || email)) {
    throw new Error("Need a phone number or an email so sales can reach the customer. Ask for one, then call again.");
  }
  if (email && !EMAIL.test(email)) {
    throw new Error(`"${email}" does not look like an email address. Ask the customer to check it, then call again.`);
  }
  const preferredDate = input.preferredDate?.trim() || undefined;
  if (preferredDate && !isBookableDay(preferredDate)) {
    throw new Error(
      `${preferredDate} is not a day that can be booked: it must be YYYY-MM-DD, from tomorrow and within 90 days. ` +
        "Ask the customer for another day, or leave preferredDate out, then call again."
    );
  }
  return {
    ...input,
    company: input.company.trim(),
    email,
    interest: input.interest.trim(),
    name: input.name.trim(),
    note: input.note?.trim() || undefined,
    phone,
    preferredDate,
    preferredTime: input.preferredTime?.trim() || undefined,
  };
}
