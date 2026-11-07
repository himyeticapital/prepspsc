/**
 * Bot Personality Templates
 * Friendly & Motivational messaging style
 */

import type { BotResponse, BotButton } from "./types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prepspsc.com";

// ============================================
// WELCOME & HELP
// ============================================

export function welcomeMessage(userName?: string): BotResponse {
  const name = userName || "there";
  return {
    text: `Hey ${name}! 👋 Welcome to <b>PrepSPSC</b> - your AI study buddy for competitive exams!

I can help you with:
📋 <b>/plan</b> - Today's study plan
📝 <b>/quiz</b> - Quick MCQ quiz
📰 <b>/ca</b> - Current affairs briefing
📖 <b>/explain [topic]</b> - Learn any topic
💾 <b>/save [note]</b> - Save study notes
📊 <b>/stats</b> - Your progress

Or just ask me anything about your exam! 🎯`,
    parseMode: "HTML",
    buttons: [
      { text: "📋 Today's Plan", callbackData: "cmd_plan" },
      { text: "📝 Quick Quiz", callbackData: "cmd_quiz" },
    ],
  };
}

export function helpMessage(): BotResponse {
  return {
    text: `📚 <b>PrepSPSC Commands</b>

<b>Study Tools:</b>
• <code>/plan</code> - See today's study plan
• <code>/quiz [topic]</code> - Take a quiz (e.g., /quiz polity)
• <code>/ca</code> - Current affairs (Sikkim, National, Intl)
• <code>/explain [topic]</code> - Get AI explanation
• <code>/save [note]</code> - Save a study note

<b>Progress:</b>
• <code>/stats</code> - Your weekly stats
• <code>/rank</code> - Leaderboard position

<b>More:</b>
• <code>/test</code> - Full mock test (web)
• <code>/room</code> - Study rooms (web)
• <code>/course</code> - Video courses
• <code>/fillspscform</code> - Fill SPSC recruitment form
• <code>/settings</code> - Notification preferences

💡 <i>Tip: You can also just type naturally!</i>
"quiz me on economics" or "explain article 21"
"ca sikkim" or "latest news"`,
    parseMode: "HTML",
  };
}

// ============================================
// QUIZ RESPONSES
// ============================================

export function quizQuestion(
  questionNum: number,
  totalQuestions: number,
  question: string,
  options: { id: string; text: string }[]
): BotResponse {
  const optionsText = options
    .map((opt) => `<b>${opt.id.toUpperCase()}.</b> ${opt.text}`)
    .join("\n");

  return {
    text: `📝 <b>Question ${questionNum}/${totalQuestions}</b>

${question}

${optionsText}`,
    parseMode: "HTML",
    buttons: options.map((opt) => ({
      text: opt.id.toUpperCase(),
      callbackData: `quiz_answer_${opt.id}`,
    })),
  };
}

export function quizCorrect(explanation: string, xpEarned: number): BotResponse {
  return {
    text: `✅ <b>Correct!</b> +${xpEarned} XP 🌟

${explanation}`,
    parseMode: "HTML",
  };
}

export function quizIncorrect(
  correctAnswer: string,
  explanation: string,
  userChoiceExplanation?: string
): BotResponse {
  let text = `❌ <b>Not quite!</b>

The correct answer is <b>${correctAnswer.toUpperCase()}</b>.

${explanation}`;

  if (userChoiceExplanation) {
    text += `\n\n💡 <i>${userChoiceExplanation}</i>`;
  }

  return {
    text,
    parseMode: "HTML",
  };
}

export function quizComplete(
  correct: number,
  total: number,
  xpEarned: number
): BotResponse {
  const percentage = Math.round((correct / total) * 100);
  let emoji: string;
  let message: string;

  if (percentage >= 80) {
    emoji = "🎉";
    message = "Excellent work!";
  } else if (percentage >= 60) {
    emoji = "👍";
    message = "Good job!";
  } else if (percentage >= 40) {
    emoji = "💪";
    message = "Keep practicing!";
  } else {
    emoji = "📚";
    message = "Review this topic and try again!";
  }

  return {
    text: `${emoji} <b>Quiz Complete!</b>

Score: <b>${correct}/${total}</b> (${percentage}%)
XP Earned: <b>+${xpEarned}</b> ⭐

${message}`,
    parseMode: "HTML",
    buttons: [
      { text: "🔄 Another Quiz", callbackData: "cmd_quiz" },
      { text: "📊 My Stats", callbackData: "cmd_stats" },
    ],
  };
}

