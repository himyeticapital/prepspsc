/**
 * Telegram Bot Setup Script
 * Run with: npx ts-node scripts/setup-telegram-bot.ts
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";

const commands = [
  { command: "start", description: "Start the bot & link your account" },
  { command: "plan", description: "📚 Today's study plan" },
  { command: "quiz", description: "🎯 Quick MCQ quiz" },
  { command: "ca", description: "📰 Current affairs briefing" },
  { command: "progress", description: "📊 Your stats & progress" },
  { command: "save", description: "💾 Save a note" },
  { command: "test", description: "📝 Practice mock tests" },
  { command: "room", description: "🧑‍🤝‍🧑 Join study rooms" },
  { command: "rank", description: "🏆 Leaderboard position" },
  { command: "settings", description: "⚙️ Notification settings" },
  { command: "help", description: "❓ Show all commands" },
];

async function setupBot() {
  console.log("🤖 Setting up Telegram Bot...\n");

  // 1. Set bot commands
  console.log("Setting commands...");
  const setCommandsRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    }
  );
  const commandsResult = await setCommandsRes.json();
  console.log("Commands:", commandsResult.ok ? "✅ Set successfully" : "❌ Failed", "\n");

  // 2. Get bot info
  console.log("Getting bot info...");
  const getMeRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const botInfo = await getMeRes.json();
  if (botInfo.ok) {
    console.log(`✅ Bot: @${botInfo.result.username}`);
    console.log(`   Name: ${botInfo.result.first_name}`);
    console.log(`   ID: ${botInfo.result.id}\n`);
  }

  // 3. Check current webhook
  console.log("Checking webhook...");
  const webhookRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const webhookInfo = await webhookRes.json();
  if (webhookInfo.ok) {
    if (webhookInfo.result.url) {
      console.log(`✅ Webhook URL: ${webhookInfo.result.url}`);
    } else {
      console.log("⚠️  No webhook set yet");
      console.log("   After deploying, run:");
      console.log(`   curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=YOUR_DOMAIN/api/bot/webhook"`);
    }
  }

  console.log("\n🎉 Bot setup complete!");
  console.log("\nNext steps:");
  console.log("1. Add TELEGRAM_BOT_TOKEN to .env.local");
  console.log("2. Add GROQ_API_KEY to .env.local");
  console.log("3. Run database migration");
  console.log("4. Deploy and set webhook URL");
}

setupBot().catch(console.error);
