import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DayKey = { week: number; day: number };

type TopicEntry = {
  week: number;
  day: number;
  subject?: string;
  topics?: string[];
  completed?: boolean;
  skipped?: boolean;
  [key: string]: unknown;
};

type WeekSchedule = {
  week: number;
  topics: TopicEntry[];
  [key: string]: unknown;
};

function recalculateProgress(schedule: WeekSchedule[]): number {
  let totalDays = 0;
  let completedDays = 0;
  schedule.forEach((w) => {
    w.topics.forEach((t) => {
      if (t.skipped) return; // exclude skipped entries from progress
      totalDays++;
      if (t.completed) completedDays++;
    });
  });
  return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      planId,
      action,
      dayKeys,
    }: {
      planId: string;
      action: "queue_only" | "queue_and_dismiss" | "add_to_today";
      dayKeys: DayKey[];
    } = body;

    if (!planId || !action || !dayKeys || !Array.isArray(dayKeys)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["queue_only", "queue_and_dismiss", "add_to_today"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    // Fetch the current plan
    const { data: plan, error: fetchError } = await supabase
      .from("study_plans")
      .select("*")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const schedule: WeekSchedule[] = plan.schedule;

    // --- Step 1: Upsert study_plan_topic_reviews for each dayKey ---
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const dayKey of dayKeys) {
      // Find all matching entries (same week + day, not completed, not skipped)
      const matchingEntries: TopicEntry[] = [];
      schedule.forEach((w) => {
        if (w.week === dayKey.week) {
          w.topics.forEach((t) => {
            if (
              t.day === dayKey.day &&
              !t.completed &&
              !t.skipped
            ) {
              matchingEntries.push(t);
            }
          });
        }
      });

      const subject =
        matchingEntries.length > 0
          ? matchingEntries[0].subject ?? "Unknown"
          : "Unknown";

      const topics: string[] = matchingEntries.flatMap(
        (t) => t.topics ?? []
      );

      await supabase.from("study_plan_topic_reviews").upsert(
        {
          user_id: user.id,
          plan_id: planId,
          week_number: dayKey.week,
          day_number: dayKey.day,
          subject,
          topics,
          leitner_box: 1,
          next_review_at: tomorrow.toISOString(),
          is_active: true,
        },
        {
          onConflict: "plan_id,week_number,day_number",
        }
      );
    }

    // --- Step 2: Mutate schedule depending on action ---
    let updatedSchedule: WeekSchedule[] = schedule.map((w) => ({
      ...w,
      topics: w.topics.map((t) => ({ ...t })),
    }));

    if (action === "queue_only") {
      // No schedule changes — return as-is
    } else if (action === "queue_and_dismiss") {
      // Mark matching entries as skipped
      updatedSchedule = updatedSchedule.map((w) => ({
        ...w,
        topics: w.topics.map((t) => {
          const isTarget = dayKeys.some(
            (dk) =>
              dk.week === w.week &&
              dk.day === t.day &&
              !t.completed &&
              !t.skipped
          );
          return isTarget ? { ...t, skipped: true } : t;
        }),
      }));
    } else if (action === "add_to_today") {
      // First, mark targets as skipped (same as queue_and_dismiss)
      updatedSchedule = updatedSchedule.map((w) => ({
        ...w,
        topics: w.topics.map((t) => {
          const isTarget = dayKeys.some(
            (dk) =>
              dk.week === w.week &&
              dk.day === t.day &&
              !t.completed &&
              !t.skipped
          );
          return isTarget ? { ...t, skipped: true } : t;
        }),
      }));

      // Compute the current plan day (1-based)
      const currentPlanDay =
        Math.floor(
          (Date.now() - new Date(plan.created_at).getTime()) / 86400000
        ) + 1;

      // Walk schedule to find today's slots using a global day counter.
      // Must count unique calendar days (not individual topic entries),
      // matching the getMissedDays logic on the frontend.
      let globalDay = 0;
      const todaySlots: { wIdx: number; tIdx: number }[] = [];

      for (let wIdx = 0; wIdx < updatedSchedule.length; wIdx++) {
        const week = updatedSchedule[wIdx];
        // Get sorted unique day numbers for this week
        const uniqueDayNums = [
          ...new Set(week.topics.map((t) => t.day as number)),
        ].sort((a, b) => a - b);

        for (const dayNum of uniqueDayNums) {
          globalDay++;
          if (globalDay === currentPlanDay) {
            // All non-completed, non-skipped entries for this calendar day are today's slots
            week.topics.forEach((t, tIdx) => {
              if (t.day === dayNum && !t.completed && !t.skipped) {
                todaySlots.push({ wIdx, tIdx });
              }
            });
            break; // found today, no need to continue
          }
        }
        if (todaySlots.length > 0) break;
      }

      // Collect missed topics from the dayKeys
      const missedTopics: string[] = dayKeys.flatMap((dk) => {
        const entries: string[] = [];
        schedule.forEach((w) => {
          if (w.week === dk.week) {
            w.topics.forEach((t) => {
              if (t.day === dk.day) {
                entries.push(...(t.topics ?? []));
              }
            });
          }
        });
        return entries;
      });

      if (todaySlots.length > 0 && missedTopics.length > 0) {
        // Round-robin inject missed topics into today's slots
        todaySlots.forEach(({ wIdx, tIdx }, slotIdx) => {
          const slot = updatedSchedule[wIdx].topics[tIdx];
          const existing: string[] = slot.topics ?? [];
          const capacity = Math.max(0, 5 - existing.length);
          if (capacity <= 0) return;

          // Pick topics assigned to this slot via round-robin
          const assigned: string[] = [];
          for (let i = 0; i < missedTopics.length; i++) {
            if (i % todaySlots.length === slotIdx) {
              assigned.push(missedTopics[i]);
            }
          }

          const toAdd = assigned.slice(0, capacity);
          if (toAdd.length > 0) {
            updatedSchedule[wIdx].topics[tIdx] = {
              ...slot,
              topics: [...existing, ...toAdd],
            };
          }
        });
      }
      // If no today's slots found, action already fell back to queue_and_dismiss above
    }

    // --- Step 3: Recalculate progress and persist ---
    const progress = recalculateProgress(updatedSchedule);

    await supabase
      .from("study_plans")
      .update({ schedule: updatedSchedule, progress })
      .eq("id", planId)
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      progress,
      schedule: updatedSchedule,
    });
  } catch (error: unknown) {
    console.error("Catch-up update error:", error);
    return NextResponse.json(
      { error: "Failed to process catch-up action" },
      { status: 500 }
    );
  }
}