export function noQuizTopic(): BotResponse {
  return {
    text: `📝 <b>Quick Quiz</b>

What topic would you like to be quizzed on?`,
    parseMode: "HTML",
    buttons: [
      { text: "🏛️ Polity", callbackData: "quiz_topic_polity" },
      { text: "📜 History", callbackData: "quiz_topic_history" },
      { text: "🌍 Geography", callbackData: "quiz_topic_geography" },
      { text: "💰 Economics", callbackData: "quiz_topic_economics" },
      { text: "🏔️ Sikkim GK", callbackData: "quiz_topic_sikkim" },
      { text: "🎲 Random", callbackData: "quiz_topic_random" },
    ],
  };
}

// ============================================
// PLAN & PROGRESS
// ============================================

export function studyPlan(
  todayTopics: string[],
  completedToday: number,
  streak: number,
  dueFlashcards: number
): BotResponse {
  const topicsText = todayTopics.length > 0
    ? todayTopics.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "No specific topics scheduled";

  return {
    text: `📋 <b>Today's Study Plan</b>

🔥 Streak: <b>${streak} days</b>
✅ Completed: <b>${completedToday}</b> topics

<b>Topics for today:</b>
${topicsText}

${dueFlashcards > 0 ? `\n📇 <b>${dueFlashcards}</b> flashcards due for review` : ""}`,
    parseMode: "HTML",
    buttons: [
      { text: "📝 Start Quiz", callbackData: "cmd_quiz" },
      { text: "📖 Full Plan", url: `${APP_URL}/study-ai` },
    ],
  };
}

export function noPlanYet(): BotResponse {
  return {
    text: `📋 <b>No Study Plan Yet</b>

You haven't created a study plan yet!

Create one on the web app to get personalized daily topics and track your progress.`,
    parseMode: "HTML",
    buttons: [
      { text: "📝 Create Plan", url: `${APP_URL}/study-ai` },
      { text: "📝 Quick Quiz", callbackData: "cmd_quiz" },
    ],
  };
}

export function progressStats(stats: {
  streak: number;
  xpThisWeek: number;
  xpChange: number;
  topicsCompleted: number;
  accuracy: number;
  topSubject?: string;
  weakSubject?: string;
  rank?: number;
}): BotResponse {
  const xpChangeText = stats.xpChange >= 0
    ? `+${stats.xpChange}%`
    : `${stats.xpChange}%`;

  return {
    text: `📊 <b>Your Week in Review</b>

🔥 Streak: <b>${stats.streak} days</b>
⭐ XP Earned: <b>${stats.xpThisWeek}</b> (${xpChangeText} vs last week)
📚 Topics: <b>${stats.topicsCompleted}</b> completed
🎯 Accuracy: <b>${stats.accuracy}%</b>

${stats.topSubject ? `✅ Top subject: <b>${stats.topSubject}</b>` : ""}
${stats.weakSubject ? `📖 Needs work: <b>${stats.weakSubject}</b>` : ""}
${stats.rank ? `\n🏆 Rank: <b>#${stats.rank}</b>` : ""}`,
    parseMode: "HTML",
    buttons: [
      { text: "📈 Full Analytics", url: `${APP_URL}/analytics` },
      { text: "🏆 Leaderboard", callbackData: "cmd_rank" },
    ],
  };
}

// ============================================
// NOTES
// ============================================

export function noteSaved(notePreview: string, tags: string[]): BotResponse {
  const tagsText = tags.length > 0 ? `\n🏷️ Tags: ${tags.join(", ")}` : "";

  return {
    text: `✅ <b>Note Saved!</b>

"${notePreview.substring(0, 100)}${notePreview.length > 100 ? "..." : ""}"${tagsText}

View all notes on the web app.`,
    parseMode: "HTML",
    buttons: [
      { text: "📝 My Notes", url: `${APP_URL}/notes` },
    ],
  };
}

// ============================================
// HYBRID FEATURES (Web Links)
// ============================================

