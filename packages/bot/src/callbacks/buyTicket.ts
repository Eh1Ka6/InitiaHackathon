import { Context, InlineKeyboard } from "grammy";
import { config } from "../config";

export async function buyTicketCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const match = data.match(/^buy_ticket:(\d+)$/);
  if (!match) return;

  const drawId = parseInt(match[1]);

  // Ticket purchase requires msg.value == ticketPrice from the buyer's wallet,
  // so we deep-link into the miniapp for signing (same pattern as /wager stake deposits).
  const keyboard = new InlineKeyboard().webApp(
    "🎟️ Confirm & Pay in App",
    `${config.MINIAPP_URL}?startapp=buyticket_${drawId}`
  );

  await ctx.answerCallbackQuery({ text: "Opening ticket purchase…" });
  await ctx.reply(
    `🎟️ Buying a ticket for Draw #${drawId}.\nTap below to confirm and pay in the app 👇`,
    { reply_markup: keyboard }
  );
}
