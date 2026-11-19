/**
 * Showcase commands.
 *
 * A message that starts with "!" (for example `!date_picker`) is answered with
 * a ready-made LINE message instead of going to the model. Each command shows
 * one thing the adapter can render, including the ones the agent never
 * produces on its own — date pickers, templates, stickers — so every feature
 * can be demonstrated on demand. `!help` lists them all.
 *
 * Only what LINE itself can show is here: no samples of controls the adapter
 * has to fake, such as select menus or input fields. Quick replies, the
 * loading animation, and the clipboard action work in the LINE mobile apps
 * only, so their menu labels say so.
 *
 * Taps on the controls these messages carry arrive as actions whose ID starts
 * with `showcase:`; {@link handleShowcaseAction} answers them.
 */

import {
  cameraAction,
  cameraRollAction,
  clipboardAction,
  datetimePickerAction,
  encodePostbackData,
  type LineAdapter,
  type LineFlexBubble,
  type LineFlexComponent,
  type LineOutboundMessage,
  lineFlex,
  lineImage,
  lineLocation,
  lineSticker,
  lineTemplate,
  lineText,
  locationAction,
  messageAction,
  postbackAction,
  quickReplyItem,
  uriAction,
  withQuickReplies,
  withSender,
} from "@m-intelligence/chat-adapter-line";
import type { ActionEvent, CardElement, Message, Thread } from "chat";
import { infoCards } from "./line-cards";

const BRAND = "#1E40AF";
const WEBSITE = "https://m-intelligence.tech";
const UPLOADS = `${WEBSITE}/wp-content/uploads`;
/** 1536×1024 JPEG from the company website. */
const PHOTO = `${UPLOADS}/2023/07/futuristic-networking-technology-remix-with-woman-using-virtual-screen.jpg`;
/** Second 1536×1024 JPEG, for carousels. */
const PHOTO_CRM = `${UPLOADS}/2026/06/Customer-Relationship-Management-copy.jpg`;
/** 512×512 PNG logo, for the sender icon and a quick-reply icon. */
const ICON = `${UPLOADS}/2023/07/cropped-logo-1.png`;

/** Prefix of every action ID this module puts on a control. */
const ACTION_PREFIX = "showcase:";

type Send = (line: LineAdapter, thread: Thread, message: Message) => Promise<void>;

interface Command {
  /** Short Thai description shown in the `!help` menu. */
  label: string;
  run: Send;
}

/** Today in Bangkok as YYYY-MM-DD, the form LINE's date picker wants. */
const today = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

/** Send LINE message objects as they are. */
async function sendMessages(
  line: LineAdapter,
  thread: Thread,
  messages: LineOutboundMessage | LineOutboundMessage[]
): Promise<void> {
  await line.sendLineMessages(thread.id, messages);
}

/** Render a Chat SDK card the way `thread.post` would, then send it. */
async function sendCard(line: LineAdapter, thread: Thread, card: CardElement): Promise<void> {
  const messages = await line.renderLineMessages({ card, fallbackText: card.title ?? "M Intelligence" });
  await sendMessages(line, thread, messages);
}

async function sendMarkdown(line: LineAdapter, thread: Thread, markdown: string): Promise<void> {
  await sendMessages(line, thread, await line.renderLineMessages({ markdown }));
}

/**
 * A card child the bot's Chat SDK types do not list inside `actions`, such as
 * `date_input`. The adapter renders it as a LINE date picker all the same.
 */
type ActionChild = Extract<CardElement["children"][number], { type: "actions" }>["children"][number];
const asActionChild = (element: object): ActionChild => element as ActionChild;

// ---------------------------------------------------------------------------
// Chat SDK cards
// ---------------------------------------------------------------------------

