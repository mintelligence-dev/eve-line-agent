/**
 * Ready-made LINE cards for the welcome card's buttons and the quick-reply
 * chips under every answer.
 *
 * The content mirrors agent/instructions/10-company.md, 20-services.md and
 * 30-use-cases.md. Change both together: these cards answer instantly without
 * the model, so they never see the instructions.
 */

import {
  type LineFlexBubble,
  type LineFlexComponent,
  type LineFlexMessage,
  type LineQuickReplyItem,
  lineFlex,
  quickReplyItem,
} from "@m-intelligence/chat-adapter-line";

const BRAND = "#1E40AF";
const ON_BRAND_MUTED = "#FFFFFFB3";
const BODY = "#1F2937";
const WEBSITE = "https://m-intelligence.tech";
const EMAIL = "contact@m-intelligence.tech";
const ADDRESS =
  "เลขที่ 75/42 ชั้น 14 อาคารริชมอนด์ ซอยสุขุมวิท 26 แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110";
const MAP_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "อาคารริชมอนด์ ซอยสุขุมวิท 26 กรุงเทพฯ"
)}`;

/**
 * Action ID of every "ขอนัดเดโม" button and chip. The LINE channel answers it
 * with the demo form itself rather than asking the model.
 */
export const DEMO_ACTION_ID = "ask:demo";

/** One card in a carousel: a coloured header, a short summary, and points. */
interface InfoCard {
  /** Postback data of the "Ask more" button; the bot maps it to a question. */
  ask: string;
  /** Small caption above the title. */
  label: string;
  /** Opens the website when set. */
  link?: string;
  points: string[];
  summary?: string;
  title: string;
}

const bullet = (value: string): LineFlexComponent => ({
  contents: [
    { color: BRAND, flex: 0, size: "sm", text: "•", type: "text" },
    { color: BODY, flex: 1, size: "sm", text: value, type: "text", wrap: true },
  ],
  layout: "baseline",
  spacing: "sm",
  type: "box",
});

function infoBubble(card: InfoCard): LineFlexBubble {
  const body: LineFlexComponent[] = card.summary
    ? [
        { color: BODY, size: "sm", text: card.summary, type: "text", wrap: true },
        { margin: "md", type: "separator" },
        ...card.points.map(bullet),
      ]
    : card.points.map(bullet);
  const footer: LineFlexComponent[] = [
    {
      action: {
        data: card.ask,
        displayText: `อยากรู้เพิ่มเรื่อง ${card.title}`,
        label: "ถามเพิ่ม",
        type: "postback",
      },
      color: BRAND,
      height: "sm",
      style: "primary",
      type: "button",
    },
  ];
  if (card.link) {
    footer.push({
      action: { label: "ดูบนเว็บไซต์", type: "uri", uri: card.link },
      height: "sm",
      style: "link",
      type: "button",
    });
  }
  return {
    body: { contents: body, layout: "vertical", spacing: "sm", type: "box" },
    footer: { contents: footer, layout: "vertical", spacing: "sm", type: "box" },
    header: {
      backgroundColor: BRAND,
      contents: [
        { color: ON_BRAND_MUTED, size: "xxs", text: card.label, type: "text", wrap: true },
        { color: "#FFFFFF", size: "lg", text: card.title, type: "text", weight: "bold", wrap: true },
      ],
      layout: "vertical",
      paddingAll: "16px",
      type: "box",
    },
    size: "kilo",
    type: "bubble",
  };
}

const carousel = (altText: string, cards: InfoCard[]): LineFlexMessage =>
  lineFlex(altText, { contents: cards.map(infoBubble), type: "carousel" });

const SERVICES = carousel(
  "บริการของ M Intelligence: Sales, Service, Marketing และ NetSuite ERP",
  [
    {
      ask: "ask:sales",
      label: "บริการหลัก",
      link: WEBSITE,
      points: ["จัดการ pipeline ได้จริง", "เห็นข้อมูลลูกค้าแบบ real-time"],
      summary: "วาง CRM ให้ทีมขายปิดดีลเร็วขึ้น",
      title: "Sales solution",
    },
    {
      ask: "ask:service",
      label: "บริการหลัก",
      link: WEBSITE,
      points: ["จัดการ case", "ทำ automation ของกระบวนการซัพพอร์ต"],
      summary: "งานบริการลูกค้าครบทุก touchpoint",
      title: "Service solution",
    },
    {
      ask: "ask:marketing",
      label: "บริการหลัก",
      link: WEBSITE,
      points: [
        "อีเมล มือถือ โซเชียล โฆษณา และเว็บ",
        "Email marketing และ SMS/MMS/push",
        "Social publishing และ social listening",
      ],
      summary: "Personalised customer journey ข้ามช่องทาง ด้วย Marketing Cloud",
      title: "Marketing solution",
    },
    {
      ask: "ask:erp",
      label: "บริการหลัก",
      link: WEBSITE,
      points: ["การเงิน", "สินค้าคงคลังและจัดซื้อ", "Operation"],
      summary: "รวมงานไว้ในระบบ ERP บนคลาวด์ตัวเดียว",
      title: "NetSuite ERP",
    },
    {
      ask: "ask:platforms",
      label: "แพลตฟอร์มที่เรา implement",
      points: [
        "DocuSign: e-signature และ contract management",
        "Genesys: contact center บนคลาวด์",
        "Connector: LINE, Facebook, Instagram, TikTok, X, Pantip",
      ],
      summary:
        "Salesforce: Sales, Service, Marketing, Experience Cloud, Field Sales, Tableau Next, MuleSoft, Slack, AgentForce, CRM Analytics, Data Cloud",
      title: "Salesforce และอื่น ๆ",
    },
    {
      ask: "ask:engagement",
      label: "รูปแบบการทำงาน",
      points: [
        "Strategic consulting: วางแผน Digital Transformation",
        "Implementation: ติดตั้งและปรับแต่งแพลตฟอร์ม",
        "Managed services: ดูแลระบบต่อเนื่องหลังส่งมอบ",
      ],
      title: "ทำงานกับเรา 3 แบบ",
    },
  ]
);

const USE_CASES = carousel(
  "ตัวอย่างลูกค้า: ธนาคารเกียรตินาคินภัทร กรุงศรีอยุธยา ไทยพาณิชย์ Sompo และ SCB Protect",
  [
    {
      ask: "ask:case-kkp",
      label: "ธนาคาร · Service / Marketing",
      points: [
        "Knowledge Base Management",
        "Feedback Management (แบบสำรวจลูกค้า)",
        "Campaign Management",
      ],
      title: "ธนาคารเกียรตินาคินภัทร",
    },
    {
      ask: "ask:case-krungsri",
      label: "ธนาคาร · Service",
      points: ["Contact Center", "Omnichannel ทั้ง voice และ non-voice", "Social Listening"],
      title: "ธนาคารกรุงศรีอยุธยา",
    },
    {
      ask: "ask:case-scb",
      label: "ธนาคาร · Sales / Service / Marketing",
      points: ["Lead Management และ automation", "Renewal Management", "Knowledge Base"],
      title: "ธนาคารไทยพาณิชย์",
    },
    {
      ask: "ask:case-sompo",
      label: "ประกันภัย · Service",
      points: ["Case Management", "Social Connection: LINE, Facebook", "Claim Process"],
      title: "Sompo",
    },
    {
      ask: "ask:case-scbprotect",
      label: "ประกันภัย",
      points: ["Lead nurturing", "Social Connection: LINE", "SMS Engagement"],
      title: "SCB Protect",
    },
  ]
);

const row = (label: string, value: string): LineFlexComponent => ({
  contents: [
    { color: "#6B7280", flex: 2, size: "sm", text: label, type: "text" },
    { color: BODY, flex: 5, size: "sm", text: value, type: "text", wrap: true },
  ],
  layout: "baseline",
  spacing: "sm",
  type: "box",
});

const CONTACT = lineFlex(`ติดต่อทีมขาย M Intelligence: ${EMAIL}`, {
  body: {
    contents: [
      row("อีเมล", EMAIL),
      row("เว็บไซต์", "m-intelligence.tech"),
      row("ที่อยู่", ADDRESS),
    ],
    layout: "vertical",
    spacing: "md",
    type: "box",
  },
  footer: {
    contents: [
      {
        action: { clipboardText: EMAIL, label: "คัดลอกอีเมล", type: "clipboard" },
        color: BRAND,
        height: "sm",
        style: "primary",
        type: "button",
      },
      {
        action: {
          data: DEMO_ACTION_ID,
          displayText: "ขอนัดเดโม",
          label: "ขอนัดเดโม",
          type: "postback",
        },
        height: "sm",
        style: "secondary",
        type: "button",
      },
      {
        action: { label: "เปิดเว็บไซต์", type: "uri", uri: WEBSITE },
        height: "sm",
        style: "secondary",
        type: "button",
      },
      {
        action: { label: "ดูแผนที่", type: "uri", uri: MAP_URL },
        height: "sm",
        style: "link",
        type: "button",
      },
    ],
    layout: "vertical",
    spacing: "sm",
    type: "box",
  },
  header: {
    backgroundColor: BRAND,
    contents: [
      { color: ON_BRAND_MUTED, size: "xxs", text: "M Intelligence Co., Ltd.", type: "text" },
      { color: "#FFFFFF", size: "lg", text: "ติดต่อทีมขาย", type: "text", weight: "bold" },
    ],
    layout: "vertical",
    paddingAll: "16px",
    type: "box",
  },
  type: "bubble",
});

/** Cards answered instantly, by the postback data of the welcome card's buttons. */
export const infoCards: Readonly<Record<string, LineFlexMessage>> = {
  "contact-sales": CONTACT,
  services: SERVICES,
  "use-cases": USE_CASES,
};

/** Questions behind each card's "Ask more" button, answered by the model. */
export const askPrompts: Readonly<Record<string, string>> = {
  "ask:case-kkp": "เล่าเคสที่ M Intelligence ทำให้ธนาคารเกียรตินาคินภัทรให้ฟังหน่อย",
  "ask:case-krungsri": "เล่าเคสที่ M Intelligence ทำให้ธนาคารกรุงศรีอยุธยาให้ฟังหน่อย",
  "ask:case-scb": "เล่าเคสที่ M Intelligence ทำให้ธนาคารไทยพาณิชย์ให้ฟังหน่อย",
  "ask:case-scbprotect": "เล่าเคสที่ M Intelligence ทำให้ SCB Protect ให้ฟังหน่อย",
  "ask:case-sompo": "เล่าเคสที่ M Intelligence ทำให้ Sompo ให้ฟังหน่อย",
  "ask:engagement": "รูปแบบการทำงานกับ M Intelligence ทั้ง 3 แบบต่างกันอย่างไร",
  "ask:erp": "อธิบาย NetSuite ERP ที่ M Intelligence ทำให้ละเอียดขึ้น",
  "ask:marketing": "อธิบาย Marketing solution ของ M Intelligence ให้ละเอียดขึ้น",
  "ask:platforms": "M Intelligence implement แพลตฟอร์มอะไรบ้าง และมี connector อะไรที่พัฒนาเอง",
  "ask:sales": "อธิบาย Sales solution ของ M Intelligence ให้ละเอียดขึ้น ว่าช่วยทีมขายได้อย่างไร",
  "ask:service": "อธิบาย Service solution ของ M Intelligence ให้ละเอียดขึ้น",
};

const chip = (data: string, label: string): LineQuickReplyItem =>
  quickReplyItem({ data, displayText: label, label, type: "postback" });

const FOLLOW_UPS: LineQuickReplyItem[] = [
  chip("services", "ดูบริการ"),
  chip("use-cases", "ตัวอย่างลูกค้า"),
  chip("contact-sales", "ติดต่อทีมขาย"),
  chip(DEMO_ACTION_ID, "ขอนัดเดโม"),
];

/** Quick-reply chips for under a message, minus the one that produced it. */
export function followUps(except?: string): LineQuickReplyItem[] {
  return FOLLOW_UPS.filter(
    (item) => (item.action as { data?: string }).data !== except
  );
}
