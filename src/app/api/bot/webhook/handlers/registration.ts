/**
 * Bot Registration Handler
 * Allows users to create PrepSPSC accounts entirely through chat
 *
 * Flow:
 * 1. User sends /start (no existing account)
 * 2. Bot asks for name
 * 3. Bot asks for exam type (UPSC, State PSC, etc.)
 * 4. If State PSC, asks for state
 * 5. Bot shows avatar options
 * 6. Account created, user connected
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Registration steps
type RegistrationStep = "name" | "exam" | "state" | "avatar" | "complete";

interface PendingRegistration {
  id: string;
  platform: string;
  platform_user_id: string;
  registration_step: RegistrationStep;
  collected_data: {
    name?: string;
    exam_type?: string;
    exam_state?: string;
    avatar?: string;
  };
}

// Exam options
const EXAM_OPTIONS = [
  { id: "upsc", label: "UPSC" },
  { id: "state_psc", label: "State PSC" },
  { id: "ssc", label: "SSC/Banking" },
  { id: "other", label: "Other" },
];

// State options (top states for PSC)
const STATE_OPTIONS = [
  { id: "sikkim", label: "Sikkim" },
  { id: "bihar", label: "Bihar" },
  { id: "up", label: "Uttar Pradesh" },
  { id: "mp", label: "Madhya Pradesh" },
  { id: "maharashtra", label: "Maharashtra" },
  { id: "rajasthan", label: "Rajasthan" },
  { id: "other", label: "Other State" },
];

// Avatar options
const AVATAR_OPTIONS = [
  { id: "avatar1", emoji: "🧑", url: "/avatars/avatar1.png" },
  { id: "avatar2", emoji: "👩", url: "/avatars/avatar2.png" },
  { id: "avatar3", emoji: "🧔", url: "/avatars/avatar3.png" },
  { id: "avatar4", emoji: "👨‍🎓", url: "/avatars/avatar4.png" },
  { id: "avatar5", emoji: "👩‍🎓", url: "/avatars/avatar5.png" },
  { id: "avatar6", emoji: "🦊", url: "/avatars/fox.png" },
];

/**
 * Get or create pending registration
 */
async function getPendingRegistration(
  platform: string,
  platformUserId: string
): Promise<PendingRegistration | null> {
  const { data } = await supabase
    .from("bot_pending_registrations")
    .select("*")
    .eq("platform", platform)
    .eq("platform_user_id", platformUserId)
    .gt("expires_at", new Date().toISOString())
    .single();

  return data as PendingRegistration | null;
}

/**
 * Start new registration
 */
async function startRegistration(
  platform: string,
  platformUserId: string
): Promise<void> {
  await supabase
    .from("bot_pending_registrations")
    .upsert({
      platform,
      platform_user_id: platformUserId,
      registration_step: "name",
      collected_data: {},
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    }, {
      onConflict: "platform,platform_user_id",
    });
}

/**
 * Update registration step
 */
async function updateRegistration(
  id: string,
  step: RegistrationStep,
  data: Record<string, string>
): Promise<void> {
  const { data: current } = await supabase
    .from("bot_pending_registrations")
    .select("collected_data")
    .eq("id", id)
    .single();

  await supabase
    .from("bot_pending_registrations")
    .update({
      registration_step: step,
      collected_data: { ...current?.collected_data, ...data },
    })
    .eq("id", id);
}

/**
 * Complete registration and create account
 */
async function completeRegistration(
  registration: PendingRegistration,
  platform: string,
  platformUserId: string,
  username?: string
): Promise<{ userId: string; name: string } | null> {
  const { name, exam_type, exam_state, avatar } = registration.collected_data;

  if (!name) return null;

  try {
    // Create user in auth.users (using service role)
    // For bot registration, we create a user without email/password
    // They can later add email to their account
    const tempEmail = `${platformUserId}@bot.prepspsc.com`;
    const tempPassword = crypto.randomUUID();

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: tempEmail,
      password: tempPassword,
      email_confirm: true, // Auto-confirm since it's bot registration
      user_metadata: {
        full_name: name,
        registered_via: platform,
      },
    });

    if (authError || !authUser.user) {
      console.error("Error creating auth user:", authError);
      return null;
    }

    const userId = authUser.user.id;

    // Update profile
    await supabase
      .from("profiles")
      .update({
        full_name: name,
        username: generateUsername(name),
        avatar_url: avatar || "/avatars/avatar1.png",
        // Store exam preferences if we have a field for it
      })
      .eq("id", userId);

    // Create bot connection
    await supabase
      .from("bot_connections")
      .insert({
        user_id: userId,
        platform,
        platform_user_id: platformUserId,
        username: username || null,
        is_active: true,
        connected_at: new Date().toISOString(),
        last_interaction_at: new Date().toISOString(),
      });

    // Delete pending registration
    await supabase
      .from("bot_pending_registrations")
      .delete()
      .eq("id", registration.id);

    return { userId, name };
  } catch (error) {
    console.error("Error completing registration:", error);
    return null;
  }
}