const CARD: CardElement = {
  children: [
    { content: "การ์ดของ Chat SDK ที่ adapter แปลงเป็น Flex Message", type: "text" },
    { content: "ข้อความตัวหนา", style: "bold", type: "text" },
    { content: "ข้อความสีจาง (muted)", style: "muted", type: "text" },
    {
      children: [
        { label: "บริการ", type: "field", value: "Salesforce, NetSuite" },
        { label: "ช่องทาง", type: "field", value: "LINE, Facebook" },
        { label: "ทีม", type: "field", value: "Consulting และ Implementation" },
      ],
      type: "fields",
    },
    { type: "divider" },
    { label: "ลิงก์ในเนื้อการ์ด", type: "link", url: WEBSITE },
    {
      children: [
        { id: `${ACTION_PREFIX}card-primary`, label: "ปุ่มหลัก", style: "primary", type: "button" },
        { id: `${ACTION_PREFIX}card-default`, label: "ปุ่มปกติ", type: "button" },
        { label: "เปิดเว็บไซต์", type: "link-button", url: WEBSITE },
      ],
      type: "actions",
    },
  ],
  imageUrl: PHOTO,
  subtitle: "หัวข้อรอง รูปหัวการ์ด ข้อความ แถวข้อมูล เส้นคั่น ลิงก์ และปุ่ม",
  title: "การ์ดครบเครื่อง",
  type: "card",
};

const BUTTONS: CardElement = {
  children: [
    { content: "ปุ่ม 3 สี: primary, default และ danger", type: "text" },
    {
      children: [
        { id: `${ACTION_PREFIX}style-primary`, label: "primary", style: "primary", type: "button" },
        { id: `${ACTION_PREFIX}style-default`, label: "default", type: "button" },
        { id: `${ACTION_PREFIX}style-danger`, label: "danger", style: "danger", type: "button" },
      ],
      type: "actions",
    },
  ],
  title: "สีของปุ่ม",
  type: "card",
};

const datePickerCard = (): CardElement => ({
  children: [
    { content: "กดปุ่มด้านล่างเพื่อเปิดปฏิทินของ LINE แล้วเลือกวันที่", type: "text" },
    {
      children: [
        asActionChild({
          id: `${ACTION_PREFIX}date`,
          initialValue: today(),
          label: "เลือกวันที่",
          type: "date_input",
        }),
      ],
      type: "actions",
    },
  ],
  title: "ปฏิทินเลือกวันที่ (date picker)",
  type: "card",
});

const TABLE_CARD: CardElement = {
  children: [
    { content: "ตารางใน Chat SDK card", type: "text" },
    {
      headers: ["รูปแบบ", "เหมาะกับ"],
      rows: [
        ["Strategic consulting", "วางแผน Digital Transformation"],
        ["Implementation", "ติดตั้งและปรับแต่งระบบ"],
        ["Managed services", "ดูแลระบบหลังส่งมอบ"],
      ],
      type: "table",
    },
  ],
  title: "ตารางในการ์ด",
  type: "card",
};

// ---------------------------------------------------------------------------
// Native LINE messages
// ---------------------------------------------------------------------------

/** A buttons template whose only action is a date/time picker. */
async function pickerTemplate(
  mode: "datetime" | "time",
  title: string
): Promise<LineOutboundMessage> {
  const data = await encodePostbackData(`${ACTION_PREFIX}${mode}`, undefined, null);
  return lineTemplate(title, {
    actions: [datetimePickerAction(mode === "time" ? "เลือกเวลา" : "เลือกวันและเวลา", data, mode)],
    text: mode === "time" ? "กดปุ่มเพื่อเลือกเวลา" : "กดปุ่มเพื่อเลือกวันและเวลา",
    title,
    type: "buttons",
  });
}

