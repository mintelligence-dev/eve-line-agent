# M Intelligence LINE agent

An [eve](https://eve.dev) agent that answers customer questions on a **LINE Official Account**, using content from [m-intelligence.tech](https://m-intelligence.tech) as its knowledge.

It is the reference sample for [`@m-intelligence/chat-adapter-line`](https://github.com/NattawutTanthai/chat-adapter-line) — the LINE adapter for [Vercel Chat SDK](https://chat-sdk.dev) — and shows the whole path end to end: LINE webhook → Chat SDK adapter → eve session → reply back in the chat.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNattawutTanthai%2Fm-intel-line-agent&env=LINE_CHANNEL_ACCESS_TOKEN,LINE_CHANNEL_SECRET,REDIS_URL,ANTHROPIC_API_KEY&envDescription=Credentials%20from%20the%20LINE%20Developers%20Console%20and%20the%20Claude%20Console&envLink=https%3A%2F%2Fdevelopers.line.biz%2Fconsole%2F&project-name=m-intel-line-agent&repository-name=m-intel-line-agent)

## What it does

- Greets a new chat with a Flex card offering **ดูบริการ / ตัวอย่างลูกค้า / ติดต่อทีมขาย**
- Answers questions about the company, its services, and published customer use cases — in the language the customer writes in
- Turns each card tap into the question a person would have typed, so there is one conversation path rather than a scripted branch per button
- Refuses to quote prices or invent facts, and hands off to the sales team instead
- Takes demo requests through three small cards, one at a time — topic, a day on LINE's calendar, part of the day — then a summary card to confirm, edit, or cancel, and saves each one as a **Salesforce Lead**, answering with a card of what was saved
- Posts each request to the sales team's **LINE group**, where someone takes it and books the date; the customer confirms or asks for another day from a card in their chat (see [Demo booking in the sales team's LINE group](#demo-booking-in-the-sales-teams-line-group))

## How it fits together

```
LINE  ──POST /eve/v1/line──▶  @m-intelligence/chat-adapter-line
                                      │  (signature check, reply token, Flex)
                                      ▼
                             eve chatSdkChannel  ──▶  agent session
                                      │
                                      ◀── reply posted back to the thread
```

The adapter owns LINE auth, webhook verification, and delivery. eve owns session dispatch, typing indicators, and the model turn. `agent/channels/line.ts` is the only glue.

## One thing to change before sharing this repo

`package.json` currently resolves the adapter from a sibling checkout:

```json
"@m-intelligence/chat-adapter-line": "file:../chat-adapter-line"
```

That works for local development next to the adapter repo, but **the Deploy
button and a plain `git clone` will not resolve it**. Swap it for whichever is
true when you publish:

```json
"@m-intelligence/chat-adapter-line": "^0.2.0"                                 // published to npm
"@m-intelligence/chat-adapter-line": "github:NattawutTanthai/chat-adapter-line" // public repo
```

## Testing

See [TESTING.md](TESTING.md) — four levels from the adapter's own test suite
up to a live LINE Official Account, including a signed webhook probe that
needs no LINE account:

```bash
npm run probe                 # signed text message
npm run probe postback        # button tap
npm run probe bad-signature   # expect 401
```

## Prerequisites

- **Node.js 24 or newer** (eve refuses to start on older versions; with nvm, run `nvm use 24` in each terminal)
- A **LINE Official Account** with the Messaging API enabled — create the account in [LINE Official Account Manager](https://manager.line.biz/) and enable the Messaging API there (channels can no longer be created directly in the [LINE Developers Console](https://developers.line.biz/console/))
- An **Anthropic API key** from the [Claude Console](https://console.anthropic.com/settings/keys): `agent/agent.ts` calls Anthropic directly through `@ai-sdk/anthropic`. To route through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) instead, set `model: "anthropic/claude-sonnet-5"` there; the account then needs a card on file

## Install

```bash
git clone https://github.com/NattawutTanthai/m-intel-line-agent.git
cd m-intel-line-agent
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console → channel → **Messaging API** tab → *Channel access token* (issue a long-lived one) |
| `LINE_CHANNEL_SECRET` | LINE Developers Console → channel → **Basic settings** tab → *Channel secret* |
| `ANTHROPIC_API_KEY` | [Claude Console → API keys](https://console.anthropic.com/settings/keys). Needed locally and on Vercel |
| `REDIS_URL` | Any Redis instance — Upstash, Vercel Marketplace Redis, or a local one. Optional locally, **required in production** (see below) |

In the same console, turn **off** *Auto-reply messages* and *Greeting messages* — otherwise LINE's canned replies compete with the agent.

## Run locally

```bash
npm run dev
```

That opens eve's terminal REPL, where you can talk to the agent without LINE in the loop — the fastest way to iterate on the prompt.

To exercise the real LINE path, expose the dev server and point the webhook at it:

```bash
npm exec -- eve dev --no-ui                     # serves on http://127.0.0.1:2000
cloudflared tunnel --url http://localhost:2000  # or ngrok http 2000
```

Then set the channel's **Webhook URL** to `https://<your-tunnel>/eve/v1/line`, press **Verify**, and enable *Use webhook*.

## Deploy

```bash
npm run deploy
```

`eve deploy` links a Vercel project if needed and deploys to production. Add `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `ANTHROPIC_API_KEY`, and `REDIS_URL` to the project's environment variables, plus the `SALESFORCE_*` variables for demo requests (see [Demo requests go to Salesforce](#demo-requests-go-to-salesforce)) and `LINE_SALES_GROUP_ID` for the sales group (see [Demo booking in the sales team's LINE group](#demo-booking-in-the-sales-teams-line-group)), then set the LINE **Webhook URL** to:

```
https://<your-deployment>/eve/v1/line
```

## Project layout

```
agent/
  agent.ts                  model selection
  instructions.md           identity, tone, and the rules the agent must not break
  instructions/
    10-company.md           company profile scraped from the website
    20-services.md          services and platforms
    30-use-cases.md         published customer use cases
  channels/
    line.ts                 the LINE channel — adapter, welcome card, handlers
    eve.ts                  eve's own HTTP channel (scaffolded)
  tools/
    offer_demo_form.ts      puts the demo form under the agent's reply
    show_demo_summary.ts    puts the summary to confirm, edit, or cancel under the agent's reply
    record_demo_request.ts  saves a demo request as a Salesforce Lead and posts it to the sales group
  lib/
    line.ts                 the LINE adapter and state store, shared by the channel and tools
    demo-booking.ts         the customer's cards, the sales group's cards, and every booking step after the Lead
    demo-details.ts         what a demo request holds, and the checks both demo tools share
    salesforce.ts           sign-in, Lead creation, and demo field updates over the REST API
    line-cards.ts           ready-made Flex cards for the welcome card's buttons
    showcase.ts             the `!` commands that demo each LINE feature
salesforce/                 what the Salesforce org needs: app, fields, permission sets
```

## The knowledge is a snapshot, on purpose

`agent/instructions/` holds content read from the public website in September 2026 and committed as plain markdown. The agent does not crawl at runtime: the reply is fast, it cannot break when the site changes shape, and anyone who clones this repo gets a bot that works immediately.

Refreshing it means editing those three files. Only material that appears on the public site belongs there.

## Why `REDIS_URL` matters here

LINE gives every inbound event a single-use reply token. Replying with it is free; a push message is metered. Handlers reply *after* the webhook has returned — often in a different serverless invocation — so the adapter parks the token in the Chat SDK state store. In-memory state loses it on every cold start, which silently turns every reply into a paid push.

Thread subscriptions, the greeting flag, and demo bookings live in the same store. The channel falls back to in-memory state with a warning when `REDIS_URL` is absent, which is fine while you iterate locally and wrong everywhere else.

## Demo requests go to Salesforce

When a customer asks for a demo, the agent shows the demo form, collects their
details, shows a summary to confirm, and calls `record_demo_request`. With the three
`SALESFORCE_*` variables set, that creates a **Lead** in the company org:

| Lead field | Filled from |
| --- | --- |
| First Name, Last Name | the contact's name, split at the first space |
| Company, Email, Phone | as the customer gave them |
| Lead Source | `LINE`, or `SALESFORCE_LEAD_SOURCE` |
| Demo Reference | the reference code given to the customer; unique, so a replayed request never makes a second Lead |
| Demo Preferred Date | the day the customer picked, if any; updated when they ask for another day |
| Demo Status | `Requested`, then `Scheduled`, `Confirmed` or `Reschedule Requested` as the booking moves on |
| Demo Date | the date and time sales booked in the LINE group |
| Description | reference code, what they want to see, preferred day and time, note, LINE display name and user ID |

The org's active Lead assignment rule picks the owner. Duplicate rules still
flag a returning customer but do not block the save. If Salesforce rejects
the request, the agent apologises and gives the customer the sales email
instead of a reference code, and the whole request goes to the log so it can
be entered by hand. Without the variables, requests stay in
`.data/demo-requests.jsonl` (`npm run leads`).

Everything the org needs is in `salesforce/`, a Salesforce DX project: the
External Client App the agent signs in with (OAuth client credentials), four
**Demo** fields on Lead, and two permission sets. Setting up an org,
once, as a Salesforce admin:

1. **Create the integration user.** Setup → Users → New User, license
   *Salesforce Integration*, profile *Minimum Access - API Only
   Integrations*. On the user, assign the permission set license *Salesforce
   API Integration*. Every Lead is created as this user, so never use an
   admin.
2. **Deploy**, naming that user as the app's Run As user:

   ```bash
   cd salesforce
   SF_RUN_AS_USERNAME=<integration username> sf project deploy start --source-dir force-app -o <org>
   sf org assign permset -n M_Intel_LINE_Agent_Integration -b <integration username> -o <org>
   ```

   `M Intel LINE Agent - Integration` can create and edit Leads and nothing
   else: it cannot delete them or open any other object. The agent only ever
   edits the Demo fields of Leads it created, but the permission covers every
   field the set can write, so keep the client secret as safe as an admin
   password.
3. **Let sales see the booking.** Assign `M Intel LINE Agent - Sales` to the
   sales team and add the four Demo fields to the Lead page layout. Sales can
   read them but not change them: a date changed in Salesforce would never
   reach the customer, so dates are booked in the LINE group.
4. **Copy the credentials.** Setup → External Client App Manager → M Intel
   LINE Agent → Settings → OAuth Settings → *Consumer Key and Secret*. They
   become `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`; the org's
   My Domain URL becomes `SALESFORCE_LOGIN_URL`.
5. **Check routing.** Without an active Lead assignment rule, every Lead stays
   with the integration user. If Lead Source is a restricted picklist, add
   `LINE` to it, or set `SALESFORCE_LEAD_SOURCE` to a value it already has.
6. **Let the agent update Leads it handed to sales.** Once the assignment
   rule gives a Lead to a salesperson, the integration user can only edit it
   if sharing allows. With the Lead sharing model at *Public Read/Write* there
   is nothing to do. With *Private* or *Public Read Only*, put the integration
   user in a public group and add a criteria-based sharing rule on Lead: Lead
   Source equals `LINE` (or your `SALESFORCE_LEAD_SOURCE`), shared with that
   group as *Read/Write*. Without it, booking a date in the LINE group answers
   that Salesforce refused the update, and the customer is not told.

If the log shows `Salesforce sign-in failed: client credentials flow not
enabled`, the app was edited by hand and the flow is on in only one of its
two places, OAuth Settings and OAuth Policies. `no client credentials user
enabled` means the Run As user is missing.

## Demo booking in the sales team's LINE group

Every demo request is posted to one LINE group of the sales team, and the
booking happens there:

1. **The customer asks for a demo.** The agent calls `offer_demo_form`, and
   the channel attaches the first of three small cards under its reply: four
   topics, then LINE's date picker (or "ยังไม่ระบุวัน"), then morning,
   afternoon, or any time. The bot answers each tap with the next card itself,
   showing what was picked so far, and hands the agent all three choices as
   one sentence. Typing the same things works too.
2. **The customer confirms.** With the details in hand the agent calls
   `show_demo_summary`, which attaches a summary card with ยืนยัน, แก้ไข and
   ยกเลิก. The taps reach the agent as sentences too. Only the newest summary
   can be confirmed, and only once, so an old card or a double tap cannot save
   the request twice.
3. **The Lead is created.** The customer gets a card with the reference and
   what was saved, and a card goes to the sales group: name, company, topic,
   preferred day, phone, email, LINE name, and three buttons.
4. **รับเรื่อง** records who took the request. A second person tapping it is
   told who has it.
5. **นัดวันเดโม** opens LINE's date and time picker, starting on the
   customer's day (10:00 for morning, 14:00 for afternoon). The bot writes Demo
   Date and `Scheduled` to the Lead, then sends the customer a card with the
   date, the topic, the reference, and who is handling it. If Salesforce
   refuses the update, the customer is not told and the group sees why. Booking
   again later sends the customer a "date changed" card.
6. **The customer confirms the date or asks for another day.** Confirming sets
   `Confirmed` and tells the group. Asking for another day opens a date
   picker; the new day goes to Demo Preferred Date with `Reschedule
   Requested`, and the group gets a card with the picker on that day.

Only the group can book, and only the customer of a request can answer for
it: a tap from anywhere else is logged and ignored.

**Setting it up**

1. LINE Developers Console → the channel → Messaging API → **Allow bot to
   join group chats** → Edit. It opens LINE Official Account Manager; choose
   to accept invitations to groups and multi-person chats.
2. Invite the account to the sales group. The bot replies with the group ID.
3. Set `LINE_SALES_GROUP_ID` to that ID in Vercel and redeploy. Inviting the
   bot again (or to the right group) now gets "พร้อมแจ้งคำขอเดโมในกลุ่มนี้แล้ว".

Once the variable is set, the bot leaves any other group or multi-person chat
it is invited to, since it only answers customers one to one. Without the
variable, requests are still saved; the log says no group was told.

**What it costs.** Taps in the group and the customer's taps are answered
with reply tokens, which are free. Three things are pushes: the new-request
card and the customer's answer (to the group), and the booked date (to the
customer). LINE counts a push to a group once per member, so with ten people
in the group one booking that the customer confirms uses about 21 of the
month's messages. LINE Official Account Manager shows how much of the plan's
quota is left.

**Personal data.** The group sees the customer's phone, email, and LINE name,
which they gave so sales could contact them. Keep the group to the sales
team.

Bookings live in the state store for 90 days under `m-intel:demo:<reference>`.
The Lead keeps the outcome for good.

## Guardrails worth copying

`agent/instructions.md` forbids the agent from quoting prices, inventing customers or certifications, promising timelines, and asking for sensitive data. For a customer-facing bot these are not polish — they are the difference between a demo and a liability. The instructions also tell the model that **LINE renders no markdown**, so replies come back as plain text rather than `**bold**` noise.

## License

MIT
