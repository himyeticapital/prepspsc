"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { X, Crown, Flame, BookOpen, BarChart3, Trophy } from "lucide-react";

interface MemberProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp_level: number;
  current_streak: number;
}

interface MemberStats {
  userId: string;
  testsCompleted: number;
  avgScore: number;
}

interface RoomComparisonProps {
  memberIds: string[];
  currentUserId: string;
  onClose: () => void;
}

interface StatRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  value: number;
  rank: number;
}

function StatSection({
  title,
  icon,
  barColor,
  rows,
  currentUserId,
  formatValue,
}: {
  title: string;
  icon: React.ReactNode;
  barColor: string;
  rows: StatRow[];
  currentUserId: string;
  formatValue?: (v: number) => string;
}) {
  const maxValue = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const isCurrentUser = row.userId === currentUserId;
          const isTopScorer = row.rank === 1 && row.value > 0;
          const barWidth = maxValue > 0 ? (row.value / maxValue) * 100 : 0;

          return (
            <div
              key={row.userId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                isCurrentUser
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-white/5"
              )}
            >
              {/* Rank */}
              <span className="text-xs font-bold text-zinc-500 w-5 text-center shrink-0">
                {isTopScorer ? (
                  <Crown className="w-4 h-4 text-amber-400 mx-auto" />
                ) : (
                  `#${row.rank}`
                )}
              </span>

              {/* Avatar */}
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-white/10">
                {row.avatarUrl ? (
                  <img
                    src={row.avatarUrl}
                    alt={row.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-zinc-400">
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Name + Bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm truncate",
                      isCurrentUser
                        ? "text-white font-medium"
                        : "text-zinc-300"
                    )}
                  >
                    {row.name}
                    {isCurrentUser && (
                      <span className="text-xs text-zinc-500 ml-1">(you)</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold ml-2 shrink-0",
                      isTopScorer ? "text-amber-400" : "text-zinc-400"
                    )}
                  >
                    {formatValue ? formatValue(row.value) : row.value}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", barColor)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildRankedRows(
  profiles: MemberProfile[],
  getValue: (profile: MemberProfile, stats: MemberStats | undefined) => number,
  memberStats: MemberStats[]
): StatRow[] {
  const rows = profiles.map((p) => {
    const stats = memberStats.find((s) => s.userId === p.id);
    return {
      userId: p.id,
      name: p.full_name || p.username || "Unknown",
      avatarUrl: p.avatar_url,
      value: getValue(p, stats),
      rank: 0,
    };
  });

  // Sort descending by value
  rows.sort((a, b) => b.value - a.value);

  // Assign ranks (handle ties)
  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].value < rows[i - 1].value) {
      currentRank = i + 1;
    }
    rows[i].rank = currentRank;
  }

  return rows;
}

export function RoomComparison({
  memberIds,
  currentUserId,
  onClose,
}: RoomComparisonProps) {
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!memberIds.length) return;

    const fetchData = async () => {
      setIsLoading(true);
      const supabase = createClient();

      // Fetch profiles and test attempts in parallel
      const [profilesRes, attemptsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url, xp_level, current_streak")
          .in("id", memberIds),
        supabase
          .from("test_attempts")
          .select("user_id, score")
          .in("user_id", memberIds)
          .eq("status", "completed"),
      ]);

      if (profilesRes.data) {
        setProfiles(profilesRes.data);
      }

      // Aggregate test attempts client-side
      if (attemptsRes.data) {
        const statsMap = new Map<string, { count: number; totalScore: number }>();

        for (const attempt of attemptsRes.data) {
          const existing = statsMap.get(attempt.user_id) || {
            count: 0,
            totalScore: 0,
          };
          existing.count += 1;
          existing.totalScore += attempt.score ?? 0;
          statsMap.set(attempt.user_id, existing);
        }

        const stats: MemberStats[] = memberIds.map((uid) => {
          const s = statsMap.get(uid);
          return {
            userId: uid,
            testsCompleted: s?.count ?? 0,
            avgScore: s && s.count > 0 ? Math.round(s.totalScore / s.count) : 0,
          };
        });

        setMemberStats(stats);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [memberIds]);

  const xpRows = useMemo(
    () => buildRankedRows(profiles, (p) => p.xp_level, memberStats),
    [profiles, memberStats]
  );

  const streakRows = useMemo(
    () => buildRankedRows(profiles, (p) => p.current_streak, memberStats),
    [profiles, memberStats]
  );

  const testsRows = useMemo(
    () =>
      buildRankedRows(
        profiles,
        (_p, stats) => stats?.testsCompleted ?? 0,
        memberStats
      ),
    [profiles, memberStats]
  );

  const avgScoreRows = useMemo(
    () =>
      buildRankedRows(
        profiles,
        (_p, stats) => stats?.avgScore ?? 0,
        memberStats
      ),
    [profiles, memberStats]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-zinc-900/95 backdrop-blur border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/95 backdrop-blur rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">
              Group Comparison
            </h2>
            <span className="text-xs text-zinc-500 ml-1">
              {memberIds.length} members
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-zinc-400">
                Loading stats...
              </span>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No members found.
            </div>
          ) : (
            <>
              {/* XP Level */}
              <StatSection
                title="XP Level"
                icon={<Trophy className="w-4 h-4 text-primary" />}
                barColor="bg-primary"
                rows={xpRows}
                currentUserId={currentUserId}
                formatValue={(v) => `Lv ${v}`}
              />

              {/* Study Streak */}
              <StatSection
                title="Study Streak"
                icon={<Flame className="w-4 h-4 text-orange-400" />}
                barColor="bg-orange-500"
                rows={streakRows}
                currentUserId={currentUserId}
                formatValue={(v) => `${v}d`}
              />

              {/* Tests Completed */}
              <StatSection
                title="Tests Completed"
                icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
                barColor="bg-emerald-500"
                rows={testsRows}
                currentUserId={currentUserId}
              />

              {/* Average Score */}
              <StatSection
                title="Average Score"
                icon={<BarChart3 className="w-4 h-4 text-purple-400" />}
                barColor="bg-purple-500"
                rows={avgScoreRows}
                currentUserId={currentUserId}
                formatValue={(v) => `${v}%`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
