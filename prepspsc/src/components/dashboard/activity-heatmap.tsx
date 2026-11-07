"use client";

import { motion } from "framer-motion";
import { ActivityCalendar } from "react-activity-calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DailyStudyLog } from "@/types/database.types";

// Format minutes to readable string
function formatMinutes(minutes: number): string {
  if (minutes === 0) return "No study";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

// Format date to readable string
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ActivityHeatmapProps {
  logs: DailyStudyLog[];
}

export function ActivityHeatmap({ logs }: ActivityHeatmapProps) {
  // Transform logs to activity calendar format
  const activityData = logs.map((log) => ({
    date: log.study_date,
    count: log.minutes_studied,
    level: getLevel(log.minutes_studied),
  }));

  // Fill in missing dates with 0 activity
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 6);

  const dateMap = new Map(activityData.map((d) => [d.date, d]));
  const filledData: { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }[] = [];

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    filledData.push(
      dateMap.get(dateStr) || {
        date: dateStr,
        count: 0,
        level: 0 as const,
      }
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <h3 className="text-lg font-semibold mb-4">Study Activity</h3>
      <div className="overflow-x-auto">
        <TooltipProvider>
          <ActivityCalendar
            data={filledData}
            theme={{
              dark: ["#27272a", "#134e4a", "#0d9488", "#14b8a6", "#2dd4bf"],
            }}
            colorScheme="dark"
            blockSize={12}
            blockMargin={4}
            fontSize={12}
            labels={{
              totalCount: "{{count}} minutes studied in the last 6 months",
            }}
            showWeekdayLabels
            renderBlock={(block, activity) => (
              <Tooltip>
                <TooltipTrigger asChild>{block}</TooltipTrigger>
                <TooltipContent className="bg-zinc-900 border-zinc-700 text-white">
                  <div className="text-center">
                    <p className="font-semibold text-primary">
                      {formatMinutes(activity.count)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {formatDate(activity.date)}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          />
        </TooltipProvider>
      </div>
    </motion.div>
  );
}

function getLevel(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}
