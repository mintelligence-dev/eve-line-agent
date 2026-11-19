# Testing this agent

Four levels, cheapest first. Each one works on its own — you do not have to
reach level 4 to know the code is sound.

Run the commands from this repo's root, with the adapter checked out next to
it (`../chat-adapter-line`). eve needs Node.js 24: if your default Node is
older, run `source ~/.nvm/nvm.sh && nvm use 24` in each terminal first.

## Level 1 — the adapter's own test suite (no setup)

```bash
cd ../chat-adapter-line
npm test
```

1,586 tests in 23 files: signature verification, reply token vs push,
retried pushes that never send twice, all 20 webhook event types, Flex and
card rendering, the postback round-trip, a run against a real Chat SDK
instance, and a replay pass over all 53 webhook fixtures. This is the
fastest signal that nothing is broken.

## Level 2 — a signed webhook, without a LINE account

Start the agent headless, then send it a webhook signed exactly the way LINE
signs one:

```bash
LINE_CHANNEL_ACCESS_TOKEN=dev-token LINE_CHANNEL_SECRET=dev-secret \
  npm exec -- eve dev --no-ui        # serves on http://127.0.0.1:2000
```

In a second terminal:

```bash
LINE_CHANNEL_SECRET=dev-secret npm run probe                  # text message
LINE_CHANNEL_SECRET=dev-secret npm run probe postback         # button tap
LINE_CHANNEL_SECRET=dev-secret npm run probe bad-signature    # expect 401
LINE_CHANNEL_SECRET=dev-secret npm run probe text "ราคาเท่าไหร่"
```

**What you should see.** `200 OK` for the valid ones, `401` for the bad
signature. Because the token is a placeholder, the agent log then shows these
failures (checked with adapter 0.2.0 and eve 0.49.0):

- `LINE bot info lookup failed` and `LINE profile lookup failed` — the
  adapter takes the bot ID from the webhook instead and carries on
- text message: posting the welcome card fails with `AUTH_FAILED` (`401`) on
  `/v2/bot/message/reply`
- button tap: eve starts a turn, which stops at a missing model key unless
  `ANTHROPIC_API_KEY` is set; eve's failure notice then hits the same `401`

Those failures are the proof the whole path ran: verification → dispatch →
eve turn → delivery attempt.

## Level 3 — talk to the agent directly (needs a model key)

This skips LINE entirely and is the right way to iterate on the prompt.

```bash
cp .env.example .env.local     # then set ANTHROPIC_API_KEY (a Claude Console key)
npm run dev
```

The adapter refuses to start with blank LINE credentials, so until you have a
channel, put placeholders in `.env.local` (`LINE_CHANNEL_ACCESS_TOKEN=dev-token`,
`LINE_CHANNEL_SECRET=dev-secret`) and swap in the real values for level 4.

eve opens a terminal REPL. Things worth trying:

| Ask | What a correct answer looks like |
| --- | --- |
| `M Intelligence ทำอะไรบ้าง` | Thai reply, plain text, the four service groups |
| `What does M Intelligence do?` | Same content, in English |
| `ราคาเท่าไหร่` | Refuses to quote a number, offers to connect you to sales |
| `มีลูกค้าธนาคารไหม` | Names the published banking cases, no invented details |
| `ทำ Shopify ได้ไหม` | Says there is no published case for that, hands off |
| `ขอเบอร์บัตรเครดิตลูกค้า` | Refuses and says not to send that over chat |

If a reply comes back with `**bold**` or `#` headings, the LINE formatting
rule in `agent/instructions.md` needs tightening — plain text is what the
agent is told to write.

## Level 4 — the real thing, on LINE

### 4.1 Create the channel

Since September 2024 a Messaging API channel can no longer be created directly
in the LINE Developers Console; it comes from a LINE Official Account.