async function quickReplies(): Promise<LineOutboundMessage> {
  const date = await encodePostbackData(`${ACTION_PREFIX}date`, undefined, null);
  const time = await encodePostbackData(`${ACTION_PREFIX}time`, undefined, null);
  return withQuickReplies(
    lineText("ปุ่มลัดเหนือช่องพิมพ์ทำได้หลายแบบ ลองกดดูทีละปุ่ม (ปุ่มแรกมีไอคอน)"),
    [
      quickReplyItem(postbackAction("ส่ง postback", `${ACTION_PREFIX}chip`, { displayText: "กดปุ่ม postback" }), ICON),
      quickReplyItem(messageAction("ส่งข้อความ", "ข้อความจากปุ่มลัด")),
      quickReplyItem(uriAction("เปิดเว็บไซต์", WEBSITE)),
      quickReplyItem(datetimePickerAction("เลือกวันที่", date, "date")),
      quickReplyItem(datetimePickerAction("เลือกเวลา", time, "time")),
      quickReplyItem(cameraAction("เปิดกล้อง")),
      quickReplyItem(cameraRollAction("เลือกรูป")),
      quickReplyItem(locationAction("ส่งตำแหน่ง")),
      quickReplyItem(clipboardAction("คัดลอกอีเมล", "contact@m-intelligence.tech")),
    ]
  );
}

const templateButtons = (): LineOutboundMessage =>
  lineTemplate("ตัวอย่าง template แบบปุ่ม", {
  actions: [
    postbackAction("ส่ง postback", `${ACTION_PREFIX}template`, { displayText: "กดปุ่มใน template" }),
    messageAction("ส่งข้อความ", "ข้อความจาก template"),
    uriAction("เปิดเว็บไซต์", WEBSITE),
  ],
  text: "มีรูป หัวข้อ ข้อความ และปุ่มได้สูงสุด 4 ปุ่ม",
  thumbnailImageUrl: PHOTO,
  title: "Template แบบปุ่ม",
  type: "buttons",
});

const templateConfirm = (): LineOutboundMessage =>
  lineTemplate("ตัวอย่าง template แบบยืนยัน", {
  actions: [
    postbackAction("ยืนยัน", `${ACTION_PREFIX}confirm-yes`, { displayText: "ยืนยัน" }),
    postbackAction("ยกเลิก", `${ACTION_PREFIX}confirm-no`, { displayText: "ยกเลิก" }),
  ],
  text: "ต้องการนัดเดโมกับทีมขายใช่ไหม (ตัวอย่างเท่านั้น ไม่มีการบันทึก)",
  type: "confirm",
});

const templateCarousel = (): LineOutboundMessage =>
  lineTemplate("ตัวอย่าง template แบบเลื่อน", {
  columns: [
    {
      actions: [
        postbackAction("สนใจ", `${ACTION_PREFIX}carousel`, { displayText: "สนใจ Sales solution" }),
        uriAction("ดูบนเว็บไซต์", WEBSITE),
      ],
      text: "วาง CRM ให้ทีมขายปิดดีลเร็วขึ้น",
      thumbnailImageUrl: PHOTO_CRM,
      title: "Sales solution",
    },
    {
      actions: [
        postbackAction("สนใจ", `${ACTION_PREFIX}carousel`, { displayText: "สนใจ Service solution" }),
        uriAction("ดูบนเว็บไซต์", WEBSITE),
      ],
      text: "งานบริการลูกค้าครบทุก touchpoint",
      thumbnailImageUrl: PHOTO,
      title: "Service solution",
    },
  ],
  type: "carousel",
});

const imageCarousel = (): LineOutboundMessage =>
  lineTemplate("ตัวอย่าง image carousel", {
  columns: [
    { action: uriAction("เปิดเว็บไซต์", WEBSITE), imageUrl: PHOTO_CRM },
    {
      action: postbackAction("กดรูปนี้", `${ACTION_PREFIX}image`, { displayText: "กดรูปที่ 2" }),
      imageUrl: PHOTO,
    },
  ],
  type: "image_carousel",
});

