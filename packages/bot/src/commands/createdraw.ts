import { CommandContext, Context, InlineKeyboard } from "grammy";
import { api, ApiError } from "../services/api";
import { formatCommunityDrawMessage } from "../services/formatter";
import { parseCreateDrawCommand } from "../utils/parsers";
import { config } from "../config";

const USAGE =
  "Usage: `/createdraw <title> <prize> <ticketPrice> <maxTickets> <durationHours> [winnerCount]`\n" +
  'Example: `/createdraw "Spring Jackpot" 100 1 200 48 3`\n\n' +
  "• Wrap multi-word titles in quotes.\n" +
  "• Title must be ≤ 32 bytes (longer is truncated).\n" +
  "• Prize is staked on-chain by you when you sign.";

export async function createDrawCommand(ctx: CommandContext<Context>) {
  const parsed = parseCreateDrawCommand(ctx.match);
  if (!parsed) {
    await ctx.reply(USAGE, { parse_mode: "Markdown" });
    return;
  }

  try {
    const draw = await api.createCommunityDraw({
      creatorTelegramId: ctx.from!.id.toString(),
      title: parsed.title,
      prizeAmount: parsed.prizeAmount,
      ticketPrice: parsed.ticketPrice,
      maxTickets: parsed.maxTickets,
      durationHours: parsed.durationHours,
      winnerCount: parsed.winnerCount,
      chatId: ctx.chat!.id.toString(),
    });

    if (parsed.titleTruncated) {
      await ctx.reply(
        `⚠️ Title was longer than 32 bytes and was truncated to: *${parsed.title}*`,
        { parse_mode: "Markdown" }
      );
    }

    const creatorName = ctx.from!.username ? `@${ctx.from!.username}` : ctx.from!.first_name;
    const text = formatCommunityDrawMessage(draw, creatorName);

    const startParam = `createdraw_${draw.id}`;
    const keyboard = new InlineKeyboard()
      .webApp("💎 Sign & Stake Prize", `${config.MINIAPP_URL}?startapp=${startParam}`)
      .row()
      .text("🎟️ Buy Ticket", `buy_ticket:${draw.id}`)
      .switchInline("📤 Share to Group", `draw_${draw.id}`);

    await ctx.reply(text, { reply_markup: keyboard, parse_mode: "Markdown" });
  } catch (err: any) {
    if (err instanceof ApiError) {
      // Friendly whitelist-gate message.
      if (
        err.status === 403 ||
        err.code === "NOT_WHITELISTED" ||
        /COMMUNITY_CREATOR_ROLE|whitelist/i.test(err.message)
      ) {
        await ctx.reply(
          "🚫 Community draw creation is whitelisted.\nContact an admin to be added to the creators list."
        );
        return;
      }
    }
    await ctx.reply(`Failed to create draw: ${err.message}`);
  }
}
