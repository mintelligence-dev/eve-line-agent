/**
 * Demo booking between a customer's chat and the sales team's LINE group.
 *
 * 1. The agent offers a form (`offer_demo_form`): three small cards, one at a
 *    time — a topic, a day on LINE's date picker, a part of the day. The bot
 *    answers each tap with the next card itself, then hands the agent all
 *    three choices as the sentence the customer would have typed.
 * 2. The agent shows a summary card (`show_demo_summary`) with confirm, edit,
 *    and cancel buttons; those taps reach it as sentences too.
 * 3. `record_demo_request` saves the Lead, answers with a card of what was
 *    saved, and posts a card to the sales group named by
 *    `LINE_SALES_GROUP_ID`.
 * 4. In the group, someone taps "รับเรื่อง" to take it, and "นัดวันเดโม" to
 *    pick a date and time. The bot writes it to the Lead and sends the
 *    customer a card to confirm or ask for another day.
 * 5. The customer's answer goes back to the Lead and to the group.
 *
 * Cards meant for the customer's chat ride on the agent's reply: a tool only
 * queues them, and the LINE channel attaches them to the reply it sends.
 *
 * Only step 3 and the customer's answer in 5 push to the group, and pushes
 * to a group are metered per member. Everything said to whoever tapped a
 * button is a reply, which is free.
 */

import { createHash } from "node:crypto";
import {
  datetimePickerAction,
  decodeThreadId,
  encodePostbackData,
  encodeThreadId,
  type LineFlexBubble,
  type LineFlexComponent,
  type LineOutboundMessage,
  lineFlex,
  lineTemplate,
  lineText,
  postbackAction,
  uriAction,
} from "@m-intelligence/chat-adapter-line";
import type { ActionEvent, Author } from "chat";
import type { DemoDetails } from "./demo-details";
import { line, state } from "./line";
import {
  type DemoLeadFields,
  type DemoStatus,
  leadUrl,
  salesforceConfig,
  updateDemoFields,
} from "./salesforce";

const BRAND = "#1E40AF";
const ON_BRAND_MUTED = "#FFFFFFB3";
const BODY = "#1F2937";
const MUTED = "#6B7280";
const TIME_ZONE = "Asia/Bangkok";

/** Bookings outlive any sensible sales cycle, then expire from state. */
const BOOKING_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Queued cards only have to last until the agent's reply goes out. */
const ATTACHMENT_TTL_MS = 10 * 60 * 1000;
/** A summary can be confirmed for a day; after that the customer starts over. */
const SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;
/** The form's cards stay usable as long as a summary does. */
const WIZARD_TTL_MS = SUMMARY_TTL_MS;
/** How far ahead the customer and sales can pick a day. */
const PICKER_DAYS = 90;

/** Topics on the form, matching the four service groups in the instructions. */
const TOPICS = ["Sales solution", "Service solution", "Marketing solution", "NetSuite ERP"];
/** Parts of the day: what the button says, and what the agent is told. */
const SLOTS: Record<string, { label: string; text: string }> = {
  afternoon: { label: "ช่วงบ่าย", text: "สะดวกช่วงบ่าย" },
  any: { label: "ได้ทั้งวัน", text: "สะดวกได้ทั้งวัน" },
  morning: { label: "ช่วงเช้า", text: "สะดวกช่วงเช้า" },
};
/** The date step's "not yet" button, told apart from a picked day. */
const NO_DATE = "none";

/** Action IDs of the customer's form and summary. Taps go to the agent as text. */
export const FORM_ACTION_PREFIX = "demo-form:";
/** Action IDs of booking controls: `demo:<step>:<reference>`. */
const ACTION_PREFIX = "demo:";

/** A demo request as the bot tracks it after the Lead exists. */
export interface DemoBooking {
  claimedBy?: string;
  company: string;
  createdAt: string;
  /** LINE user ID of the customer, when the request came from LINE. */
  customerUserId?: string;
  email?: string;
  interest: string;
  leadId?: string;
  /** LINE display name of the customer. */
  lineDisplayName?: string;
  name: string;
  phone?: string;
  /** YYYY-MM-DD. */
  preferredDate?: string;
  /** The customer's own words, such as "ช่วงเช้า". */
  preferredTime?: string;
  reference: string;
  /** When sales booked the demo: YYYY-MM-DDTHH:mm, Bangkok time. */
  scheduledAt?: string;
  status: DemoStatus;
}