/**
 * Generate username from name
 */
function generateUsername(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);
  const suffix = Math.floor(Math.random() * 1000);
  return `${base}${suffix}`;
}

/**
 * Check if user is in registration flow
 */
export async function isInRegistration(
  platform: string,
  platformUserId: string
): Promise<boolean> {
  const registration = await getPendingRegistration(platform, platformUserId);
  return !!registration;
}

/**
 * Handle registration message
 */
export async function handleRegistration(
  platform: "telegram" | "whatsapp",
  platformUserId: string,
  text: string,
  callbackData?: string,
  username?: string
): Promise<BotResponse> {
  let registration = await getPendingRegistration(platform, platformUserId);

  // Start new registration if none exists
  if (!registration) {
    await startRegistration(platform, platformUserId);
    registration = await getPendingRegistration(platform, platformUserId);
  }

  if (!registration) {
    return {
      text: "Something went wrong. Please try again with /start",
    };
  }

  const step = registration.registration_step;

  // Handle based on current step
  switch (step) {
    case "name":
      return handleNameStep(registration, text);

    case "exam":
      return handleExamStep(registration, text, callbackData);

    case "state":
      return handleStateStep(registration, text, callbackData);

    case "avatar":
      return handleAvatarStep(registration, platform, platformUserId, text, callbackData, username);

    default:
      return {
        text: "Registration error. Please try again with /start",
      };
  }
}

/**
 * Handle name input step
 */
async function handleNameStep(
  registration: PendingRegistration,
  text: string
): Promise<BotResponse> {
  const name = text.trim();

  if (name.length < 2 || name.length > 50) {
    return {
      text: "Please enter a valid name (2-50 characters):",
    };
  }

  // Save name and move to exam step
  await updateRegistration(registration.id, "exam", { name });

  return {
    text: `Nice to meet you, ${name}! 👋

Which exam are you preparing for?`,
    buttons: EXAM_OPTIONS.map(opt => ({
      text: opt.label,
      callbackData: `reg_exam_${opt.id}`,
    })),
  };
}

/**
 * Handle exam selection step
 */
async function handleExamStep(
  registration: PendingRegistration,
  text: string,
  callbackData?: string
): Promise<BotResponse> {
  let examType: string | null = null;

  // Check callback data first
  if (callbackData?.startsWith("reg_exam_")) {
    examType = callbackData.replace("reg_exam_", "");
  } else {
    // Try to match text input
    const textLower = text.toLowerCase();
    if (textLower.includes("upsc")) examType = "upsc";
    else if (textLower.includes("state") || textLower.includes("psc")) examType = "state_psc";
    else if (textLower.includes("ssc") || textLower.includes("bank")) examType = "ssc";
    else examType = "other";
  }

  await updateRegistration(registration.id, examType === "state_psc" ? "state" : "avatar", { exam_type: examType });

  // If State PSC, ask for state
  if (examType === "state_psc") {
    return {
      text: "Which state PSC are you preparing for?",
      buttons: STATE_OPTIONS.map(opt => ({
        text: opt.label,
        callbackData: `reg_state_${opt.id}`,
      })),
    };
  }

  // Otherwise, go to avatar selection
  return getAvatarPrompt(registration.collected_data.name || "Student");
}

/**
 * Handle state selection step
 */