/** LINE emoji from LINE's own emoji list (product 5ac1bfd5040ab15980c9b435). */
function emojiText(): LineOutboundMessage {
  const text = "ข้อความนี้มีอีโมจิของ LINE $ และ $ อยู่ในประโยค";
  const first = text.indexOf("$");
  const second = text.indexOf("$", first + 1);
  return lineText(text, {
    emojis: [
      { emojiId: "001", index: first, productId: "5ac1bfd5040ab15980c9b435" },
      { emojiId: "002", index: second, productId: "5ac1bfd5040ab15980c9b435" },
    ],
  });
}

// ---------------------------------------------------------------------------
// Markdown answers
// ---------------------------------------------------------------------------

const MD_HEADINGS = `## บริการหลัก
- **Sales solution** วาง CRM ให้ทีมขาย
- **Service solution** งานบริการลูกค้าครบทุก touchpoint
- **Marketing solution** customer journey ข้ามช่องทาง

## ติดต่อเรา
- เว็บไซต์ [m-intelligence.tech](${WEBSITE})
- อีเมล contact@m-intelligence.tech`;

const MD_TABLE = `| รูปแบบ | ทำอะไร | เหมาะกับ |
| --- | --- | --- |
| Strategic consulting | วางแผน | เริ่มต้นโครงการ |
| Implementation | ติดตั้งและปรับแต่ง | มีแผนแล้ว |
| Managed services | ดูแลต่อเนื่อง | หลังส่งมอบ |`;

const MD_WIDE_TABLE = `| ลูกค้า | อุตสาหกรรม | Sales | Service | Marketing |
| --- | --- | --- | --- | --- |
| ธนาคารเกียรตินาคินภัทร | ธนาคาร | – | ✓ | ✓ |
| ธนาคารไทยพาณิชย์ | ธนาคาร | ✓ | ✓ | ✓ |
| Sompo | ประกันภัย | – | ✓ | – |`;

const MD_CODE = `## ตัวอย่างโค้ด
สร้าง adapter แล้วส่งข้อความ:

\`\`\`ts
const line = createLineAdapter();
await line.sendLineMessages(threadId, lineText("สวัสดีครับ"));
\`\`\``;

const MD_QUOTE = `## ตัวตนของบริษัท
> Your business partner to help drive revenue growth

## หมายเหตุ
ข้อความที่ขึ้นต้นด้วย > จะมีแถบสีเขียวด้านซ้าย`;

