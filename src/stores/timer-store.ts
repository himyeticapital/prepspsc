import { create } from "zustand";
import { persist } from "zustand/middleware";
import { notificationHelpers } from "./notification-store";

type TimerMode = "pomodoro" | "stopwatch" | "countdown";

// Helper function to sync study time to database
async function syncStudyTimeToDatabase(
  minutes: number,
  sessionName: string,
  mode: TimerMode
): Promise<void> {
  if (minutes < 1) return;

  try {
    const response = await fetch("/api/sync-study-time", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        minutes,
        sessionName,
        mode,
      }),
    });

    if (!response.ok) {
      console.error("Failed to sync study time:", await response.text());
    } else {
      const data = await response.json();
      console.log(
        `Synced ${minutes} minutes to database. Total: ${data.totalMinutes}m, XP awarded: ${data.xpAwarded}`
      );

      // Dispatch custom event so dashboard can refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("study-time-synced", {
            detail: {
              minutes,
              totalMinutes: data.totalMinutes,
              todayMinutes: data.todayMinutes,
              xpAwarded: data.xpAwarded,
              totalXP: data.totalXP,
            },
          })
        );
      }
    }
  } catch (error) {
    console.error("Error syncing study time:", error);
  }
}
type TimerStatus = "idle" | "running" | "paused" | "completed";

// Timer limits for Pro features
export const TIMER_LIMITS = {
  FREE_WORK_MIN: 25,
  FREE_WORK_MAX: 25,
  PRO_WORK_MIN: 15,
  PRO_WORK_MAX: 90,
  BREAK_MIN: 5,
  BREAK_MAX: 30,
  LONG_BREAK_MIN: 10,
  LONG_BREAK_MAX: 45,
} as const;

interface PomodoroConfig {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  currentSession: "work" | "break" | "longBreak";
  completedSessions: number;
}

// Pomodoro session record for history
export interface PomodoroRecord {
  id: string;
  sessionName: string;
  taskId: string | null;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  mode: TimerMode;
  sessionsCompleted: number;
  isCompleted: boolean;
}

interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  elapsedSeconds: number;
  targetSeconds: number;
  pomodoroConfig: PomodoroConfig;
  intervalId: NodeJS.Timeout | null;

  // Session tracking
  sessionStartTime: number | null;
  totalSessionSeconds: number;

  // Session naming
  currentSessionName: string;

  // For persistence across navigation
  lastTickTime: number | null;
  wasRunning: boolean;

  // Pomodoro history (local storage)
  pomodoroHistory: PomodoroRecord[];

  // Actions
  setMode: (mode: TimerMode) => void;
  setTargetSeconds: (seconds: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;

  // Pro timer settings
  setWorkDuration: (minutes: number, isPro: boolean) => void;
  setBreakDuration: (minutes: number) => void;
  setLongBreakDuration: (minutes: number) => void;
  setSessionsUntilLongBreak: (sessions: number) => void;
  setAutoStartBreaks: (autoStart: boolean) => void;

  // Session tracking
  getSessionDuration: () => number;
  resetSessionTracking: () => void;

  // Session naming
  setSessionName: (name: string) => void;

  // Resume timer after navigation
  resumeIfNeeded: () => void;

  // History actions
  addToHistory: (record: Omit<PomodoroRecord, "id">) => void;
  clearHistory: () => void;
  getTodaysSessions: () => PomodoroRecord[];
  getTotalFocusTime: (days?: number) => number;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: "pomodoro",
      status: "idle",
      elapsedSeconds: 0,
      targetSeconds: 25 * 60, // 25 minutes default
      pomodoroConfig: {
        workMinutes: 25,
        breakMinutes: 5,
        longBreakMinutes: 15,
        sessionsUntilLongBreak: 4,
        autoStartBreaks: false,
        currentSession: "work",
        completedSessions: 0,
      },
      intervalId: null,
      sessionStartTime: null,
      totalSessionSeconds: 0,
      currentSessionName: "",
      lastTickTime: null,
      wasRunning: false,
      pomodoroHistory: [],

      setMode: (newMode) => {
        const { pomodoroConfig, sessionStartTime, totalSessionSeconds, currentSessionName, elapsedSeconds, mode } = get();

        // Calculate total work time including current elapsed time
        const currentWorkTime = pomodoroConfig.currentSession === "work" ? elapsedSeconds : 0;
        const totalWorkTime = totalSessionSeconds + currentWorkTime;

        // Save current session to history if there was meaningful progress (> 1 min)
        if (totalWorkTime >= 60 && sessionStartTime) {
          get().addToHistory({
            sessionName: currentSessionName || "Focus Session",
            taskId: null,
            startTime: sessionStartTime,
            endTime: Date.now(),
            duration: totalWorkTime,
            mode,
            sessionsCompleted: pomodoroConfig.completedSessions,
            isCompleted: false,
          });
        }

        // Note: TimerProvider handles interval cleanup via status change

        let targetSeconds = 0;
        if (newMode === "pomodoro") {
          targetSeconds = pomodoroConfig.workMinutes * 60;
        } else if (newMode === "countdown") {
          targetSeconds = 30 * 60; // 30 minutes default
        }

        set({
          mode: newMode,
          status: "idle",
          elapsedSeconds: 0,
          targetSeconds,
          intervalId: null,
          pomodoroConfig: {
            ...pomodoroConfig,
            currentSession: "work",
            // Preserve completedSessions count across mode switches
          },
          sessionStartTime: null,
          totalSessionSeconds: 0,
          lastTickTime: null,
          wasRunning: false,
        });
      },

      setTargetSeconds: (seconds) => {
        set({ targetSeconds: seconds });
      },

      start: () => {
        const { status, sessionStartTime } = get();
        if (status === "running") return;

        const now = Date.now();
        // Just update status - TimerProvider handles the actual interval
        set({
          status: "running",
          sessionStartTime: sessionStartTime ?? now,
          lastTickTime: now,
          wasRunning: true,
        });
      },

      pause: () => {
        // Just update status - TimerProvider handles the actual interval
        set({
          status: "paused",
          intervalId: null,
          wasRunning: false,
          lastTickTime: null,
        });
      },

      reset: () => {
        const { intervalId, mode, pomodoroConfig, sessionStartTime, totalSessionSeconds, currentSessionName, elapsedSeconds } = get();

        // Calculate total work time including current elapsed time
        const currentWorkTime = pomodoroConfig.currentSession === "work" ? elapsedSeconds : 0;
        const totalWorkTime = totalSessionSeconds + currentWorkTime;

        // Increment completedSessions if manually completing a work session with meaningful time
        const shouldIncrementSessions = totalWorkTime >= 60 && pomodoroConfig.currentSession === "work";
        const newCompletedSessions = shouldIncrementSessions
          ? pomodoroConfig.completedSessions + 1
          : pomodoroConfig.completedSessions;

        // Save current session to history if there was meaningful progress (> 1 min)
        if (totalWorkTime >= 60 && sessionStartTime) {
          get().addToHistory({
            sessionName: currentSessionName || "Focus Session",
            taskId: null,
            startTime: sessionStartTime,
            endTime: Date.now(),
            duration: totalWorkTime,
            mode,
            sessionsCompleted: newCompletedSessions,
            isCompleted: false,
          });
        }

        // Note: TimerProvider handles the interval cleanup via status change

        let targetSeconds = 0;
        if (mode === "pomodoro") {
          targetSeconds = pomodoroConfig.workMinutes * 60;
        } else if (mode === "countdown") {
          targetSeconds = get().targetSeconds;
        }

        set({
          status: "idle",
          elapsedSeconds: 0,
          intervalId: null,
          pomodoroConfig: {
            ...pomodoroConfig,
            currentSession: "work",
            completedSessions: newCompletedSessions,
          },
          sessionStartTime: null,
          totalSessionSeconds: 0,
          lastTickTime: null,
          wasRunning: false,
        });
      },

      tick: () => {
        const { mode, elapsedSeconds, targetSeconds, pomodoroConfig, sessionStartTime, currentSessionName } = get();
        const now = Date.now();

        // Update lastTickTime for persistence
        set({ lastTickTime: now });

        if (mode === "stopwatch") {
          // Stopwatch counts up indefinitely
          set({ elapsedSeconds: elapsedSeconds + 1 });
        } else if (mode === "pomodoro" || mode === "countdown") {
          const newElapsed = elapsedSeconds + 1;

          if (newElapsed >= targetSeconds) {
            // Timer completed
            const { totalSessionSeconds } = get();
            // Note: TimerProvider handles interval management

            if (mode === "pomodoro") {
              const isWork = pomodoroConfig.currentSession === "work";
              const newCompletedSessions = isWork
                ? pomodoroConfig.completedSessions + 1
                : pomodoroConfig.completedSessions;

              // Determine next session type
              let newSession: "work" | "break" | "longBreak";
              let newTarget: number;

              if (isWork) {
                // Just finished work, check if long break needed
                if (
                  newCompletedSessions > 0 &&
                  newCompletedSessions % pomodoroConfig.sessionsUntilLongBreak === 0
                ) {
                  newSession = "longBreak";
                  newTarget = pomodoroConfig.longBreakMinutes * 60;
                } else {
                  newSession = "break";
                  newTarget = pomodoroConfig.breakMinutes * 60;
                }

                // Update total session seconds for work completion
                const newTotalSeconds = totalSessionSeconds + targetSeconds;
                set({
                  totalSessionSeconds: newTotalSeconds,
                });

                // Add completed work session to history
                get().addToHistory({
                  sessionName: currentSessionName || "Focus Session",
                  taskId: null,
                  startTime: sessionStartTime || now - targetSeconds * 1000,
                  endTime: now,
                  duration: targetSeconds,
                  mode: "pomodoro",
                  sessionsCompleted: newCompletedSessions,
                  isCompleted: true,
                });
              } else {
                // Finished break, back to work
                newSession = "work";
                newTarget = pomodoroConfig.workMinutes * 60;
              }

              // Trigger notification
              notificationHelpers.timerComplete("pomodoro", pomodoroConfig.currentSession);

              // Set status - TimerProvider will handle interval based on status
              set({
                status: pomodoroConfig.autoStartBreaks ? "running" : "completed",
                elapsedSeconds: 0,
                targetSeconds: newTarget,
                intervalId: null,
                pomodoroConfig: {
                  ...pomodoroConfig,
                  currentSession: newSession,
                  completedSessions: newCompletedSessions,
                },
                sessionStartTime: isWork ? null : sessionStartTime, // Reset start time after work session
                wasRunning: pomodoroConfig.autoStartBreaks,
                lastTickTime: pomodoroConfig.autoStartBreaks ? now : null,
              });
            } else {
              // Countdown mode completed
              notificationHelpers.timerComplete("countdown");

              // Add to history
              get().addToHistory({
                sessionName: currentSessionName || "Countdown Session",
                taskId: null,
                startTime: sessionStartTime || now - targetSeconds * 1000,
                endTime: now,
                duration: targetSeconds,
                mode: "countdown",
                sessionsCompleted: 1,
                isCompleted: true,
              });

              set({
                status: "completed",
                elapsedSeconds: targetSeconds,
                intervalId: null,
                totalSessionSeconds: totalSessionSeconds + targetSeconds,
                wasRunning: false,
                lastTickTime: null,
              });
            }
          } else {
            set({ elapsedSeconds: newElapsed });
          }
        }
      },

      // Resume timer after navigation (called on mount)
      // Note: TimerProvider now handles resumption, this is kept for backwards compatibility
      resumeIfNeeded: () => {
        const { wasRunning, lastTickTime, status } = get();

        // If timer was running and we have a last tick time
        if (wasRunning && lastTickTime && status !== "running") {
          const now = Date.now();
          const elapsedWhileAway = Math.floor((now - lastTickTime) / 1000);

          // Only resume if less than 5 minutes have passed (to prevent huge jumps)
          if (elapsedWhileAway < 300) {
            const currentElapsed = get().elapsedSeconds;
            const newElapsed = currentElapsed + elapsedWhileAway;

            // Just update status - TimerProvider handles the interval
            set({
              elapsedSeconds: newElapsed,
              status: "running",
              lastTickTime: now,
            });
          } else {
            // Too much time passed, pause the timer
            set({
              wasRunning: false,
              lastTickTime: null,
            });
          }
        }
      },

      // Pro timer settings
      setWorkDuration: (minutes, isPro) => {
        // Enforce limits based on Pro status
        let validMinutes = minutes;
        if (!isPro) {
          validMinutes = TIMER_LIMITS.FREE_WORK_MIN; // Free users locked to 25 min
        } else {
          validMinutes = Math.max(
            TIMER_LIMITS.PRO_WORK_MIN,
            Math.min(TIMER_LIMITS.PRO_WORK_MAX, minutes)
          );
        }

        const { pomodoroConfig, mode, status } = get();
        set({
          pomodoroConfig: {
            ...pomodoroConfig,
            workMinutes: validMinutes,
          },
          // Update target if currently on work session and not running
          targetSeconds:
            mode === "pomodoro" &&
            pomodoroConfig.currentSession === "work" &&
            status === "idle"
              ? validMinutes * 60
              : get().targetSeconds,
        });
      },

      setBreakDuration: (minutes) => {
        const validMinutes = Math.max(
          TIMER_LIMITS.BREAK_MIN,
          Math.min(TIMER_LIMITS.BREAK_MAX, minutes)
        );

        const { pomodoroConfig, mode, status } = get();
        set({
          pomodoroConfig: {
            ...pomodoroConfig,
            breakMinutes: validMinutes,
          },
          targetSeconds:
            mode === "pomodoro" &&
            pomodoroConfig.currentSession === "break" &&
            status === "idle"
              ? validMinutes * 60
              : get().targetSeconds,
        });
      },

      setLongBreakDuration: (minutes) => {
        const validMinutes = Math.max(
          TIMER_LIMITS.LONG_BREAK_MIN,
          Math.min(TIMER_LIMITS.LONG_BREAK_MAX, minutes)
        );

        const { pomodoroConfig, mode, status } = get();
        set({
          pomodoroConfig: {
            ...pomodoroConfig,
            longBreakMinutes: validMinutes,
          },
          targetSeconds:
            mode === "pomodoro" &&
            pomodoroConfig.currentSession === "longBreak" &&
            status === "idle"
              ? validMinutes * 60
              : get().targetSeconds,
        });
      },

      setSessionsUntilLongBreak: (sessions) => {
        const validSessions = Math.max(2, Math.min(8, sessions));
        set({
          pomodoroConfig: {
            ...get().pomodoroConfig,
            sessionsUntilLongBreak: validSessions,
          },
        });
      },

      setAutoStartBreaks: (autoStart) => {
        set({
          pomodoroConfig: {
            ...get().pomodoroConfig,
            autoStartBreaks: autoStart,
          },
        });
      },

      getSessionDuration: () => {
        const { totalSessionSeconds, elapsedSeconds, pomodoroConfig, status } = get();
        // Include current elapsed time if in a work session
        const currentWorkTime =
          pomodoroConfig.currentSession === "work" && status === "running"
            ? elapsedSeconds
            : 0;
        return totalSessionSeconds + currentWorkTime;
      },

      resetSessionTracking: () => {
        set({
          sessionStartTime: null,
          totalSessionSeconds: 0,
        });
      },

      // Session naming
      setSessionName: (name) => {
        set({ currentSessionName: name });
      },

      // History actions
      addToHistory: (record) => {
        console.log("[timer-store] Adding to history:", {
          sessionName: record.sessionName,
          duration: record.duration,
          mode: record.mode,
          isCompleted: record.isCompleted,
        });

        const newRecord: PomodoroRecord = {
          ...record,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };

        set({
          pomodoroHistory: [...get().pomodoroHistory, newRecord].slice(-100), // Keep last 100 records
        });

        // Sync sessions to database (for dashboard stats)
        // Sync both completed sessions AND manual completions with meaningful time (> 1 min)
        if (record.duration >= 60) {
          const minutes = Math.floor(record.duration / 60);
          console.log(`[timer-store] Syncing ${minutes} minutes to database...`);
          syncStudyTimeToDatabase(minutes, record.sessionName, record.mode);
        } else {
          console.log(`[timer-store] Session too short (${record.duration}s), not syncing`);
        }
      },

      clearHistory: () => {
        set({ pomodoroHistory: [] });
      },

      getTodaysSessions: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();

        return get().pomodoroHistory.filter(
          (record) => record.startTime >= todayStart
        );
      },

      getTotalFocusTime: (days = 1) => {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

        // Include ALL sessions (both completed and manually stopped) for stats
        return get().pomodoroHistory
          .filter((record) => record.startTime >= cutoff)
          .reduce((total, record) => total + record.duration, 0);
      },
    }),
    {
      name: "timer-storage",
      partialize: (state) => ({
        pomodoroConfig: {
          workMinutes: state.pomodoroConfig.workMinutes,
          breakMinutes: state.pomodoroConfig.breakMinutes,
          longBreakMinutes: state.pomodoroConfig.longBreakMinutes,
          sessionsUntilLongBreak: state.pomodoroConfig.sessionsUntilLongBreak,
          autoStartBreaks: state.pomodoroConfig.autoStartBreaks,
          currentSession: state.pomodoroConfig.currentSession,
          completedSessions: state.pomodoroConfig.completedSessions,
        },
        mode: state.mode,
        status: state.status === "running" ? "paused" : state.status, // Don't persist "running"
        elapsedSeconds: state.elapsedSeconds,
        targetSeconds: state.targetSeconds,
        sessionStartTime: state.sessionStartTime,
        totalSessionSeconds: state.totalSessionSeconds,
        currentSessionName: state.currentSessionName,
        lastTickTime: state.lastTickTime,
        wasRunning: state.wasRunning,
        pomodoroHistory: state.pomodoroHistory,
      }),
      // Sanitize persisted data on load to fix NaN/undefined values
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Fix completedSessions if it's NaN or undefined
          if (state.pomodoroConfig && (isNaN(state.pomodoroConfig.completedSessions) || state.pomodoroConfig.completedSessions === undefined)) {
            state.pomodoroConfig.completedSessions = 0;
          }
          // Fix other numeric values
          if (isNaN(state.elapsedSeconds) || state.elapsedSeconds === undefined) {
            state.elapsedSeconds = 0;
          }
          if (isNaN(state.totalSessionSeconds) || state.totalSessionSeconds === undefined) {
            state.totalSessionSeconds = 0;
          }
        }
      },
    }
  )
);