export function mockTestOptions(): BotResponse {
  return {
    text: `📝 <b>Ready for a Practice Test?</b>

Full mock tests are available on the web app with:
• Timed sessions
• Detailed analytics
• Solution explanations

Or take a quick 5-question quiz right here!`,
    parseMode: "HTML",
    buttons: [
      { text: "🌐 Start Mock Test", url: `${APP_URL}/test-arena` },
      { text: "⚡ Quick Quiz Here", callbackData: "cmd_quiz" },
    ],
  };
}

export function studyRoomOptions(activeRooms: { name: string; count: number }[]): BotResponse {
  let roomsText = "";
  if (activeRooms.length > 0) {
    roomsText = "\n\n<b>Active now:</b>\n" + activeRooms
      .map((r) => `• "${r.name}" (${r.count} online)`)
      .join("\n");
  }

  return {
    text: `🧑‍🤝‍🧑 <b>Study Rooms</b>

Join a virtual study room to:
• Study with friends
• Stay accountable
• Share notes & discuss${roomsText}`,
    parseMode: "HTML",
    buttons: [
      { text: "🚀 Join/Create Room", url: `${APP_URL}/room` },
    ],
  };
}

export function leaderboardPosition(
  rank: number,
  xp: number,
  xpToNext: number,
  top3: { name: string; xp: number }[]
): BotResponse {
  const top3Text = top3
    .map((u, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      return `${medal} ${u.name}: ${u.xp} XP`;
    })
    .join("\n");

  return {
    text: `🏆 <b>Leaderboard</b>

Your Position: <b>#${rank}</b>
Your XP: <b>${xp}</b> ⭐
${xpToNext > 0 ? `XP to next rank: <b>${xpToNext}</b>` : ""}

<b>Top 3 This Week:</b>
${top3Text}`,
    parseMode: "HTML",
    buttons: [
      { text: "📊 Full Leaderboard", url: `${APP_URL}/leaderboard` },
    ],
  };
}

export function courseProgress(
  courseName: string,
  progress: number,
  nextLesson?: string
): BotResponse {
  const progressBar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

  return {
    text: `📺 <b>${courseName}</b>

Progress: [${progressBar}] ${progress}%

${nextLesson ? `<b>Next:</b> ${nextLesson}` : "Continue where you left off!"}`,
    parseMode: "HTML",
    buttons: [
      { text: "▶️ Continue Learning", url: `${APP_URL}/coaching` },
    ],
  };
}

// ============================================
// CURRENT AFFAIRS
// ============================================

export function currentAffairsBriefing(
  articles: {
    title: string;
    summary: string | null;
    source_url: string;
    source_name: string;
    category: string;
    published_at: string | null;
  }[],
  filterCategory?: string
): BotResponse {
  const categoryEmoji: Record<string, string> = {
    sikkim: "🏔️",
    national: "🏛️",
    international: "🌍",
  };

  const categoryLabel: Record<string, string> = {
    sikkim: "Sikkim",
    national: "National",
    international: "International",
  };

  let heading = "📰 <b>Today's Current Affairs</b>";
  if (filterCategory && categoryLabel[filterCategory]) {
    heading = `${categoryEmoji[filterCategory]} <b>${categoryLabel[filterCategory]} Current Affairs</b>`;
  }

  // Group articles by category
  const grouped: Record<string, typeof articles> = {};
  for (const article of articles) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  let body = "";

  if (filterCategory) {
    // Single category view - show more detail
    body = articles
      .map((a, i) => {
        const summary = a.summary ? `\n   <i>${a.summary.substring(0, 120)}${a.summary.length > 120 ? "..." : ""}</i>` : "";
        return `${i + 1}. <a href="${a.source_url}">${a.title}</a>${summary}\n   — <i>${a.source_name}</i>`;
      })
      .join("\n\n");
  } else {
    // Multi-category briefing - compact
    const categoryOrder = ["sikkim", "national", "international"];
    for (const cat of categoryOrder) {
      const catArticles = grouped[cat];
      if (!catArticles || catArticles.length === 0) continue;

      const emoji = categoryEmoji[cat] || "📰";
      const label = categoryLabel[cat] || cat;

      body += `\n${emoji} <b>${label}</b>\n`;
      body += catArticles
        .map((a) => `• <a href="${a.source_url}">${a.title}</a> <i>(${a.source_name})</i>`)
        .join("\n");
      body += "\n";
    }
  }

  // Category filter buttons
  const buttons = [];
  if (filterCategory !== "sikkim") {
    buttons.push({ text: "🏔️ Sikkim", callbackData: "cmd_news_sikkim" });
  }
  if (filterCategory !== "national") {
    buttons.push({ text: "🏛️ National", callbackData: "cmd_news_national" });
  }
  if (filterCategory !== "international") {
    buttons.push({ text: "🌍 International", callbackData: "cmd_news_intl" });
  }
  if (filterCategory) {
    buttons.push({ text: "📰 All News", callbackData: "cmd_news" });
  }

  return {
    text: `${heading}\n${body}\n\n💡 <i>Use /ca sikkim, /ca national, or /ca intl to filter</i>`,
    parseMode: "HTML",
    buttons,
  };
}

