import { CommandContext, Context } from "grammy";

export async function helpCommand(ctx: CommandContext<Context>) {
  await ctx.reply(
    `🎮 *WeezWager — Stack & Win*\n\n` +
    `Challenge friends to Stack, wager crypto, winner takes all!\n\n` +
    `*Commands:*\n` +
    `/wager @user amount — Challenge someone\n` +
    `/pool description 24h — Create a pool\n` +
    `/status — View your wagers\n` +
    `/status 42 — Check specific wager\n` +
    `/cancel 42 — Cancel a wager\n` +
    `/link — Connect your wallet\n` +
    `/balance — Check your balance\n` +
    `/help — Show this message\n\n` +
    `*How it works:*\n` +
    `1️⃣ Challenge a friend with /wager\n` +
    `2️⃣ Both deposit stakes in the app\n` +
    `3️⃣ Play the Stack game\n` +
    `4️⃣ Higher score wins the pot!`,
    { parse_mode: "Markdown" }
  );
}
