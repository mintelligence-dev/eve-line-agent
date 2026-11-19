/**
 * LINE channel.
 *
 * Bridges the LINE Messaging API to this agent through the Chat SDK channel:
 * the adapter owns LINE auth, webhook signature verification, and delivery,
 * while eve owns session dispatch, typing, and the reply.
 *
 * Webhook URL: POST https://<deployment>/eve/v1/line
 */

import {
  decodeThreadId,
  lineText,
  withQuickReplies,
} from "@m-intelligence/chat-adapter-line";
import type { ActionEvent, CardElement, Message, Thread } from "chat";
import { chatSdkChannel } from "eve/channels/chat-sdk";
import {
  demoFormStart,
  FORM_ACTION_PREFIX,
  formTap,
  handleBookingAction,
  takeAttachments,
} from "../lib/demo-booking";
import { line, state } from "../lib/line";
import { askPrompts, DEMO_ACTION_ID, followUps, infoCards } from "../lib/line-cards";
import { handleShowcaseAction, runShowcaseCommand } from "../lib/showcase";

export const { bot, channel, send } = chatSdkChannel({
  adapters: { line },
  events: {
    /**
     * eve's default posts the answer as Markdown. Rendering it through the
     * adapter instead gives the same result — plain text for short answers,
     * a Flex card when the answer has headings or a table — plus quick-reply
     * chips under it, and any demo card a tool queued this turn (the form,
     * the summary to confirm, the saved request).
     */
    async "message.completed"(event, context) {
      if (event.finishReason === "tool-calls" || !event.message) {
        return;
      }
      if (!context.thread) {
        return;
      }
      const messages = await line.renderLineMessages({
        markdown: event.message,
      });
      const { sourceId, sourceType } = decodeThreadId(context.thread.id);
      if (sourceType === "user") {
        messages.push(...(await takeAttachments(sourceId)));
      }
      const last = messages.at(-1);
      if (!last) {
        return;
      }
      messages[messages.length - 1] = withQuickReplies(last, followUps());
      await line.sendLineMessages(context.thread.id, messages);
    },
  },
  // LINE has no message-edit API, so a streamed reply cannot be edited in
  // place. One post per turn is the only shape the platform supports.
  streaming: false,
  state,
  userName: "M Intelligence",
});

/**
 * The LINE user behind a turn, as eve session auth.
 *
 * The adapter has already verified the webhook signature, so the user ID is
 * LINE's own. Tools read it from `ctx.session.auth.current`; the demo-request
 * tool stores it so sales can follow up in the same chat.
 */
function lineCaller(author: { fullName?: string; userId: string }) {
  const attributes: Record<string, string> = {};
  if (author.fullName) {
    attributes.displayName = author.fullName;
  }
  return {
    attributes,
    authenticator: "line",
    principalId: author.userId,
    principalType: "user",
  };
}

/** Quick-start card shown when someone first messages the account. */
const welcomeCard: CardElement = {
  children: [
    {
      content:
        "สอบถามเรื่อง Salesforce, Marketing Cloud, NetSuite หรือระบบ Contact Center ได้เลยครับ",
      type: "text",
    },
    {
      children: [
        { id: "services", label: "ดูบริการ", style: "primary", type: "button" },
        { id: "use-cases", label: "ตัวอย่างลูกค้า", type: "button" },
        { id: "contact-sales", label: "ติดต่อทีมขาย", type: "button" },
      ],
      type: "actions",
    },
  ],
  subtitle: "ผู้ช่วยตอบคำถามเรื่องบริการของเรา",
  title: "M Intelligence",
  type: "card",
};

/** Thread state: whether this conversation has already seen the welcome card. */
interface LineThreadState extends Record<string, unknown> {
  greeted?: boolean;
}

/**
 * A first message from someone new: greet, then let the agent answer it.
 *
 * A showcase command ("!help", "!date_picker", …) is answered without the
 * agent and does not subscribe the thread, so the next ordinary message still
 * gets the welcome card.
 */