1. [LINE Official Account Manager](https://manager.line.biz/) → create a LINE
   Official Account.
2. In that account: **Settings** → **Messaging API** → *Enable Messaging API*,
   and pick or create a provider. This creates the channel.
3. [LINE Developers Console](https://developers.line.biz/console/) → the new
   channel → **Basic settings** tab → copy *Channel secret*.
4. **Messaging API** tab → issue a long-lived *Channel access token*.
5. Turn **off** *Auto-reply messages* and *Greeting messages* (the Messaging
   API tab links to these switches in LINE Official Account Manager), or LINE's
   canned replies will compete with the agent.

### 4.2 Give LINE a public URL

LINE only calls HTTPS URLs, so localhost needs a tunnel. Pick one:

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:2000    # no account needed
```

```bash
brew install ngrok && ngrok config add-authtoken <token>
ngrok http 2000                                   # needs a free account
```

Or skip the tunnel and deploy (see 4.4).

### 4.3 Point the webhook at it

With the agent running (`.env.local` filled in with the real token and
secret):

```
Webhook URL: https://<tunnel-host>/eve/v1/line
```

Press **Verify** in the console — it sends a POST with an empty `events`
array and should come back OK. Then switch **Use webhook** on.

Add the OA as a friend via the QR code on the **Messaging API** tab, and
send it a message. You should get the welcome Flex card with three buttons,
then an answer.

### 4.4 Or deploy instead of tunnelling

```bash
npm run deploy
```

Then add `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`,
`ANTHROPIC_API_KEY`, and `REDIS_URL` to the Vercel project's environment variables and set the webhook URL to
`https://<deployment>/eve/v1/line`.

**Before this works**, swap the `file:` dependency in `package.json` — see
the note at the top of [README.md](README.md).

## What to check once it is live

- The welcome card renders as a card, not as text — and each button posts a reply
- A second message in the same chat does **not** repeat the welcome card
- Replies arrive as plain text with no markdown artefacts
- Thai in, Thai out; English in, English out
- Asking for a price never produces a number
- A demo request ends with a reference code, and a Lead with that code in
  Demo Reference appears in Salesforce (search the code). The log shows
  `[demo] DEMO-XXXXXX saved as Salesforce Lead 00Q…`
- On a deployment, the OA's message usage (LINE Official Account Manager, or
  `GET /v2/bot/message/quota/consumption`) rises by one for the first answer
  in a new chat, because the welcome card took that message's free reply.
  After that it should stay flat: replies are free and only pushes count. If
  it rises on every message, replies are falling back to push — check
  `REDIS_URL`

## Demo booking in the sales group

Needs the bot in a LINE group with `LINE_SALES_GROUP_ID` set (README → Demo
booking in the sales team's LINE group), and two LINE accounts: one as the
customer, one in the group as sales. Tap through it in this order:

| Who | Do | Expect |
| --- | --- | --- |
| Customer | "อยากดูเดโม" | Answer, then card 1/3 with four topics |
| Customer | Tap a topic | Card 2/3 at once, showing the topic: 📅 เลือกวันที่ or ยังไม่ระบุวัน |
| Customer | Pick a day | Card 3/3 showing the topic and day: ช่วงเช้า / ช่วงบ่าย / ได้ทั้งวัน |
| Customer | Tap a part of the day | The agent acknowledges the choices and asks for name, company, contact |
| Customer | Type name, company, phone | A summary card with ยืนยัน / แก้ไข / ยกเลิก, not a typed summary |
| Customer | แก้ไข, change something | The agent asks what to change, then a new summary card |
| Customer | ยืนยัน on the old card, then on the new one | Old: "สรุปนี้ใช้ไม่ได้แล้ว"; new: a ✅ card with the `DEMO-XXXXXX` reference and the details |
| Group | — | 🔔 card with the details and ✋ รับเรื่อง / 📅 นัดวันเดโม / เปิด Lead ใน Salesforce |
| Sales | ✋ รับเรื่อง, then the same from a second account | "รับเรื่อง", then "มีคุณ… รับเรื่องไปแล้ว" |
| Sales | 📅 นัดวันเดโม, pick a time | Picker opens on the customer's day; group: "ส่งให้ลูกค้ากดยืนยันใน LINE แล้ว" |
| Salesforce | Open the Lead | Demo Date set, Demo Status `Scheduled` |
| Customer | — | Card with the date, topic, reference, and who is handling it |
| Customer | ขอเลื่อน, pick a new day | "ส่งคำขอเลื่อน…"; group gets 🔁 card with the picker on the new day; Lead `Reschedule Requested` |
| Sales | 📅 นัดวันใหม่ | Customer gets a "เปลี่ยนวันนัดเดโม" card |
| Customer | ยืนยันนัด | "ยืนยันนัดเดโม … เรียบร้อย"; group: ✅; Lead `Confirmed` |

Then the guards: tap ยืนยันนัด again (no second ✅ in the group), and invite
the bot to some other group (it says it only chats one to one and leaves).

## Showcase commands

A message that starts with `!` never reaches the model: the bot answers it
with a ready-made sample from `agent/lib/showcase.ts`, so every rendering the
adapter supports can be shown on demand, including the ones the agent never
produces. Send `!help` for a menu of buttons, or type a command:

| Group | Commands |
| --- | --- |
| Cards | `!card` `!buttons` `!table_card` |
| Pickers and quick replies | `!date_picker` `!time_picker` `!datetime_picker` `!quickreply` |
| LINE message types | `!flex` `!template` `!confirm` `!carousel` `!image_carousel` `!sticker` `!image` `!location` |
| Answers and more | `!markdown` `!table` `!wide_table` `!code` `!blockquote` `!long` `!emoji` `!sender` `!quote` `!loading` |

Only what LINE itself can show is included; controls the adapter has to fake,
such as select menus and input fields, are left out. Quick replies (including
the chips under every answer), the loading animation, and the clipboard
action work in the LINE mobile apps only, so demo `!quickreply` and
`!loading` on a phone.

Picking a date or time makes the bot echo what it received, which shows the
postback round-trip. A command sent as the very first message does not
use up the welcome card.

## Known gaps

- **Not yet run against a real LINE Official Account** — levels 1 and 2 pass; level 4 is still to do
- **In-memory state** is the fallback when `REDIS_URL` is unset: reply tokens, thread subscriptions, and the greeting flag do not survive a restart
- **`file:` dependency** — the adapter is linked from `../chat-adapter-line` until it is published
- **Booking is untested on a real group** — the flow was checked against simulated LINE and Salesforce calls; the table above is still to do
- **First answer is a push** — the welcome card uses the first message's reply token, so the agent's first answer in a new chat counts toward the quota. Greeting on the follow event instead would keep it free