async function handleStateStep(
  registration: PendingRegistration,
  text: string,
  callbackData?: string
): Promise<BotResponse> {
  let state: string = "other";

  if (callbackData?.startsWith("reg_state_")) {
    state = callbackData.replace("reg_state_", "");
  } else {
    // Try to match text input
    const textLower = text.toLowerCase();
    const found = STATE_OPTIONS.find(s => textLower.includes(s.id) || textLower.includes(s.label.toLowerCase()));
    if (found) state = found.id;
  }

  await updateRegistration(registration.id, "avatar", { exam_state: state });

  return getAvatarPrompt(registration.collected_data.name || "Student");
}

/**
 * Get avatar selection prompt
 */
function getAvatarPrompt(name: string): BotResponse {
  return {
    text: `Perfect! 🎯

Last step, ${name} - pick an avatar:

${AVATAR_OPTIONS.map((a, i) => `${i + 1}. ${a.emoji}`).join("  ")}

Reply with a number (1-6) or tap below:`,
    buttons: AVATAR_OPTIONS.slice(0, 3).map(opt => ({
      text: opt.emoji,
      callbackData: `reg_avatar_${opt.id}`,
    })),
  };
}

/**
 * Handle avatar selection and complete registration
 */
async function handleAvatarStep(
  registration: PendingRegistration,
  platform: "telegram" | "whatsapp",
  platformUserId: string,
  text: string,
  callbackData?: string,
  username?: string
): Promise<BotResponse> {
  let avatarUrl: string = AVATAR_OPTIONS[0].url;

  if (callbackData?.startsWith("reg_avatar_")) {
    const avatarId = callbackData.replace("reg_avatar_", "");
    const found = AVATAR_OPTIONS.find(a => a.id === avatarId);
    if (found) avatarUrl = found.url;
  } else {
    // Try to parse number input
    const num = parseInt(text.trim());
    if (num >= 1 && num <= AVATAR_OPTIONS.length) {
      avatarUrl = AVATAR_OPTIONS[num - 1].url;
    }
  }

  // Update avatar and complete registration
  await updateRegistration(registration.id, "complete", { avatar: avatarUrl });

  // Refresh registration to get all collected data
  const { data: finalReg } = await supabase
    .from("bot_pending_registrations")
    .select("*")
    .eq("id", registration.id)
    .single();

  if (!finalReg) {
    return {
      text: "Something went wrong. Please try again with /start",
    };
  }

  // Create the account
  const result = await completeRegistration(
    finalReg as PendingRegistration,
    platform,
    platformUserId,
    username
  );

  if (!result) {
    return {
      text: "Failed to create account. Please try again or sign up at prepspsc.com",
      buttons: [
        { text: "🌐 Sign Up on Web", url: "https://prepspsc.com/signup" },
      ],
    };
  }

  return {
    text: `🎉 <b>Welcome to PrepSPSC, ${result.name}!</b>

Your account has been created successfully!

✅ Account linked to ${platform === "telegram" ? "Telegram" : "WhatsApp"}
✅ Daily reminders enabled (8 AM)
✅ Ready to start learning

<b>Try these commands:</b>
• /plan - Today's study plan
• /quiz - Quick MCQ quiz
• /progress - Your stats

Or just ask me anything about your exam!

📱 You can also use the full app at prepspsc.com`,
    parseMode: "HTML",
    buttons: [
      { text: "📚 Start Studying", callbackData: "cmd_plan" },
      { text: "🎯 Take a Quiz", callbackData: "cmd_quiz" },
    ],
  };
}

/**
 * Get initial registration prompt
 */
export function getRegistrationPrompt(): BotResponse {
  return {
    text: `👋 <b>Welcome to PrepSPSC!</b>

I'm your AI study buddy for competitive exam preparation.

I don't recognize you yet. Let's get you set up!

It only takes 30 seconds. What's your name?`,
    parseMode: "HTML",
  };
}

/**
 * Get "already have account" prompt
 */
export function getConnectAccountPrompt(): BotResponse {
  return {
    text: `👋 <b>Welcome to PrepSPSC Bot!</b>

I see you're not connected to a PrepSPSC account yet.

Do you already have an account, or would you like to create one?`,
    parseMode: "HTML",
    buttons: [
      { text: "🔗 I have an account", url: "https://prepspsc.com/profile" },
      { text: "✨ Create new account", callbackData: "reg_start" },
    ],
  };
}
