/**
 * Save Handler
 * Saves study notes from bot messages
 */

import { createClient } from "@supabase/supabase-js";
import type { BotConnection, BotResponse } from "@/lib/bot/types";
import * as personality from "@/lib/bot/personality";
import { extractNoteTags } from "@/lib/bot/ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Save a note from bot message
 */
export async function handleSave(
  connection: BotConnection,
  noteContent: string
): Promise<BotResponse> {
  try {
    // Extract tags using AI
    let tags: string[] = [];
    try {
      tags = await extractNoteTags(noteContent);
    } catch (tagError) {
      console.log("Could not extract tags:", tagError);
      // Continue without tags
    }

    // Save note to database
    const { error } = await supabase.from("study_notes").insert({
      user_id: connection.user_id,
      content: noteContent,
      source: connection.platform, // 'telegram' or 'whatsapp'
      tags,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving note:", error);
      return {
        text: "Sorry, I couldn't save your note. Please try again!",
      };
    }

    // Return success with preview
    return personality.noteSaved(noteContent, tags);
  } catch (error) {
    console.error("Save handler error:", error);
    return personality.errorMessage();
  }
}

/**
 * Get recent notes for user
 */
export async function getRecentNotes(
  userId: string,
  limit: number = 5
): Promise<Array<{ content: string; tags: string[]; created_at: string }>> {
  const { data, error } = await supabase
    .from("study_notes")
    .select("content, tags, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching notes:", error);
    return [];
  }

  return data || [];
}