// ---------------------------------------------------------------------------
// Dates. LINE's pickers speak local wall-clock time without a zone; this
// business runs on Bangkok time.
// ---------------------------------------------------------------------------

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Now in Bangkok as YYYY-MM-DDTHH:mm. */
function bangkokNow(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone: TIME_ZONE,
      year: "numeric",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** A Bangkok calendar day plus some days, as YYYY-MM-DD. */
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

const today = (): string => bangkokNow().slice(0, 10);

/** A picker value as an instant: Bangkok wall-clock time. */
const instant = (value: string): Date =>
  new Date(DATE_PATTERN.test(value) ? `${value}T00:00:00+07:00` : `${value}:00+07:00`);

const DAY_FORMAT = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
  weekday: "short",
  year: "2-digit",
});
const TIME_FORMAT = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/** "ศุกร์ 20 พ.ย. 69" for a day, plus "10:00 น." when there is a time. */
export function thaiDate(value: string): string {
  const day = DAY_FORMAT.format(instant(value));
  return DATETIME_PATTERN.test(value) ? `${day} ${TIME_FORMAT.format(instant(value))} น.` : day;
}

/** A day the customer may still choose: from tomorrow, within the window. */
export function isBookableDay(value: string): boolean {
  return DATE_PATTERN.test(value) && value > today() && value <= addDays(today(), PICKER_DAYS);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const bookingKey = (reference: string) => `m-intel:demo:${reference}`;
const attachmentsKey = (userId: string) => `m-intel:demo-attach:${userId}`;
const summaryKey = (userId: string) => `m-intel:demo-summary:${userId}`;
const wizardKey = (userId: string) => `m-intel:demo-wizard:${userId}`;
const notifiedKey = (reference: string) => `m-intel:demo-notified:${reference}`;

async function getBooking(reference: string): Promise<DemoBooking | null> {
  await state.connect();
  return state.get<DemoBooking>(bookingKey(reference));
}

async function putBooking(booking: DemoBooking): Promise<void> {
  await state.connect();
  await state.set(bookingKey(booking.reference), booking, BOOKING_TTL_MS);
}

/** A card a tool asked for, sent under the agent's next reply in that chat. */
export type Attachment =
  | { kind: "form" }
  | { details: DemoDetails; id: string; kind: "summary" }
  | { details: DemoDetails; kind: "saved"; reference: string };

/** Queue a card for the agent's next reply to this LINE user. */
export async function attach(userId: string, attachment: Attachment): Promise<void> {
  await state.connect();
  const queued = (await state.get<Attachment[]>(attachmentsKey(userId))) ?? [];
  await state.set(attachmentsKey(userId), [...queued, attachment], ATTACHMENT_TTL_MS);
}

/** The cards queued for this reply, rendered, and the queue cleared. */
export async function takeAttachments(userId: string): Promise<LineOutboundMessage[]> {
  await state.connect();
  const queued = (await state.get<Attachment[]>(attachmentsKey(userId))) ?? [];
  if (queued.length === 0) {
    return [];
  }
  await state.delete(attachmentsKey(userId));
  return Promise.all(
    queued.map((attachment) => {
      switch (attachment.kind) {
        case "form":
          return startForm(userId);
        case "summary":
          return summaryCard(attachment.details, attachment.id);
        default:
          return savedCard(attachment.details, attachment.reference);
      }
    })
  );
}

/** The summary the customer can still confirm; one per customer, newest wins. */
interface PendingSummary {
  confirmedAt?: string;
  details: DemoDetails;
  id: string;
}

/** A short random ID that ties a card's buttons to one form or summary. */
const newId = (userId: string) =>
  createHash("sha256").update(`${userId}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 8);

/** Remember a summary as the one to confirm, and queue its card. */
export async function offerSummary(userId: string, details: DemoDetails): Promise<void> {
  const id = newId(userId);
  await state.connect();
  await state.set<PendingSummary>(summaryKey(userId), { details, id }, SUMMARY_TTL_MS);
  await attach(userId, { details, id, kind: "summary" });
}

/** The request was saved: no summary is left to confirm, and its card goes out. */
export async function settleSummary(userId: string, details: DemoDetails, reference: string): Promise<void> {
  await state.connect();
  await state.delete(summaryKey(userId));
  await attach(userId, { details, kind: "saved", reference });
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

const salesGroupId = (): string | undefined => process.env.LINE_SALES_GROUP_ID?.trim() || undefined;

/** Whether a thread is the sales team's group. */
export function isSalesGroup(threadId: string): boolean {
  const groupId = salesGroupId();
  if (!groupId) {
    return false;
  }
  const { sourceId, sourceType } = decodeThreadId(threadId);
  return sourceType === "group" && sourceId === groupId;
}

/**
 * The sales group's thread, or undefined when no group is configured. Outside
 * the channel the adapter may not know its own bot ID yet; a customer's 1:1
 * thread gives it away without an API call.
 */
async function salesGroupThreadId(customerUserId?: string): Promise<string | undefined> {
  const groupId = salesGroupId();
  if (!groupId) {
    return undefined;
  }
  const botUserId =
    line.botUserId ?? (customerUserId ? decodeThreadId(await line.openDM(customerUserId)).botUserId : undefined);
  return botUserId ? encodeThreadId({ botUserId, sourceId: groupId, sourceType: "group" }) : undefined;
}

/** A person's name for a message, never a bare LINE user ID. */
function personName(author: Author): string {
  return /^U[0-9a-f]{32}$/.test(author.fullName) ? "ทีมขาย" : author.fullName;
}

/** LINE's retry key: a UUID that is the same every time for the same push. */
function retryKey(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// ---------------------------------------------------------------------------
// Flex building blocks
// ---------------------------------------------------------------------------

const header = (caption: string, title: string): LineFlexComponent => ({
  backgroundColor: BRAND,
  contents: [
    { color: ON_BRAND_MUTED, size: "xs", text: caption, type: "text" },
    { color: "#FFFFFF", size: "lg", text: title, type: "text", weight: "bold", wrap: true },
  ],
  layout: "vertical",
  paddingAll: "16px",
  type: "box",
});

const row = (label: string, value: string): LineFlexComponent => ({
  contents: [
    { color: MUTED, flex: 2, size: "sm", text: label, type: "text" },
    { color: BODY, flex: 5, size: "sm", text: value, type: "text", wrap: true },
  ],
  layout: "baseline",
  spacing: "sm",
  type: "box",
});

const heading = (text: string): LineFlexComponent => ({
  color: BODY,
  margin: "lg",
  size: "sm",
  text,
  type: "text",
  weight: "bold",
});

function bubble(top: LineFlexComponent, body: LineFlexComponent[], footer: LineFlexComponent[]): LineFlexBubble {
  const container: LineFlexBubble = {
    body: { contents: body, layout: "vertical", spacing: "sm", type: "box" },
    header: top as LineFlexBubble["header"],
    size: "mega",
    type: "bubble",
  };
  if (footer.length > 0) {
    container.footer = { contents: footer, layout: "vertical", spacing: "sm", type: "box" };
  }
  return container;
}

const encode = (actionId: string, value?: string) => encodePostbackData(actionId, value, null);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** The customer's choices so far on the form; one form per customer, newest wins. */
interface DemoForm {
  /** YYYY-MM-DD, or NO_DATE when the customer has no day in mind yet. */
  date?: string;
  id: string;
  slot?: string;
  topic?: string;
}

/** A form step's button. Its action ID names the step and the form. */
async function stepButton(
  form: DemoForm,
  step: string,
  label: string,
  value: string,
  displayText: string,
  style: "primary" | "secondary" = "secondary"
): Promise<LineFlexComponent> {
  return {
    action: postbackAction(label, await encode(`${FORM_ACTION_PREFIX}${step}:${form.id}`, value), { displayText }),
    height: "sm",
    style,
    type: "button",
    ...(style === "primary" ? { color: BRAND } : {}),
  };
}

/** What the customer picked so far, shown on the next card. */
function chosen(form: DemoForm): LineFlexComponent[] {
  const rows: LineFlexComponent[] = [];
  if (form.topic) {
    rows.push(row("เรื่อง", form.topic));
  }
  if (form.date) {
    rows.push(row("วันที่", form.date === NO_DATE ? "ยังไม่ระบุ" : thaiDate(form.date)));
  }
  return rows.length > 0 ? [...rows, { margin: "md", type: "separator" }] : [];
}

const stepCard = (step: number, title: string, body: LineFlexComponent[]): LineOutboundMessage =>
  lineFlex(`นัดเดโม ขั้นที่ ${step}/3: ${title}`, bubble(header(`นัดเดโม · ขั้นที่ ${step}/3`, title), body, []));

/** Step 1: the topic. */
async function topicCard(form: DemoForm): Promise<LineOutboundMessage> {
  const buttons = await Promise.all(
    TOPICS.map((topic) => stepButton(form, "topic", topic, topic, `อยากดูเดโมเรื่อง ${topic}`))
  );
  return stepCard(1, "อยากดูเดโมเรื่องไหน", buttons);
}

/** Step 2: a day on LINE's date picker, or none yet. */
async function dateCard(form: DemoForm): Promise<LineOutboundMessage> {
  return stepCard(2, "วันไหนสะดวก", [
    ...chosen(form),
    {
      action: datetimePickerAction("📅 เลือกวันที่", await encode(`${FORM_ACTION_PREFIX}date:${form.id}`), "date", {
        max: addDays(today(), PICKER_DAYS),
        min: addDays(today(), 1),
      }),
      color: BRAND,
      height: "sm",
      style: "primary",
      type: "button",
    },
    await stepButton(form, "date", "ยังไม่ระบุวัน", NO_DATE, "ยังไม่ระบุวันที่สะดวก"),
  ]);
}

/** Step 3: the part of the day. */
async function slotCard(form: DemoForm): Promise<LineOutboundMessage> {
  const buttons = await Promise.all(
    Object.entries(SLOTS).map(([value, slot]) => stepButton(form, "slot", slot.label, value, slot.text))
  );
  return stepCard(3, "ช่วงเวลาไหนสะดวก", [...chosen(form), ...buttons]);
}

/** Start a fresh form for this customer and give its first card. */
async function startForm(userId: string): Promise<LineOutboundMessage> {
  const form: DemoForm = { id: newId(userId) };
  await state.connect();
  await state.set(wizardKey(userId), form, WIZARD_TTL_MS);
  return topicCard(form);
}

/**
 * The form started by a button rather than the agent: a line of guidance and
 * the first card, for a reply of its own.
 */
export async function demoFormStart(userId: string): Promise<LineOutboundMessage[]> {
  return [lineText("เลือกทีละขั้นในการ์ดด้านล่างได้เลยครับ"), await startForm(userId)];
}

/** The finished form as one sentence for the agent. */
function formSentence(form: DemoForm): string {
  return [
    form.topic && `อยากดูเดโมเรื่อง ${form.topic}`,
    form.date && form.date !== NO_DATE ? `วันที่สะดวก: ${thaiDate(form.date)} (${form.date})` : "ยังไม่ระบุวันที่สะดวก",
    form.slot && SLOTS[form.slot]?.text,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A demo request's details as card rows. */
function detailRows(details: DemoDetails): LineFlexComponent[] {
  const rows = [row("ชื่อ", details.name), row("บริษัท", details.company)];
  if (details.phone) {
    rows.push(row("โทร", details.phone));
  }
  if (details.email) {
    rows.push(row("อีเมล", details.email));
  }
  rows.push(row("อยากดู", details.interest));
  const when = [details.preferredDate && thaiDate(details.preferredDate), details.preferredTime].filter(Boolean);
  rows.push(row("วันที่สะดวก", when.length > 0 ? when.join(" · ") : "ยังไม่ระบุ"));
  if (details.note) {
    rows.push(row("หมายเหตุ", details.note));
  }
  return rows;
}

const smallPrint = (text: string): LineFlexComponent => ({
  color: MUTED,
  margin: "lg",
  size: "xs",
  text,
  type: "text",
  wrap: true,
});

/** The details to confirm before saving, with confirm, edit, and cancel. */
async function summaryCard(details: DemoDetails, id: string): Promise<LineOutboundMessage> {
  const button = async (
    label: string,
    step: string,
    displayText: string,
    style: "primary" | "secondary"
  ): Promise<LineFlexComponent> => ({
    action: postbackAction(label, await encode(`${FORM_ACTION_PREFIX}${step}`, id), { displayText }),
    flex: 1,
    height: "sm",
    style,
    type: "button",
    ...(style === "primary" ? { color: BRAND } : {}),
  });
  return lineFlex(
    `สรุปคำขอนัดเดโมของ ${details.company} กดยืนยัน แก้ไข หรือยกเลิก`,
    bubble(
      header("ตรวจสอบก่อนส่งให้ทีมขาย", "สรุปคำขอนัดเดโม"),
      [...detailRows(details), smallPrint("ข้อมูลนี้ใช้เพื่อให้ทีมขายติดต่อกลับเรื่องเดโมเท่านั้น")],
      [
        await button("ยืนยัน", "confirm", "ยืนยันข้อมูล", "primary"),
        {
          contents: [
            await button("แก้ไข", "edit", "ขอแก้ไขข้อมูล", "secondary"),
            await button("ยกเลิก", "cancel", "ยกเลิกการขอนัดเดโม", "secondary"),
          ],
          layout: "horizontal",
          spacing: "sm",
          type: "box",
        },
      ]
    )
  );
}

/** What was saved, for the customer to keep. */
async function savedCard(details: DemoDetails, reference: string): Promise<LineOutboundMessage> {
  return lineFlex(
    `บันทึกคำขอนัดเดโมแล้ว เลขอ้างอิง ${reference}`,
    bubble(
      header("บันทึกคำขอนัดเดโมแล้ว", `✅ ${reference}`),
      [
        ...detailRows(details),
        smallPrint("ทีมขายจะส่งวันและเวลานัดมาในแชตนี้ให้กดยืนยันครับ แจ้งเลขอ้างอิงนี้ได้ถ้าติดต่อทีมขาย"),
      ],
      []
    )
  );
}

/** What the customer wanted, for a card row. */
function preference(booking: DemoBooking): string {
  const parts = [booking.preferredDate && thaiDate(booking.preferredDate), booking.preferredTime].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "ยังไม่ระบุ";
}

/** Initial value of the sales date-time picker: the customer's day, mid-slot. */
function pickerStart(booking: DemoBooking): string | undefined {
  if (!(booking.preferredDate && booking.preferredDate > today())) {
    return undefined;
  }
  const afternoon = booking.preferredTime?.includes("บ่าย");
  return `${booking.preferredDate}T${afternoon ? "14:00" : "10:00"}`;
}

/** The sales group's controls for one booking. */
async function salesControls(booking: DemoBooking, claim: boolean): Promise<LineFlexComponent[]> {
  const controls: LineFlexComponent[] = [];
  if (claim) {
    controls.push({
      action: postbackAction("✋ รับเรื่อง", await encode(`${ACTION_PREFIX}claim:${booking.reference}`), {
        displayText: `รับเรื่อง ${booking.reference}`,
      }),
      height: "sm",
      style: "secondary",
      type: "button",
    });
  }
  const initial = pickerStart(booking);
  controls.push({
    action: datetimePickerAction(
      "📅 นัดวันเดโม",
      await encode(`${ACTION_PREFIX}schedule:${booking.reference}`),
      "datetime",
      {
        max: `${addDays(today(), PICKER_DAYS)}T23:59`,
        min: bangkokNow(),
        ...(initial ? { initial } : {}),
      }
    ),
    color: BRAND,
    height: "sm",
    style: "primary",
    type: "button",
  });
  const salesforce = salesforceConfig();
  if (salesforce && booking.leadId) {
    controls.push({
      action: uriAction("เปิด Lead ใน Salesforce", leadUrl(salesforce, booking.leadId)),
      height: "sm",
      style: "link",
      type: "button",
    });
  }
  return controls;
}

function customerRows(booking: DemoBooking): LineFlexComponent[] {
  const rows = [
    row("ชื่อ", booking.name),
    row("บริษัท", booking.company),
    row("อยากดู", booking.interest),
    row("วันที่สะดวก", preference(booking)),
  ];
  if (booking.phone) {
    rows.push(row("โทร", booking.phone));
  }
  if (booking.email) {
    rows.push(row("อีเมล", booking.email));
  }
  if (booking.lineDisplayName) {
    rows.push(row("LINE", booking.lineDisplayName));
  }
  return rows;
}

/** The card a new request posts to the sales group. */
async function newRequestCard(booking: DemoBooking): Promise<LineOutboundMessage> {
  return lineFlex(
    `คำขอเดโมใหม่ ${booking.reference} · ${booking.company}`,
    bubble(
      header(`คำขอเดโมใหม่ · ${booking.reference}`, `🔔 ${booking.company}`),
      customerRows(booking),
      await salesControls(booking, true)
    )
  );
}

/** The card a customer's request for another day posts to the sales group. */
async function rescheduleCard(booking: DemoBooking, by: string): Promise<LineOutboundMessage> {
  return lineFlex(
    `ลูกค้าขอเลื่อนนัด ${booking.reference} · ${booking.company}`,
    bubble(
      header(`ขอเลื่อนนัด · ${booking.reference}`, `🔁 ${booking.company}`),
      [
        row("ลูกค้า", by),
        row("วันใหม่ที่สะดวก", preference(booking)),
        ...(booking.claimedBy ? [row("ผู้ดูแล", booking.claimedBy)] : []),
      ],
      await salesControls(booking, false)
    )
  );
}

/** The card that tells the customer when sales booked the demo. */
async function appointmentCard(booking: DemoBooking, changed: boolean): Promise<LineOutboundMessage> {
  const when = booking.scheduledAt ?? "";
  const rows = [row("เรื่อง", booking.interest), row("เลขอ้างอิง", booking.reference)];
  if (booking.claimedBy) {
    rows.push(row("ผู้ดูแล", booking.claimedBy));
  }
  return lineFlex(
    `ทีมขายนัดเดโม ${thaiDate(when)} กดยืนยันหรือขอเลื่อนได้`,
    bubble(
      header(changed ? "เปลี่ยนวันนัดเดโม" : "นัดเดโมกับ M Intelligence", thaiDate(when)),
      [
        {
          color: BODY,
          size: "sm",
          text: "ทีมขายนัดเดโมตามวันเวลานี้ สะดวกไหมครับ",
          type: "text",
          wrap: true,
        },
        { margin: "md", type: "separator" },
        ...rows,
      ],
      [
        {
          action: postbackAction("ยืนยันนัด", await encode(`${ACTION_PREFIX}confirm:${booking.reference}`), {
            displayText: "ยืนยันนัดเดโม",
          }),
          color: BRAND,
          height: "sm",
          style: "primary",
          type: "button",
        },
        {
          action: postbackAction("ขอเลื่อน", await encode(`${ACTION_PREFIX}reschedule:${booking.reference}`), {
            displayText: "ขอเลื่อนนัด",
          }),
          height: "sm",
          style: "secondary",
          type: "button",
        },
      ]
    )
  );
}

async function newDayPicker(booking: DemoBooking): Promise<LineOutboundMessage> {
  return lineTemplate("เลือกวันใหม่ที่สะดวก", {
    actions: [
      datetimePickerAction("📅 เลือกวันใหม่", await encode(`${ACTION_PREFIX}newdate:${booking.reference}`), "date", {
        max: addDays(today(), PICKER_DAYS),
        min: addDays(today(), 1),
      }),
    ],
    text: "เลือกวันใหม่ที่สะดวก แล้วทีมขายจะส่งเวลานัดมาให้ยืนยันอีกครั้งครับ",
    type: "buttons",
  });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

/**
 * Track a new request and post it to the sales group, once per reference: a
 * replayed tool call finds the booking it already saved and does not post
 * again. A failed post is logged and never fails the request itself.
 */
export async function announceBooking(booking: DemoBooking): Promise<void> {
  await state.connect();
  const saved = await state.setIfNotExists(bookingKey(booking.reference), booking, BOOKING_TTL_MS);
  const current = saved ? booking : ((await getBooking(booking.reference)) ?? booking);

  if (!salesGroupId()) {
    console.warn(`[demo] ${booking.reference}: LINE_SALES_GROUP_ID is not set, so no group was told`);
    return;
  }
  const threadId = await salesGroupThreadId(booking.customerUserId);
  if (!threadId) {
    console.warn(
      `[demo] ${booking.reference}: the bot's LINE user ID is unknown outside a LINE chat, so no group was told. ` +
        "Set LINE_BOT_USER_ID to post requests from other channels."
    );
    return;
  }
  if (!(await state.setIfNotExists(notifiedKey(booking.reference), true, BOOKING_TTL_MS))) {
    return;
  }
  try {
    await line.sendLineMessages(threadId, await newRequestCard(current), {
      retryKey: retryKey(`notify:${booking.reference}`),
    });
  } catch (error) {
    // Let a replay try again; the retry key keeps LINE from showing it twice.
    await state.delete(notifiedKey(booking.reference));
    console.error(
      `[demo] ${booking.reference}: could not post to the sales group: ${error instanceof Error ? error.message : error}`
    );
  }
}

