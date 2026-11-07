/**
 * Settings Handler
 * Handles notification preferences
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse, NotificationPreferences } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Show settings menu
 */
export async function handleSettings(connection: BotConnection): Promise<BotResponse> {
  const prefs = connection.notification_preferences || {
    morning_reminder: true,
    morning_time: "08:00",
    evening_nudge: true,
    streak_alerts: true,
    daily_summary: true,
  };

  return personality.settingsMenu(prefs);
}

/**
 * Toggle a notification setting
 */
export async function handleSettingsToggle(
  connection: BotConnection,
  setting: string
): Promise<BotResponse> {
  const prefs = connection.notification_preferences || {
    morning_reminder: true,
    morning_time: "08:00",
    evening_nudge: true,
    streak_alerts: true,
    daily_summary: true,
  };

  // Map setting callback to preference key
  const settingMap: Record<string, keyof NotificationPreferences> = {
    morning: "morning_reminder",
    evening: "evening_nudge",
    streak: "streak_alerts",
    summary: "daily_summary",
  };

  const prefKey = settingMap[setting];
  if (!prefKey) {
    return personality.errorMessage();
  }

  // Toggle the setting
  const currentValue = prefs[prefKey];
  const newValue = !currentValue;

  // Update in database
  const updatedPrefs = {
    ...prefs,
    [prefKey]: newValue,
  };

  const { error } = await supabase
    .from("bot_connections")
    .update({ notification_preferences: updatedPrefs })
    .eq("id", connection.id);

  if (error) {
    console.error("Error updating settings:", error);
    return personality.errorMessage();
  }

  // Return updated settings menu
  const settingNames: Record<string, string> = {
    morning: "Morning reminder",
    evening: "Evening nudge",
    streak: "Streak alerts",
    summary: "Daily summary",
  };

  const response = personality.settingUpdated(settingNames[setting], newValue);

  // Also show the updated menu
  return {
    text: `${response.text}\n\n${personality.settingsMenu(updatedPrefs).text}`,
    parseMode: "HTML",
    buttons: personality.settingsMenu(updatedPrefs).buttons,
  };
}

/**
 * Get users who have a specific notification enabled
 * Used by cron jobs to send notifications
 */
export async function getUsersWithNotification(
  notificationType: keyof NotificationPreferences
): Promise<BotConnection[]> {
  const { data, error } = await supabase
    .from("bot_connections")
    .select("*")
    .eq("is_active", true)
    .contains("notification_preferences", { [notificationType]: true });

  if (error) {
    console.error("Error fetching users for notification:", error);
    return [];
  }

  return (data || []) as BotConnection[];
}