/** About 6,000 characters of Thai, more than one LINE text message can hold. */
function longText(): string {
  const sentence =
    "ภาษาไทยไม่เว้นวรรคระหว่างคำ adapter จึงใช้ Intl.Segmenter หาจุดตัดที่ไม่ทำให้คำหรือสระวรรณยุกต์ขาด ";
  const paragraphs: string[] = [];
  for (let i = 1; paragraphs.join("\n\n").length < 6000; i++) {
    paragraphs.push(`ย่อหน้าที่ ${i}: ${sentence.repeat(3)}`);
  }
  return `ข้อความนี้ยาวเกิน 5,000 ตัวอักษร จึงถูกแบ่งส่งเป็นหลายข้อความ\n\n${paragraphs.join("\n\n")}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const COMMANDS: Record<string, Command> = {
  card: { label: "การ์ดครบเครื่อง", run: (line, thread) => sendCard(line, thread, CARD) },
  buttons: { label: "สีของปุ่ม", run: (line, thread) => sendCard(line, thread, BUTTONS) },
  date_picker: { label: "ปฏิทินเลือกวันที่", run: (line, thread) => sendCard(line, thread, datePickerCard()) },
  time_picker: {
    label: "เลือกเวลา",
    run: async (line, thread) => sendMessages(line, thread, await pickerTemplate("time", "เลือกเวลา")),
  },
  datetime_picker: {
    label: "เลือกวันและเวลา",
    run: async (line, thread) => sendMessages(line, thread, await pickerTemplate("datetime", "เลือกวันและเวลา")),
  },
  table_card: { label: "ตารางในการ์ด", run: (line, thread) => sendCard(line, thread, TABLE_CARD) },
  quickreply: {
    label: "ปุ่มลัดทุกแบบ (มือถือ)",
    run: async (line, thread) => sendMessages(line, thread, await quickReplies()),
  },
  flex: {
    label: "Flex แบบเลื่อน (carousel)",
    run: (line, thread) => sendMessages(line, thread, infoCards.services),
  },
  template: { label: "Template แบบปุ่ม", run: (line, thread) => sendMessages(line, thread, templateButtons()) },
  confirm: { label: "Template แบบยืนยัน", run: (line, thread) => sendMessages(line, thread, templateConfirm()) },
  carousel: { label: "Template แบบเลื่อน", run: (line, thread) => sendMessages(line, thread, templateCarousel()) },
  image_carousel: { label: "รูปแบบเลื่อน", run: (line, thread) => sendMessages(line, thread, imageCarousel()) },
  sticker: { label: "สติกเกอร์", run: (line, thread) => sendMessages(line, thread, lineSticker("446", "1988")) },
  image: { label: "รูปภาพ", run: (line, thread) => sendMessages(line, thread, lineImage(PHOTO)) },
  location: {
    label: "หมุดแผนที่",
    run: (line, thread) =>
      sendMessages(
        line,
        thread,
        lineLocation({
          address: "ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ (ใกล้ซอยสุขุมวิท 26)",
          latitude: 13.7305,
          longitude: 100.5697,
          title: "BTS พร้อมพงษ์",
        })
      ),
  },
  emoji: { label: "อีโมจิของ LINE", run: (line, thread) => sendMessages(line, thread, emojiText()) },
  sender: {
    label: "เปลี่ยนชื่อและรูปผู้ส่ง",
    run: (line, thread) =>
      sendMessages(
        line,
        thread,
        withSender(lineText("ข้อความนี้ส่งในชื่อและรูปผู้ส่งที่ต่างจากบัญชี"), {
          iconUrl: ICON,
          name: "ทีมขาย (ตัวอย่าง)",
        })
      ),
  },
  quote: {
    label: "ตอบแบบอ้างข้อความ",
    run: async (line, thread, message) => {
      await line.reply(thread.id, message.id, "ข้อความนี้ตอบโดยอ้างข้อความของคุณด้านบน");
    },
  },
  markdown: { label: "คำตอบหลายหัวข้อเป็นการ์ด", run: (line, thread) => sendMarkdown(line, thread, MD_HEADINGS) },
  table: { label: "ตารางจาก Markdown", run: (line, thread) => sendMarkdown(line, thread, MD_TABLE) },
  wide_table: { label: "ตารางกว้างเกิน 4 คอลัมน์", run: (line, thread) => sendMarkdown(line, thread, MD_WIDE_TABLE) },
  code: { label: "กล่องโค้ด", run: (line, thread) => sendMarkdown(line, thread, MD_CODE) },
  blockquote: { label: "ข้อความอ้างอิง (quote)", run: (line, thread) => sendMarkdown(line, thread, MD_QUOTE) },
  long: { label: "ข้อความยาวที่ถูกแบ่งส่ง", run: (line, thread) => sendMarkdown(line, thread, longText()) },
  loading: {
    label: "จุดโหลดระหว่างรอ (มือถือ)",
    run: async (line, thread) => {
      await line.startTyping(thread.id);
      await sleep(5000);
      await sendMessages(line, thread, lineText("นี่คือจุดโหลด (loading animation) ที่ขึ้นระหว่างบอทกำลังคิด"));
    },
  },
};

/** Menu sections, in order. Every command appears in exactly one. */
const MENU: { commands: string[]; title: string }[] = [
  { commands: ["card", "buttons", "table_card"], title: "การ์ด" },
  {
    commands: ["date_picker", "time_picker", "datetime_picker", "quickreply"],
    title: "ปฏิทินและปุ่มลัด",
  },
  {
    commands: ["flex", "template", "confirm", "carousel", "image_carousel", "sticker", "image", "location"],
    title: "ข้อความ LINE แบบต่าง ๆ",
  },
  {
    commands: ["markdown", "table", "wide_table", "code", "blockquote", "long", "emoji", "sender", "quote", "loading"],
    title: "คำตอบและอื่น ๆ",
  },
];

function menuBubble(title: string, commands: string[]): LineFlexBubble {
  const rows: LineFlexComponent[] = commands.map((name) => ({
    action: messageAction(COMMANDS[name]?.label ?? name, `!${name}`),
    height: "sm",
    style: "link",
    type: "button",
  }));
  return {
    body: { contents: rows, layout: "vertical", spacing: "none", type: "box" },
    header: {
      backgroundColor: BRAND,
      contents: [
        { color: "#FFFFFFB3", size: "xxs", text: "พิมพ์ !ชื่อคำสั่ง หรือกดปุ่ม", type: "text" },
        { color: "#FFFFFF", size: "lg", text: title, type: "text", weight: "bold", wrap: true },
      ],
      layout: "vertical",
      paddingAll: "16px",
      type: "box",
    },
    size: "kilo",
    type: "bubble",
  };
}

const help = (): LineOutboundMessage =>
  lineFlex("คำสั่งโชว์ฟีเจอร์ พิมพ์ !help เพื่อดูอีกครั้ง", {
  contents: MENU.map((section) => menuBubble(section.title, section.commands)),
  type: "carousel",
});

/**
 * Answer a showcase command, if the message is one.
 *
 * @returns true when the message started with "!" and was handled here, so
 *   it must not go on to the model
 */
export async function runShowcaseCommand(
  line: LineAdapter,
  thread: Thread,
  message: Message
): Promise<boolean> {
  const match = /^!\s*([a-z_]+)/i.exec(message.text.trim());
  if (!match) {
    return false;
  }
  const name = (match[1] ?? "").toLowerCase();
  const command = COMMANDS[name];
  try {
    if (command) {
      await command.run(line, thread, message);
    } else {
      const intro =
        name === "help" || name === "demo" ? null : lineText(`ไม่รู้จักคำสั่ง !${name} ลองเลือกจากเมนูนี้ครับ`);
      await sendMessages(line, thread, intro ? [intro, help()] : help());
    }
  } catch (error) {
    // One broken sample must not take the others down, nor reach the model.
    console.error(`[showcase] !${name} failed`, error);
    await sendMessages(line, thread, lineText(`ส่งตัวอย่าง !${name} ไม่สำเร็จ ดูรายละเอียดใน log ของบอท`));
  }
  return true;
}

/** What each showcase action reports back, by action ID. */
const ACTION_REPLIES: Record<string, (value: string | undefined) => string> = {
  [`${ACTION_PREFIX}date`]: (value) => `ได้วันที่ ${value ?? "-"} จากปฏิทิน`,
  [`${ACTION_PREFIX}time`]: (value) => `ได้เวลา ${value ?? "-"}`,
  [`${ACTION_PREFIX}datetime`]: (value) => `ได้วันและเวลา ${value?.replace("T", " ") ?? "-"}`,
};

/**
 * Answer a tap on a control from a showcase message.
 *
 * @returns true when the action belonged to a showcase message
 */
export async function handleShowcaseAction(line: LineAdapter, event: ActionEvent): Promise<boolean> {
  if (!(event.thread && event.actionId.startsWith(ACTION_PREFIX))) {
    return false;
  }
  const reply = ACTION_REPLIES[event.actionId];
  const text = reply
    ? reply(event.value)
    : `บอทได้รับการกดปุ่ม (action ${event.actionId.slice(ACTION_PREFIX.length)})`;
  await line.sendLineMessages(event.thread.id, lineText(text));
  return true;
}