/** Write demo fields to the Lead, when there is one. */
async function writeLead(booking: DemoBooking, fields: DemoLeadFields): Promise<void> {
  const salesforce = salesforceConfig();
  if (!(salesforce && booking.leadId)) {
    console.log(`[demo] ${booking.reference}: no Lead to update`, JSON.stringify(fields));
    return;
  }
  await updateDemoFields(salesforce, booking.leadId, fields);
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The parts of a booking control's action ID. */
function parseAction(actionId: string): { reference: string; step: string } | undefined {
  const match = /^demo:(claim|schedule|confirm|reschedule|newdate):(DEMO-[0-9A-F]{6})$/.exec(actionId);
  return match ? { reference: match[2] ?? "", step: match[1] ?? "" } : undefined;
}

/**
 * Answer a tap on a booking control.
 *
 * @returns true when the action was one of ours
 */
export async function handleBookingAction(event: ActionEvent): Promise<boolean> {
  const action = parseAction(event.actionId);
  if (!(action && event.thread)) {
    return false;
  }
  const threadId = event.thread.id;
  const reply = (messages: LineOutboundMessage | LineOutboundMessage[]) => line.sendLineMessages(threadId, messages);

  const booking = await getBooking(action.reference);
  if (!booking) {
    await reply(lineText(`ไม่พบคำขอ ${action.reference} แล้ว อาจหมดอายุในระบบของบอท`));
    return true;
  }

  const fromSales = isSalesGroup(threadId);
  const fromCustomer =
    !fromSales && booking.customerUserId !== undefined && event.user.userId === booking.customerUserId;

  if (action.step === "claim" || action.step === "schedule") {
    if (!fromSales) {
      console.warn(`[demo] ${action.step} for ${booking.reference} from outside the sales group was ignored`);
      return true;
    }
    if (action.step === "claim") {
      await claim(booking, event.user, reply);
    } else {
      await schedule(booking, event.user, event.value, reply);
    }
    return true;
  }

  if (!fromCustomer) {
    console.warn(`[demo] ${action.step} for ${booking.reference} from someone other than the customer was ignored`);
    return true;
  }
  if (action.step === "confirm") {
    await confirm(booking, reply);
  } else if (action.step === "reschedule") {
    await reply(await newDayPicker(booking));
  } else {
    await requestNewDay(booking, event.value, reply);
  }
  return true;
}

type Reply = (messages: LineOutboundMessage | LineOutboundMessage[]) => Promise<unknown>;

async function claim(booking: DemoBooking, by: Author, reply: Reply): Promise<void> {
  const name = personName(by);
  if (booking.claimedBy && booking.claimedBy !== name) {
    await reply(lineText(`${booking.reference} มีคุณ${booking.claimedBy} รับเรื่องไปแล้วครับ`));
    return;
  }
  await putBooking({ ...booking, claimedBy: name });
  await reply(lineText(`✋ คุณ${name} รับเรื่อง ${booking.reference} (${booking.company}) กด "นัดวันเดโม" ในการ์ดเพื่อส่งวันนัดให้ลูกค้า`));
}

async function schedule(booking: DemoBooking, by: Author, value: string | undefined, reply: Reply): Promise<void> {
  if (!(value && DATETIME_PATTERN.test(value) && instant(value).getTime() > Date.now())) {
    await reply(lineText(`วันเวลานัด ${value ?? ""} ใช้ไม่ได้ เลือกวันเวลาที่ยังไม่ผ่านมาอีกครั้งครับ`));
    return;
  }
  const changed = booking.scheduledAt !== undefined;
  const next: DemoBooking = {
    ...booking,
    claimedBy: booking.claimedBy ?? personName(by),
    scheduledAt: value,
    status: "Scheduled",
  };

  try {
    await writeLead(next, { Demo_Date__c: instant(value).toISOString(), Demo_Status__c: "Scheduled" });
  } catch (error) {
    console.error(`[demo] ${booking.reference}: Lead not updated: ${errorText(error)}`);
    await reply(
      lineText(`บันทึกวันนัด ${booking.reference} ลง Salesforce ไม่สำเร็จ จึงยังไม่ได้แจ้งลูกค้า ลองกดนัดวันอีกครั้งครับ`)
    );
    return;
  }
  await putBooking(next);

  const when = thaiDate(value);
  if (!next.customerUserId) {
    await reply(lineText(`📅 บันทึกนัด ${booking.reference} ${when} แล้ว คำขอนี้ไม่ได้มาจาก LINE จึงต้องแจ้งลูกค้าเองครับ`));
    return;
  }
  try {
    await line.sendLineMessages(await line.openDM(next.customerUserId), await appointmentCard(next, changed));
  } catch (error) {
    console.error(`[demo] ${booking.reference}: customer not told: ${errorText(error)}`);
    await reply(
      lineText(
        `📅 บันทึกนัด ${booking.reference} ${when} ใน Salesforce แล้ว แต่ส่งข้อความหาลูกค้าใน LINE ไม่สำเร็จ ` +
          "รบกวนแจ้งลูกค้าทางโทรศัพท์หรืออีเมลครับ"
      )
    );
    return;
  }
  await reply(lineText(`📅 นัด ${booking.reference} (${booking.company}) ${when} แล้ว ส่งให้ลูกค้ากดยืนยันใน LINE แล้วครับ`));
}

/** Push an update to the sales group; a failure only costs the group a line. */
async function tellSales(booking: DemoBooking, messages: LineOutboundMessage | LineOutboundMessage[]): Promise<void> {
  const threadId = await salesGroupThreadId(booking.customerUserId);
  if (!threadId) {
    return;
  }
  try {
    await line.sendLineMessages(threadId, messages);
  } catch (error) {
    console.error(`[demo] ${booking.reference}: sales group not told: ${errorText(error)}`);
  }
}

async function confirm(booking: DemoBooking, reply: Reply): Promise<void> {
  if (booking.status === "Confirmed") {
    await reply(lineText("ยืนยันนัดนี้ไว้แล้วครับ แล้วพบกันครับ"));
    return;
  }
  if (!(booking.status === "Scheduled" && booking.scheduledAt)) {
    await reply(lineText("นัดนี้กำลังรอทีมขายส่งวันเวลาใหม่ครับ ได้แล้วจะแจ้งในแชตนี้"));
    return;
  }
  const next: DemoBooking = { ...booking, status: "Confirmed" };
  await putBooking(next);
  const when = thaiDate(booking.scheduledAt);
  await reply(lineText(`ยืนยันนัดเดโม ${when} เรียบร้อยครับ ทีมขายจะติดต่อไปก่อนถึงวันนัด`));

  let leadNote = "";
  try {
    await writeLead(next, { Demo_Status__c: "Confirmed" });
  } catch (error) {
    console.error(`[demo] ${booking.reference}: Lead not updated: ${errorText(error)}`);
    leadNote = " (อัปเดตสถานะใน Salesforce ไม่สำเร็จ รบกวนแก้ใน Lead เอง)";
  }
  await tellSales(next, lineText(`✅ ลูกค้ายืนยันนัด ${booking.reference} (${booking.company}) ${when}${leadNote}`));
}

async function requestNewDay(booking: DemoBooking, value: string | undefined, reply: Reply): Promise<void> {
  if (!(value && isBookableDay(value))) {
    await reply(lineText("วันที่นี้เลือกไม่ได้ครับ ลองกด \"ขอเลื่อน\" แล้วเลือกวันใหม่อีกครั้ง"));
    return;
  }
  const next: DemoBooking = {
    ...booking,
    preferredDate: value,
    preferredTime: undefined,
    scheduledAt: undefined,
    status: "Reschedule Requested",
  };
  await putBooking(next);
  await reply(lineText(`ส่งคำขอเลื่อนเป็น ${thaiDate(value)} ให้ทีมขายแล้วครับ ทีมขายจะส่งเวลานัดใหม่มาในแชตนี้`));

  try {
    await writeLead(next, { Demo_Preferred_Date__c: value, Demo_Status__c: "Reschedule Requested" });
  } catch (error) {
    console.error(`[demo] ${booking.reference}: Lead not updated: ${errorText(error)}`);
  }
  await tellSales(next, await rescheduleCard(next, booking.lineDisplayName ?? booking.name));
}

/**
 * Answer a tap on the customer's form or summary: either a card or notice to
 * reply with, or a sentence to hand the agent as if the customer had typed
 * it.
 *
 * The form's first two steps are answered with the next card; the last hands
 * the agent all three choices at once. Only the newest summary can be
 * confirmed, and only once: a second tap, or one on an older card, would
 * otherwise save the same request twice.
 */
export async function formTap(
  userId: string,
  actionId: string,
  value: string | undefined
): Promise<{ reply: LineOutboundMessage } | { text: string }> {
  const notice = (text: string) => ({ reply: lineText(text) });
  const expired = notice("การ์ดนี้หมดเวลาแล้วครับ พิมพ์ \"ขอนัดเดโม\" เพื่อเริ่มใหม่ได้เลย");
  const match = /^demo-form:(topic|date|slot|confirm|edit|cancel)(?::([0-9a-f]{8}))?$/.exec(actionId);
  if (!(match && value)) {
    return expired;
  }
  const step = match[1] ?? "";
  await state.connect();

  if (step === "topic" || step === "date" || step === "slot") {
    const form = await state.get<DemoForm>(wizardKey(userId));
    if (!(form && form.id === match[2])) {
      return expired;
    }
    if (step === "topic") {
      if (!TOPICS.includes(value)) {
        return expired;
      }
      const next = { ...form, topic: value };
      await state.set(wizardKey(userId), next, WIZARD_TTL_MS);
      return { reply: await dateCard(next) };
    }
    if (step === "date") {
      if (!(value === NO_DATE || isBookableDay(value))) {
        return notice("วันที่นี้เลือกไม่ได้ครับ เลือกวันตั้งแต่พรุ่งนี้เป็นต้นไปในการ์ดด้านบนได้เลย");
      }
      const next = { ...form, date: value };
      await state.set(wizardKey(userId), next, WIZARD_TTL_MS);
      return { reply: await slotCard(next) };
    }
    if (!SLOTS[value]) {
      return expired;
    }
    const done = { ...form, slot: value };
    await state.set(wizardKey(userId), done, WIZARD_TTL_MS);
    return { text: formSentence(done) };
  }

  const summary = await state.get<PendingSummary>(summaryKey(userId));
  if (!(summary && summary.id === value)) {
    return notice("สรุปนี้ใช้ไม่ได้แล้วครับ อาจบันทึกไปแล้วหรือมีสรุปที่ใหม่กว่า ถ้าต้องการนัดใหม่พิมพ์ \"ขอนัดเดโม\" ได้เลย");
  }
  if (summary.confirmedAt) {
    return notice("กำลังบันทึกคำขอนี้อยู่ครับ รอสักครู่");
  }
  if (step === "confirm") {
    await state.set<PendingSummary>(summaryKey(userId), { ...summary, confirmedAt: new Date().toISOString() }, SUMMARY_TTL_MS);
    return { text: "ยืนยันข้อมูลถูกต้อง บันทึกคำขอได้เลย" };
  }
  if (step === "cancel") {
    await state.delete(summaryKey(userId));
    return { text: "ยกเลิกการขอนัดเดโม" };
  }
  return { text: "ขอแก้ไขข้อมูล" };
}
