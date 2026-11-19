# M Intelligence LINE Agent

> AI ตอบลูกค้าใน LINE Official Account เรื่องบริษัทและบริการ รับนัดเดโมเข้า Salesforce และให้ทีมขายนัดวันจากกลุ่ม LINE  
> An AI agent that answers customers on a LINE Official Account, books demos into Salesforce, and lets the sales team schedule them from a LINE group.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![eve](https://img.shields.io/badge/eve-agent%20framework-black)](https://eve.dev)
[![AI SDK](https://img.shields.io/badge/AI%20SDK-7-black?logo=vercel)](https://ai-sdk.dev)
[![Chat SDK](https://img.shields.io/badge/Chat%20SDK-4-black?logo=vercel)](https://chat-sdk.dev)
[![LINE](https://img.shields.io/badge/LINE-Messaging%20API-06C755?logo=line&logoColor=white)](https://developers.line.biz/en/docs/messaging-api/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[ภาษาไทย](#ภาษาไทย) · [English](#english)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmintelligence-dev%2Feve-line-agent&project-name=eve-line-agent&repository-name=eve-line-agent&env=LINE_CHANNEL_ACCESS_TOKEN%2CLINE_CHANNEL_SECRET%2CANTHROPIC_API_KEY&envDescription=LINE_CHANNEL_ACCESS_TOKEN%20and%20LINE_CHANNEL_SECRET%3A%20LINE%20Developers%20Console%20%3E%20your%20Messaging%20API%20channel.%20ANTHROPIC_API_KEY%3A%20Claude%20Console%20%3E%20API%20keys.%20Redis%20%28Upstash%29%20is%20added%20on%20this%20page%3B%20Salesforce%20and%20the%20sales%20team%27s%20LINE%20group%20are%20optional%20%28see%20README%29.&envLink=https%3A%2F%2Fgithub.com%2Fmintelligence-dev%2Feve-line-agent%23environment-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22upstash%22%2C%22productSlug%22%3A%22upstash-kv%22%2C%22allowConnectExistingProduct%22%3Atrue%7D%5D)

> ปุ่ม Deploy ใช้ติดตั้งระบบ**แยกของคุณเอง** (LINE channel, key และ Redis ของคุณ) · Installs **your own copy** with your own LINE channel, keys and Redis.

---

## ภาษาไทย

### ทำอะไรได้

1. **ตอบคำถามลูกค้าใน LINE** เรื่องบริษัท บริการ และตัวอย่างลูกค้า ในภาษาเดียวกับที่ลูกค้าพิมพ์ จากข้อมูลใน `agent/instructions/` คำตอบสั้นเป็นข้อความ คำตอบที่มีหลายหัวข้อหรือตารางเป็นการ์ด Flex
2. **การ์ดต้อนรับและการ์ดสำเร็จรูป** ทักครั้งแรกได้การ์ด ดูบริการ / ตัวอย่างลูกค้า / ติดต่อทีมขาย ซึ่งตอบทันทีโดยไม่ผ่าน AI และมีปุ่มลัดใต้ทุกคำตอบ
3. **นัดเดโม** การ์ดทีละขั้น 3 ใบ (เรื่องที่อยากดู → วันที่จากปฏิทิน LINE → ช่วงเวลา) → การ์ดสรุปให้กด **ยืนยัน / แก้ไข / ยกเลิก** → บันทึกเป็น **Salesforce Lead** และส่งการ์ดเลขอ้างอิงให้ลูกค้า
4. **ทีมขายนัดวันจากกลุ่ม LINE** คำขอใหม่ขึ้นเป็นการ์ดในกลุ่มทีมขาย มีปุ่ม **รับเรื่อง** / **นัดวันเดโม** / **เปิด Lead ใน Salesforce** พอนัดแล้วลูกค้าได้การ์ดให้ **ยืนยัน** หรือ **ขอเลื่อน** และ Lead อัปเดตตามทุกขั้น
5. **คำสั่งโชว์ฟีเจอร์** ข้อความที่ขึ้นต้นด้วย `!` ตอบด้วยตัวอย่างสำเร็จรูปโดยไม่ผ่าน AI ครบทุกแบบที่ LINE แสดงได้ (`!help` ดูเมนู)
6. **ไม่บอกราคา ไม่แต่งข้อมูล** เรื่องที่ไม่มีข้อมูลหรือขอคุยกับคน ส่งต่อช่องทางติดต่อทีมขาย

### หลักความปลอดภัย

| กฎ | บังคับใช้อย่างไร |
|---|---|
| webhook ปลอมไม่ได้ | adapter ตรวจ `x-line-signature` ด้วย `LINE_CHANNEL_SECRET` · event ที่ LINE ส่งซ้ำถูกตัดด้วย `webhookEventId` ใน Redis |
| AI ไม่บอกราคา ไม่แต่งข้อมูล ไม่รับปากแทนบริษัท ไม่ขอข้อมูลอ่อนไหว | กติกาใน `agent/instructions.md` · ข้อมูลบริษัทมาจากไฟล์ใน `agent/instructions/` เท่านั้น ไม่ดึงเว็บตอนตอบ |
| คำขอเดียวไม่กลายเป็น Lead 2 ใบ | การ์ดสรุปยืนยันได้เฉพาะใบล่าสุดครั้งเดียว (`formTap()`) · เลขอ้างอิงคำนวณจาก tool call เดิมเสมอ · ช่อง `Demo_Reference__c` ใน Salesforce ห้ามซ้ำ |
| คนนอกกดปุ่มนัดแทนไม่ได้ | ปุ่มนัดใช้ได้เฉพาะในกลุ่ม `LINE_SALES_GROUP_ID` ปุ่มยืนยันใช้ได้เฉพาะลูกค้าเจ้าของคำขอ (`handleBookingAction()`) · บอทออกจากกลุ่มอื่นที่ถูกเชิญเอง |
| Salesforce ใช้สิทธิ์น้อยที่สุด | login ด้วย integration user ผ่าน OAuth client credentials · permission set สร้างและแก้ Lead ได้ ลบไม่ได้ และเปิด object อื่นไม่ได้ |
| Salesforce ล่ม ลูกค้าไม่ได้ข้อมูลผิด | บันทึกไม่สำเร็จ AI ไม่ให้เลขอ้างอิงและให้อีเมลแทน พร้อม log คำขอเต็มไว้กรอกมือ · นัดวันแล้ว Salesforce ไม่รับ บอทไม่แจ้งลูกค้าและบอกเหตุผลในกลุ่ม |
| ไม่เปลืองโควตา LINE | reply token เก็บใน Redis จึงตอบด้วย reply ที่ไม่เสียโควตาได้แม้ตอบจากคนละ function · การ์ดที่ tool ขอแนบไปกับคำตอบเดียวกัน (`takeAttachments()`) · push มี `X-Line-Retry-Key` ส่งซ้ำไม่ได้ |

### ติดตั้งด้วยปุ่ม Deploy

1. กดปุ่ม **Deploy with Vercel** ด้านบน แล้ว login Vercel
2. ในส่วน **Add Products → Storage** กด **Add** ที่ Upstash เพื่อสร้าง Redis (แบบฟรีได้) หรือเชื่อมกับของที่มีอยู่ ระบบตั้ง `REDIS_URL` ให้เอง ควรเลือก region เดียวกับ function (ค่าเริ่มต้นของ Vercel คือ Washington, D.C. `iad1`)
3. กรอก 3 ช่อง ([ดูว่าเอามาจากไหน](#ช่องที่ต้องกรอกตอน-deploy)) แล้วกด Deploy
4. LINE Developers Console → channel → แท็บ **Messaging API** → ตั้ง **Webhook URL** เป็น `https://<โดเมนของคุณ>/eve/v1/line` กด **Verify** แล้วเปิด **Use webhook** · ปิด **Auto-reply messages** และ **Greeting messages** ไม่อย่างนั้นข้อความอัตโนมัติของ LINE จะตอบแข่งกับบอท
5. (ไม่บังคับ) ให้นัดเดโมเข้า Salesforce: ทำตาม[ตั้งค่า Salesforce](#ตั้งค่า-salesforce)
6. (ไม่บังคับ) ให้แจ้งทีมขายในกลุ่ม LINE: ทำตาม[ตั้งค่ากลุ่ม LINE ทีมขาย](#ตั้งค่ากลุ่ม-line-ทีมขาย)
7. กด **Redeploy** หลังเพิ่มตัวแปร แล้วแอดบอทเป็นเพื่อนด้วย QR code ในแท็บ Messaging API และลองทัก

#### ช่องที่ต้องกรอกตอน Deploy

| ช่อง | คืออะไร | เอามาจากไหน |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | token ส่งข้อความของ LINE channel | LINE Developers Console → channel → แท็บ Messaging API → **Channel access token (long-lived)** → Issue |
| `LINE_CHANNEL_SECRET` | ใช้ตรวจลายเซ็น webhook | LINE Developers Console → channel → แท็บ Basic settings → **Channel secret** |
| `ANTHROPIC_API_KEY` | key ของ model ที่บอทใช้ตอบ (`agent/agent.ts` เรียก Anthropic ตรง) | [Claude Console](https://console.anthropic.com/settings/keys) → API keys → Create key |

ตั้งแต่ ก.ย. 2567 สร้าง Messaging API channel ใน LINE Developers Console ตรงๆ ไม่ได้แล้ว ต้องสร้าง LINE Official Account ใน [LINE Official Account Manager](https://manager.line.biz/) ก่อน แล้วเปิด Messaging API จากในนั้น

### ตั้งค่า Salesforce

ไม่ตั้ง บอทยังรับนัดได้ แต่คำขอเก็บเป็นไฟล์ (`.data/demo-requests.jsonl` ในเครื่อง หรือ `/tmp` และ log บน Vercel) ทุกอย่างที่ org ต้องมีอยู่ใน `salesforce/` (Salesforce DX project) ทำครั้งเดียวโดย admin ของ org:

1. **สร้าง integration user** Setup → Users → New User · license *Salesforce Integration* · profile *Minimum Access - API Only Integrations* แล้วเพิ่ม permission set license *Salesforce API Integration* ห้ามใช้ admin
2. **Deploy**
   ```bash
   cd salesforce
   SF_RUN_AS_USERNAME=<integration username> sf project deploy start --source-dir force-app -o <org>
   sf org assign permset -n M_Intel_LINE_Agent_Integration -b <integration username> -o <org>
   ```
3. **ให้ทีมขายเห็นข้อมูลนัด** assign `M Intel LINE Agent - Sales` ให้ทีมขาย และเพิ่มช่อง Demo ทั้ง 4 ช่องใน Lead page layout
4. **คัดลอก credential** Setup → External Client App Manager → M Intel LINE Agent → Settings → OAuth Settings → *Consumer Key and Secret* ได้ `SALESFORCE_CLIENT_ID` และ `SALESFORCE_CLIENT_SECRET` ส่วน `SALESFORCE_LOGIN_URL` คือ My Domain URL ของ org
5. **เช็คการแจก Lead** ถ้าไม่มี Lead assignment rule ที่ active ทุก Lead จะค้างอยู่กับ integration user · ถ้า Lead Source เป็น restricted picklist ให้เพิ่มค่า `LINE` หรือตั้ง `SALESFORCE_LEAD_SOURCE`
6. **ให้บอทแก้ Lead ที่แจกให้เซลแล้วได้** ถ้า Lead sharing เป็น *Private* หรือ *Public Read Only* ให้ใส่ integration user ในกลุ่ม แล้วสร้าง criteria-based sharing rule: Lead Source = `LINE` แชร์ให้กลุ่มนั้นแบบ *Read/Write* ถ้าไม่ทำ ตอนนัดวันในกลุ่ม LINE จะขึ้นว่า Salesforce ไม่รับ

| ช่องใน Lead | มาจากไหน |
|---|---|
| First Name, Last Name, Company, Email, Phone | ข้อมูลที่ลูกค้าให้ |
| Lead Source | `LINE` หรือ `SALESFORCE_LEAD_SOURCE` |
| Demo Reference | เลขอ้างอิงที่ลูกค้าได้ ห้ามซ้ำ |
| Demo Preferred Date | วันที่ลูกค้าสะดวก อัปเดตเมื่อขอเลื่อน |
| Demo Status | `Requested` → `Scheduled` → `Confirmed` หรือ `Reschedule Requested` |
| Demo Date | วันเวลาที่ทีมขายนัดในกลุ่ม LINE |
| Description | เลขอ้างอิง เรื่องที่สนใจ วันเวลาที่สะดวก หมายเหตุ ชื่อและ ID ใน LINE |

ถ้า log ขึ้น `client credentials flow not enabled` แปลว่าเปิด flow นี้ไว้ที่เดียว ต้องเปิดทั้ง OAuth Settings และ OAuth Policies · `no client credentials user enabled` แปลว่ายังไม่ได้ตั้ง Run As user

### ตั้งค่ากลุ่ม LINE ทีมขาย

1. LINE Developers Console → แท็บ Messaging API → **Allow bot to join group chats** → Edit (เปิด LINE Official Account Manager) → ให้รับคำเชิญเข้ากลุ่มและแชตกลุ่ม
2. แอดบอทเป็นเพื่อน แล้วเชิญเข้ากลุ่มทีมขาย บอทจะตอบ group ID ในกลุ่ม
3. ตั้ง `LINE_SALES_GROUP_ID` เป็น ID นั้นใน Vercel แล้ว **Redeploy**

ตั้งแล้ว บอทจะออกจากกลุ่มอื่นที่ถูกเชิญเอง เพราะบอทตอบลูกค้าแบบตัวต่อตัวเท่านั้น · ข้อมูลติดต่อลูกค้าขึ้นในกลุ่มนี้ จึงควรมีแต่ทีมขาย

### การทำงาน

```
ลูกค้า ── LINE ──▶ /eve/v1/line ── adapter: ตรวจลายเซ็น · เก็บ reply token ใน Redis
                        │
                        ├─ คำสั่ง ! · ปุ่มการ์ดสำเร็จรูป · การ์ดนัดทีละขั้น ──▶ ตอบทันที ไม่ผ่าน AI
                        │
                        └─ eve agent ── offer_demo_form · show_demo_summary · record_demo_request
                                                                   │
ลูกค้า ◀── คำตอบ + การ์ด (reply) ◀─────────────┘           Salesforce Lead
                                                                   │
กลุ่ม LINE ทีมขาย ◀── การ์ดคำขอใหม่ ── รับเรื่อง · นัดวัน ──▶ ลูกค้ายืนยัน / ขอเลื่อน ──▶ อัปเดต Lead
```

### ค่าใช้จ่าย

**LINE:** ตอบด้วย reply ไม่เสียโควตา ส่วน push นับโควตารายเดือนของแพ็กเกจ LINE OA บอทนี้ push ใน 4 กรณี: คำตอบแรกของแชตใหม่ (การ์ดต้อนรับใช้ reply ไปแล้ว), การ์ดคำขอใหม่เข้ากลุ่ม, คำตอบของลูกค้าเข้ากลุ่ม และวันนัดถึงลูกค้า **push เข้ากลุ่มนับตามจำนวนสมาชิก** กลุ่ม 10 คน นัด 1 ครั้งที่ลูกค้ายืนยันใช้ประมาณ 21 ข้อความ ดูโควตาที่เหลือได้ใน LINE Official Account Manager

**AI model:** คิดตามจำนวน token ของ Anthropic **ยังไม่ได้วัดจากการใช้งานจริง** คำสั่ง ! ปุ่มการ์ดสำเร็จรูป และการ์ดนัดทีละขั้นไม่เรียก model

**บริการอื่น:** Vercel แพ็กเกจ Hobby ใช้ทดลองได้ แต่ใช้เชิงพาณิชย์ต้องเป็น Pro ขึ้นไป · Upstash Redis มีแพ็กเกจฟรีสำหรับทดลอง ดูราคาและขีดจำกัดล่าสุดที่เว็บผู้ให้บริการ

### คำสั่งโชว์ฟีเจอร์

| กลุ่ม | คำสั่ง |
|---|---|
| การ์ด | `!card` `!buttons` `!table_card` |
| ปฏิทินและปุ่มลัด | `!date_picker` `!time_picker` `!datetime_picker` `!quickreply` |
| ข้อความ LINE แบบต่างๆ | `!flex` `!template` `!confirm` `!carousel` `!image_carousel` `!sticker` `!image` `!location` |
| คำตอบและอื่นๆ | `!markdown` `!table` `!wide_table` `!code` `!blockquote` `!long` `!emoji` `!sender` `!quote` `!loading` |

ปุ่มลัด จุดโหลด และปุ่มคัดลอก ใช้ได้เฉพาะในแอป LINE บนมือถือ

### Environment variables

ดูคำอธิบายครบทุกตัวใน [`.env.example`](.env.example) · **ห้าม commit `.env.local` หรือค่าจริงลง repo**

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | ✓ | ส่งข้อความ LINE |
| `LINE_CHANNEL_SECRET` | ✓ | ตรวจลายเซ็น webhook |
| `ANTHROPIC_API_KEY` | ✓ | model ที่บอทใช้ตอบ |
| `REDIS_URL` | ✓ บน Vercel | reply token, สถานะแชต และการนัด ถ้าไม่มี ระบบใช้หน่วยความจำชั่วคราว ข้อมูลหายทุกครั้งที่ function เริ่มใหม่ และคำตอบกลายเป็น push |
| `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` | สำหรับ Salesforce | ต้องครบ 3 ตัว ถ้าไม่ครบ คำขอนัดเก็บเป็นไฟล์แทน |
| `SALESFORCE_LEAD_SOURCE` | | ค่า Lead Source ของ Lead (ค่าเริ่มต้น `LINE`) |
| `LINE_SALES_GROUP_ID` | สำหรับกลุ่มทีมขาย | group ID ของกลุ่มทีมขาย ถ้าไม่ตั้ง คำขอยังบันทึกได้ แต่ไม่แจ้งกลุ่ม |
| `LINE_BOT_USER_ID` | | user ID ของบอท ปกติระบบหาเองจาก LINE |
| `DEMO_REQUESTS_FILE` | | ไฟล์เก็บคำขอนัดเมื่อไม่ได้ตั้ง Salesforce |

แก้ตัวแปรใน Vercel แล้วต้อง **Redeploy** ถึงจะมีผล

### รันในเครื่อง

ต้องใช้ **Node.js 24**

```bash
npm install
cp .env.example .env.local                      # กรอกค่าจริง
npm run dev                                     # eve dev ที่ http://127.0.0.1:2000
cloudflared tunnel --url http://localhost:2000  # LINE เรียกได้เฉพาะ HTTPS (หรือ ngrok http 2000)
```

แล้วตั้ง Webhook URL ของ channel เป็น `https://<tunnel>/eve/v1/line`

| คำสั่ง | |
|---|---|
| `npm run dev` | เปิดบอทในเครื่อง |
| `npm run typecheck` | ตรวจ type |
| `npm run build` | build ด้วย eve |
| `npm run deploy` | deploy ขึ้น Vercel production (`eve deploy`) |
| `npm run probe` | ส่ง webhook ที่เซ็นแบบ LINE เข้าบอทในเครื่อง ไม่ต้องมีบัญชี LINE |
| `npm run leads` | ดูคำขอนัดที่เก็บเป็นไฟล์ในเครื่อง |

วิธีทดสอบทุกระดับอยู่ใน [TESTING.md](TESTING.md)

### โครงสร้างโปรเจกต์

```
agent/
  agent.ts                  เลือก model
  instructions.md           ตัวตน น้ำเสียง กฎห้าม และขั้นตอนนัดเดโม
  instructions/             ข้อมูลบริษัท บริการ และตัวอย่างลูกค้า (10-company, 20-services, 30-use-cases)
  channels/
    line.ts                 ช่องทาง LINE: การ์ดต้อนรับ ปุ่ม การเข้ากลุ่ม และแนบการ์ดไปกับคำตอบ
    eve.ts                  ช่องทาง HTTP ของ eve
  tools/
    offer_demo_form.ts      แนบการ์ดนัดเดโมใบแรกไปกับคำตอบ
    show_demo_summary.ts    แนบการ์ดสรุปให้ลูกค้ายืนยัน แก้ไข หรือยกเลิก
    record_demo_request.ts  บันทึกคำขอเป็น Salesforce Lead และแจ้งกลุ่มทีมขาย
  lib/
    line.ts                 LINE adapter และ state store ที่ช่องทางกับ tool ใช้ร่วมกัน
    demo-booking.ts         การ์ดของลูกค้า การ์ดของกลุ่มทีมขาย และทุกขั้นหลังได้ Lead
    demo-details.ts         ข้อมูลคำขอนัดและการตรวจค่าที่ tool ทั้งสองใช้ร่วมกัน
    salesforce.ts           login สร้าง Lead และอัปเดตช่อง Demo ผ่าน REST API
    line-cards.ts           การ์ดสำเร็จรูปและปุ่มลัด (เนื้อหาตรงกับ agent/instructions/)
    showcase.ts             คำสั่ง !
salesforce/                 metadata ของ org: External Client App, ช่องใน Lead, permission set
scripts/                    probe-webhook.mjs, list-demo-requests.mjs
vendor/                     LINE adapter (@m-intelligence/chat-adapter-line 0.2.0)
.env.example                รายชื่อตัวแปรทั้งหมด
```

### ข้อจำกัด

- **เครื่องมือที่ติดมากับ eve ยังเปิดอยู่** (`bash`, `read_file`, `write_file`, `web_fetch`, `web_search`, `agent`) ก่อนใช้งานจริงควรปิดด้วย `disableTool()` ใน `agent/tools/<ชื่อ>.ts` ให้เหลือเฉพาะเครื่องมือนัดเดโม
- **ข้อมูลบริษัทเป็น snapshot** จากเว็บไซต์เมื่อ ก.ย. 2569 แก้ข้อมูลต้องแก้ทั้ง `agent/instructions/` และ `agent/lib/line-cards.ts`
- **กลุ่มทีมขายได้กลุ่มเดียว** และ org ที่ Lead sharing เป็น Private ต้องตั้ง sharing rule ก่อนบอทจึงแก้ Lead ได้
- **คำตอบแรกของแชตใหม่เป็น push** เพราะการ์ดต้อนรับใช้ reply token ของข้อความแรกไปแล้ว
- **ยังไม่มีชุดเทสต์อัตโนมัติใน repo นี้** (adapter มีเทสต์ของตัวเอง) และยังไม่มีแจ้งเตือนเมื่อระบบมีปัญหา

### ร่วมพัฒนา

ยินดีรับ issue และ pull request ก่อนส่ง PR ให้รัน `npm run typecheck` และ `npm run build` ให้ผ่าน ถ้าเป็นการเปลี่ยนแปลงใหญ่ ให้เปิด issue คุยกันก่อน · ห้าม commit key หรือ `.env.local`

### สัญญาอนุญาต

เผยแพร่ภายใต้ [MIT License](LICENSE) © 2026 mintelligence-dev  
นำไปใช้ แก้ไข และใช้เชิงพาณิชย์ได้ โดยต้องคงข้อความลิขสิทธิ์และสัญญาอนุญาตไว้ในสำเนาทุกชุด ซอฟต์แวร์นี้ให้ "ตามสภาพ" ไม่มีการรับประกันใดๆ

---

## English

### What it does

1. **Answers customers on LINE** about the company, its services and published customer cases, in the language they write in, from the content in `agent/instructions/`. Short answers are plain text; answers with several headings or a table become Flex cards.
2. **Welcome card and ready-made cards:** a first message gets a card with Services / Customer cases / Contact sales, answered at once without the model, and quick-reply chips sit under every answer.
3. **Books demos:** three small cards, one at a time (topic → a day on LINE's calendar → part of the day) → a summary card to **confirm / edit / cancel** → a **Salesforce Lead**, with a card carrying the reference code for the customer.
4. **Sales schedule from a LINE group:** each new request is posted as a card in the sales team's group with **Take it** / **Book a date** / **Open the Lead in Salesforce**. Once booked, the customer gets a card to **confirm** or **ask for another day**, and the Lead follows every step.
5. **Showcase commands:** a message starting with `!` is answered with a ready-made sample, no model involved, covering every message type LINE can show (`!help` for the menu).
6. **Never quotes prices or invents facts:** anything it has no information on, or a request for a person, goes to the sales team's contact details.

### Safeguards

| Rule | How it is enforced |
|---|---|
| Forged webhooks are rejected | The adapter checks `x-line-signature` with `LINE_CHANNEL_SECRET`. Events LINE redelivers are dropped by `webhookEventId` in Redis. |
| The agent never quotes prices, invents facts, makes promises for the company, or asks for sensitive data | Rules in `agent/instructions.md`. Company facts come only from `agent/instructions/`; nothing is fetched from the web at answer time. |
| One request never becomes two Leads | Only the newest summary can be confirmed, and only once (`formTap()`). The reference code is derived from the tool call, so a replay gets the same one. `Demo_Reference__c` is unique in Salesforce. |
| Nobody else can press the booking buttons | Booking controls work only in the `LINE_SALES_GROUP_ID` group, and the confirm buttons only for the request's own customer (`handleBookingAction()`). The bot leaves any other group it is invited to. |
| Salesforce access is minimal | Signs in as an integration user with OAuth client credentials. Its permission set can create and edit Leads, never delete them, and opens no other object. |
| A Salesforce outage never misleads the customer | If saving fails, the agent gives no reference code and offers the sales email instead, and the whole request is logged for manual entry. If Salesforce refuses a booked date, the customer is not told and the group sees why. |
| LINE quota is not wasted | Reply tokens live in Redis, so answers go out as free replies even from a different function. Cards a tool asks for ride on the same reply (`takeAttachments()`). Pushes carry an `X-Line-Retry-Key`, so a retry never delivers twice. |

### Deploying

1. Click **Deploy with Vercel** above and sign in.
2. Under **Add Products → Storage**, click **Add** on Upstash to create a Redis database (free plan works) or connect an existing one; `REDIS_URL` is set for you. Pick the same region as your functions (Vercel's default is Washington, D.C., `iad1`).
3. Fill in the 3 values (see [the table below](#values-asked-for-on-deploy)) and deploy.
4. In LINE Developers Console → your channel → **Messaging API**, set the **Webhook URL** to `https://<your-domain>/eve/v1/line`, press **Verify**, and turn on **Use webhook**. Turn off **Auto-reply messages** and **Greeting messages**, or LINE's canned replies will compete with the bot.
5. (Optional) To save demo requests in Salesforce, follow [Setting up Salesforce](#setting-up-salesforce).
6. (Optional) To post requests to the sales team, follow [Setting up the sales team's LINE group](#setting-up-the-sales-teams-line-group).
7. **Redeploy** after adding variables, then add the bot as a friend with the QR code on the Messaging API tab and say hello.

#### Values asked for on deploy

| Variable | What it is | Where to get it |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | Token for sending LINE messages | LINE Developers Console → channel → Messaging API → **Channel access token (long-lived)** → Issue |
| `LINE_CHANNEL_SECRET` | Verifies webhook signatures | LINE Developers Console → channel → Basic settings → **Channel secret** |
| `ANTHROPIC_API_KEY` | Key for the model the bot answers with (`agent/agent.ts` calls Anthropic directly) | [Claude Console](https://console.anthropic.com/settings/keys) → API keys → Create key |

Since September 2024 a Messaging API channel can no longer be created directly in LINE Developers Console: create a LINE Official Account in [LINE Official Account Manager](https://manager.line.biz/) and enable the Messaging API from there.

### Setting up Salesforce

Without it the bot still takes demo requests, but keeps them in a file (`.data/demo-requests.jsonl` locally, or `/tmp` plus the log on Vercel). Everything the org needs is in `salesforce/`, a Salesforce DX project. Once, as an org admin:

1. **Create the integration user.** Setup → Users → New User, license *Salesforce Integration*, profile *Minimum Access - API Only Integrations*, then add the permission set license *Salesforce API Integration*. Never use an admin.
2. **Deploy:**
   ```bash
   cd salesforce
   SF_RUN_AS_USERNAME=<integration username> sf project deploy start --source-dir force-app -o <org>
   sf org assign permset -n M_Intel_LINE_Agent_Integration -b <integration username> -o <org>
   ```
3. **Let sales see the booking.** Assign `M Intel LINE Agent - Sales` to the sales team and add the four Demo fields to the Lead page layout.
4. **Copy the credentials.** Setup → External Client App Manager → M Intel LINE Agent → Settings → OAuth Settings → *Consumer Key and Secret* give `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`; the org's My Domain URL is `SALESFORCE_LOGIN_URL`.
5. **Check routing.** Without an active Lead assignment rule, every Lead stays with the integration user. If Lead Source is a restricted picklist, add `LINE` to it or set `SALESFORCE_LEAD_SOURCE`.
6. **Let the bot edit Leads handed to sales.** With a *Private* or *Public Read Only* Lead sharing model, put the integration user in a public group and add a criteria-based sharing rule: Lead Source equals `LINE`, shared with that group as *Read/Write*. Without it, booking a date in the LINE group answers that Salesforce refused the update.

| Lead field | Filled from |
|---|---|
| First Name, Last Name, Company, Email, Phone | What the customer gave |
| Lead Source | `LINE`, or `SALESFORCE_LEAD_SOURCE` |
| Demo Reference | The customer's reference code; unique |
| Demo Preferred Date | The customer's preferred day; updated when they ask for another |
| Demo Status | `Requested` → `Scheduled` → `Confirmed` or `Reschedule Requested` |
| Demo Date | The date and time sales booked in the LINE group |
| Description | Reference, topic, preferred day and time, note, LINE name and user ID |

`client credentials flow not enabled` in the log means the flow is on in only one of OAuth Settings and OAuth Policies; `no client credentials user enabled` means the Run As user is missing.

### Setting up the sales team's LINE group

1. LINE Developers Console → Messaging API → **Allow bot to join group chats** → Edit (opens LINE Official Account Manager) → accept invitations to groups and multi-person chats.
2. Add the bot as a friend and invite it to the sales group. It replies with the group ID.
3. Set `LINE_SALES_GROUP_ID` to that ID in Vercel and **Redeploy**.

Once it is set, the bot leaves any other group it is invited to, since it only talks to customers one to one. Customer contact details are posted in this group, so keep it to the sales team.

### How it works

```
customer ── LINE ──▶ /eve/v1/line ── adapter: signature check · reply token kept in Redis
                          │
                          ├─ ! commands · ready-made card buttons · demo form steps ──▶ answered at once, no model
                          │
                          └─ eve agent ── offer_demo_form · show_demo_summary · record_demo_request
                                                                     │
customer ◀── answer + cards (reply) ◀───────────┘             Salesforce Lead
                                                                     │
sales LINE group ◀── new request card ── take it · book a date ──▶ customer confirms / asks for another day ──▶ Lead updated
```

### Costs

**LINE:** replies are free; pushes count against the LINE Official Account plan's monthly quota. This bot pushes in four cases: the first answer in a new chat (the welcome card used the reply), the new-request card to the group, the customer's answer to the group, and the booked date to the customer. **A push to a group counts once per member:** with ten people in the group, one booking the customer confirms uses about 21 messages. LINE Official Account Manager shows how much is left.

**Model:** Anthropic charges per token; **not yet measured from live use**. `!` commands, ready-made card buttons and the demo form steps never call the model.

**Other services:** the Vercel Hobby plan is fine for trying it out, but commercial use requires Pro. Upstash Redis has a free tier for testing; check each provider for current prices and limits.

### Showcase commands

| Group | Commands |
|---|---|
| Cards | `!card` `!buttons` `!table_card` |
| Pickers and quick replies | `!date_picker` `!time_picker` `!datetime_picker` `!quickreply` |
| LINE message types | `!flex` `!template` `!confirm` `!carousel` `!image_carousel` `!sticker` `!image` `!location` |
| Answers and more | `!markdown` `!table` `!wide_table` `!code` `!blockquote` `!long` `!emoji` `!sender` `!quote` `!loading` |

Quick replies, the loading animation and the clipboard action work in the LINE mobile apps only.

### Environment variables

Every variable is described in [`.env.example`](.env.example). **Never commit `.env.local` or real values.** Required: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `ANTHROPIC_API_KEY`, and on Vercel `REDIS_URL` (without it state lives in memory, is lost on every cold start, and answers turn into pushes). For Salesforce: all three of `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` (otherwise requests go to a file), plus optional `SALESFORCE_LEAD_SOURCE` (default `LINE`). For the sales group: `LINE_SALES_GROUP_ID` (otherwise requests are saved but no group is told). Optional: `LINE_BOT_USER_ID` (normally looked up from LINE) and `DEMO_REQUESTS_FILE` (where requests go without Salesforce). Changes in Vercel take effect after a **Redeploy**.

### Running locally

Requires **Node.js 24**.

```bash
npm install
cp .env.example .env.local                      # fill in real values
npm run dev                                     # eve dev on http://127.0.0.1:2000
cloudflared tunnel --url http://localhost:2000  # LINE only calls HTTPS (or: ngrok http 2000)
```

Then set the channel's Webhook URL to `https://<tunnel>/eve/v1/line`.

| Command | |
|---|---|
| `npm run dev` | Run the bot locally |
| `npm run typecheck` | Type-check |
| `npm run build` | Build with eve |
| `npm run deploy` | Deploy to Vercel production (`eve deploy`) |
| `npm run probe` | Send a LINE-signed webhook to the local bot, no LINE account needed |
| `npm run leads` | List demo requests kept in the local file |

Every level of testing is described in [TESTING.md](TESTING.md).

### Project layout

```
agent/
  agent.ts                  model selection
  instructions.md           identity, tone, hard rules, and the demo booking steps
  instructions/             company, services and customer cases (10-company, 20-services, 30-use-cases)
  channels/
    line.ts                 the LINE channel: welcome card, buttons, group joins, cards attached to answers
    eve.ts                  eve's HTTP channel
  tools/
    offer_demo_form.ts      attaches the first demo form card to the answer
    show_demo_summary.ts    attaches the summary to confirm, edit, or cancel
    record_demo_request.ts  saves the request as a Salesforce Lead and tells the sales group
  lib/
    line.ts                 the LINE adapter and state store shared by the channel and tools
    demo-booking.ts         the customer's cards, the sales group's cards, and every step after the Lead
    demo-details.ts         what a demo request holds, and the checks both demo tools share
    salesforce.ts           sign-in, Lead creation, and Demo field updates over the REST API
    line-cards.ts           ready-made cards and quick replies (mirrors agent/instructions/)
    showcase.ts             the ! commands
salesforce/                 org metadata: External Client App, Lead fields, permission sets
scripts/                    probe-webhook.mjs, list-demo-requests.mjs
vendor/                     the LINE adapter (@m-intelligence/chat-adapter-line 0.2.0)
.env.example                every environment variable
```

### Tech stack

[eve](https://eve.dev) · Vercel AI SDK 7 with Anthropic · Vercel [Chat SDK](https://chat-sdk.dev) 4 with `@m-intelligence/chat-adapter-line` · LINE Messaging API · Upstash Redis (`@chat-adapter/state-redis`) · Salesforce REST API · Zod 4 · TypeScript 7

### Limitations

- **eve's default tools are still on** (`bash`, `read_file`, `write_file`, `web_fetch`, `web_search`, `agent`). Before production, turn them off with `disableTool()` in `agent/tools/<name>.ts`, leaving only the demo tools.
- **The company knowledge is a snapshot** of the website from September 2026; update both `agent/instructions/` and `agent/lib/line-cards.ts` together.
- **One sales group only**, and an org with a Private Lead sharing model needs a sharing rule before the bot can edit Leads.
- **The first answer in a new chat is a push**, because the welcome card used that message's reply token.
- **No automated test suite in this repo yet** (the adapter has its own), and no alerting when something breaks.

### Contributing

Issues and pull requests are welcome. Please make sure `npm run typecheck` and `npm run build` pass before opening a PR, and open an issue first for larger changes. Never commit keys or `.env.local`.

## License

Released under the [MIT License](LICENSE). Copyright © 2026 mintelligence-dev.