export function currentAffairsEmpty(category?: string): BotResponse {
  const label = category ? ` for ${category}` : "";
  return {
    text: `📰 <b>No recent news${label}</b>

News articles are refreshed periodically. Check back soon!

In the meantime, take a quiz on current affairs:`,
    parseMode: "HTML",
    buttons: [
      { text: "📝 Quiz: Current Affairs", callbackData: "quiz_topic_current affairs" },
      { text: "🌐 News on Web", url: `${APP_URL}/news` },
    ],
  };
}

export function currentAffairsError(): BotResponse {
  return {
    text: `📰 Sorry, I couldn't fetch current affairs right now. Try again in a moment!`,
    buttons: [
      { text: "🌐 News on Web", url: `${APP_URL}/news` },
    ],
  };
}

// ============================================
// ERRORS & FALLBACKS
// ============================================

export function errorMessage(friendly: boolean = true): BotResponse {
  if (friendly) {
    return {
      text: `😅 Oops! Something went wrong on my end.

Please try again in a moment, or use the web app for full features.`,
      parseMode: "HTML",
      buttons: [
        { text: "🌐 Open Web App", url: APP_URL },
      ],
    };
  }

  return {
    text: "An error occurred. Please try again.",
  };
}

export function notConnected(): BotResponse {
  return {
    text: `👋 <b>Welcome to PrepSPSC!</b>

I don't recognize your account yet. Would you like to:`,
    parseMode: "HTML",
    buttons: [
      { text: "🔗 Connect Account", url: `${APP_URL}/profile?connect=telegram` },
      { text: "📝 Create Account", url: `${APP_URL}/signup` },
    ],
  };
}

export function featureUnavailable(featureName: string): BotResponse {
  return {
    text: `This feature (${featureName}) is available on the web app for the best experience!`,
    buttons: [
      { text: "🌐 Open Web App", url: APP_URL },
    ],
  };
}

// ============================================
// NOTIFICATIONS SETTINGS
// ============================================

export function settingsMenu(prefs: {
  morning_reminder: boolean;
  morning_time: string;
  evening_nudge: boolean;
  streak_alerts: boolean;
  daily_summary: boolean;
}): BotResponse {
  const onOff = (val: boolean) => val ? "✅" : "❌";

  return {
    text: `⚙️ <b>Notification Settings</b>

${onOff(prefs.morning_reminder)} Morning reminder (${prefs.morning_time})
${onOff(prefs.evening_nudge)} Evening study nudge
${onOff(prefs.streak_alerts)} Streak alerts
${onOff(prefs.daily_summary)} Daily summary

Tap to toggle:`,
    parseMode: "HTML",
    buttons: [
      { text: `${onOff(prefs.morning_reminder)} Morning`, callbackData: "settings_morning" },
      { text: `${onOff(prefs.evening_nudge)} Evening`, callbackData: "settings_evening" },
      { text: `${onOff(prefs.streak_alerts)} Streak`, callbackData: "settings_streak" },
      { text: `${onOff(prefs.daily_summary)} Summary`, callbackData: "settings_summary" },
    ],
  };
}

export function settingUpdated(setting: string, enabled: boolean): BotResponse {
  return {
    text: `✅ ${setting} notifications ${enabled ? "enabled" : "disabled"}!`,
  };
}