bot.onDirectMessage(async (thread: Thread<LineThreadState>, message: Message) => {
  if (await runShowcaseCommand(line, thread, message)) {
    return;
  }

  const state = await thread.state;

  if (!state?.greeted) {
    await thread.post({ card: welcomeCard, fallbackText: "M Intelligence" });
    await thread.setState({ greeted: true });
  }

  await thread.subscribe();
  await send(message.text, {
    auth: lineCaller(message.author),
    thread,
    title: "LINE enquiry",
  });
});

/** Follow-up messages in a thread the agent is already subscribed to. */
bot.onSubscribedMessage(async (thread: Thread, message: Message) => {
  if (await runShowcaseCommand(line, thread, message)) {
    return;
  }
  await send(message.text, { auth: lineCaller(message.author), thread });
});

/**
 * Card buttons, quick-reply chips, "Ask more" taps, demo booking controls,
 * and showcase controls.
 *
 * The three welcome-card buttons answer at once with ready-made cards, so
 * they cost no model call. An "Ask more" button on a card, and a tap on the
 * demo form, is turned into what a person would have typed and answered by
 * the agent. Booking controls in the sales group and the customer's answer to
 * a booked date are handled without the agent.
 */
bot.onAction(async (event: ActionEvent) => {
  if (!event.thread) {
    console.warn(`[line] action "${event.actionId}" arrived without a thread`);
    return;
  }

  if (await handleShowcaseAction(line, event)) {
    return;
  }
  if (await handleBookingAction(event)) {
    return;
  }

  if (event.actionId.startsWith(FORM_ACTION_PREFIX)) {
    if (!event.thread.isDM) {
      return;
    }
    const tap = await formTap(event.user.userId, event.actionId, event.value);
    if ("reply" in tap) {
      await line.sendLineMessages(event.thread.id, tap.reply);
      return;
    }
    await send(tap.text, { auth: lineCaller(event.user), thread: event.thread });
    return;
  }

  // "ขอนัดเดโม" opens the demo form at once instead of asking the agent to.
  if (event.actionId === DEMO_ACTION_ID && event.thread.isDM) {
    await line.sendLineMessages(event.thread.id, await demoFormStart(event.user.userId));
    return;
  }

  const card = infoCards[event.actionId];
  if (card) {
    await line.sendLineMessages(
      event.thread.id,
      withQuickReplies(card, followUps(event.actionId))
    );
    return;
  }

  const prompt = askPrompts[event.actionId];
  if (!prompt) {
    // Rich menu and LIFF postbacks reach here too; the adapter passes them
    // through rather than guessing. Log so a stray tap is diagnosable.
    console.warn(`[line] no prompt mapped for action "${event.actionId}"`);
    return;
  }

  await send(prompt, {
    auth: lineCaller(event.user),
    thread: event.thread,
    title: "LINE enquiry",
  });
});

/**
 * The bot joined a group or a multi-person chat.
 *
 * It answers customers one to one only, so the one group it stays in is the
 * sales team's, where demo requests are posted. Until `LINE_SALES_GROUP_ID`
 * is set, joining a group tells the team the ID to set; after that, any other
 * group or chat gets a short note and the bot leaves.
 */
line.onLineEvent("join", async (_event, { threadId }) => {
  if (!threadId) {
    return;
  }
  const { sourceId, sourceType } = decodeThreadId(threadId);
  const salesGroup = process.env.LINE_SALES_GROUP_ID?.trim();

  if (sourceType === "group" && sourceId === salesGroup) {
    await line.sendLineMessages(threadId, lineText("พร้อมแจ้งคำขอเดโมในกลุ่มนี้แล้วครับ"));
    return;
  }
  if (sourceType === "group" && !salesGroup) {
    console.log(`[line] joined group ${sourceId}; set LINE_SALES_GROUP_ID to it to post demo requests there`);
    await line.sendLineMessages(
      threadId,
      lineText(
        `ถ้าจะให้บอทแจ้งคำขอเดโมในกลุ่มนี้ ตั้งค่า LINE_SALES_GROUP_ID=${sourceId} ใน Vercel แล้ว deploy ใหม่ครับ`
      )
    );
    return;
  }
  await line.sendLineMessages(threadId, lineText("บอทนี้ตอบลูกค้าในแชตส่วนตัวเท่านั้น ขอออกจากกลุ่มนี้นะครับ"));
  await line.leaveChat(threadId);
});

export default channel;
