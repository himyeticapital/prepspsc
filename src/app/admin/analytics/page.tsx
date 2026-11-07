"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Clock,
  Target,
  Award,
  Activity,
  Bot,
  DollarSign,
  Search,
  Crown,
  Flame,
  Zap,
  Sparkles,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  PenTool,
  GraduationCap,
  FileText,
  Map,
  HelpCircle,
  Image,
  MessageSquare,
  Radio,
  Music,
  Timer,
  Newspaper,
  Hash,
  DoorOpen,
} from "lucide-react";
import { getIndividualUserAnalytics, getUserDetail, getRoomAnalytics, getFeatureAnalytics } from "./actions";

interface OverviewStats {
  totalUsers: number;
  activeUsersToday: number;
  testsCompleted: number;
  averageScore: number;
  totalStudyHours: number;
  proMembers: number;
}

interface TestPerformance {
  name: string;
  attempts: number;
  avgScore: number;
  passRate: number;
}

interface TopPerformer {
  name: string;
  score: number;
  tests: number;
  rank: number;
}

interface AIUsageStats {
  conventionalAnswers: number;
  mcqExplanations: number;
  studyAIGenerations: number;
  blurtSessions: number;
  estimatedCost: number;
}

interface UserAnalytic {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  is_pro_member: boolean;
  xp_points: number;
  xp_level: number;
  current_streak: number;
  max_streak: number;
  total_minutes: number;
  recent_minutes_7d: number;
  tests_taken: number;
  avg_score: number;
  ai_generations: number;
  last_active: string | null;
  joined: string;
}

interface UserDetail {
  tests: {
    id: number;
    test_title: string;
    score: number | null;
    total_marks: number | null;
    percent: number | null;
    status: string;
    time_taken_seconds: number | null;
    attempt_number: number;
    date: string;
  }[];
  ai: {
    breakdown: Record<string, number>;
    recent: { type: string; title: string | null; date: string }[];
  };
  blurts: {
    topic: string | null;
    mode: string;
    score: number | null;
    date: string;
  }[];
  guided: {
    subject: string | null;
    topics: string[];
    status: string;
    exchanges: number;
    checkpoints: string;
    understanding: number | null;
    date: string;
  }[];
}

type SortField = "total_minutes" | "tests_taken" | "avg_score" | "xp_points" | "current_streak" | "recent_minutes_7d" | "joined";

// AI Cost per request (all using gemini-3-flash-preview)
// gemini-3-flash-preview: $0.50/1M input, $3.00/1M output
const AI_COST_PER_REQUEST = {
  conventionalGrading: 0.005,   // ~3000 input + ~1200 output tokens @ 3.0-flash
  mcqExplanation: 0.0015,       // ~600 input + ~400 output tokens @ 3.0-flash
  studyAIGeneration: 0.0075,    // ~3000 input + ~2000 output tokens @ 3.0-flash
  blurtAnalysis: 0.0025,        // ~2000 input + ~500 output tokens @ 3.0-flash
};

export default function AdminAnalyticsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");
  const [stats, setStats] = useState<OverviewStats>({
    totalUsers: 0,
    activeUsersToday: 0,
    testsCompleted: 0,
    averageScore: 0,
    totalStudyHours: 0,
    proMembers: 0,
  });
  const [testPerformance, setTestPerformance] = useState<TestPerformance[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsageStats>({
    conventionalAnswers: 0,
    mcqExplanations: 0,
    studyAIGenerations: 0,
    blurtSessions: 0,
    estimatedCost: 0,
  });

  // Individual user analytics
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytic[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("total_minutes");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Room analytics
  const [roomStats, setRoomStats] = useState<{ id: number; name: string; category: string | null; privacy_level: string; subscribers: number; subscriber_names: { name: string; joined_at: string }[]; total_messages: number; unique_chatters: number; top_chatters: { name: string; messages: number }[] }[]>([]);
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [userRoomActivity, setUserRoomActivity] = useState<Record<string, { rooms_subscribed: string[]; messages_sent: number }>>({});

  // Feature analytics
  const [featureStats, setFeatureStats] = useState<{ feature: string; total_uses: number; unique_users: number }[]>([]);
  const [userFeatureUsage, setUserFeatureUsage] = useState<Record<string, Record<string, number>>>({});

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch pro members
      const { count: proMembers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_pro_member", true);

      // Fetch completed test attempts
      const { data: testAttempts } = await supabase
        .from("test_attempts")
        .select("score, total_marks")
        .eq("status", "completed");

      const testsCompleted = testAttempts?.length || 0;

      // Calculate average score
      let averageScore = 0;
      if (testAttempts && testAttempts.length > 0) {
        const totalPercent = testAttempts.reduce((sum, a) => {
          if (a.score && a.total_marks) {
            return sum + (a.score / a.total_marks) * 100;
          }
          return sum;
        }, 0);
        averageScore = Math.round(totalPercent / testAttempts.length);
      }

      // Fetch total study hours
      const { data: studyLogs } = await supabase
        .from("daily_study_logs")
        .select("minutes_studied");

      const totalStudyMinutes = studyLogs?.reduce((sum, l) => sum + l.minutes_studied, 0) || 0;
      const totalStudyHours = Math.round(totalStudyMinutes / 60);

      // Fetch test performance data
      const { data: tests } = await supabase
        .from("tests")
        .select("id, title")
        .limit(5);

      const performanceData: TestPerformance[] = [];
      if (tests) {
        for (const test of tests) {
          const { data: attempts } = await supabase
            .from("test_attempts")
            .select("score, total_marks")
            .eq("test_id", test.id)
            .eq("status", "completed");

          if (attempts && attempts.length > 0) {
            const avgScore = Math.round(
              attempts.reduce((sum, a) => sum + ((a.score || 0) / (a.total_marks || 1)) * 100, 0) / attempts.length
            );
            const passRate = Math.round(
              (attempts.filter((a) => ((a.score || 0) / (a.total_marks || 1)) >= 0.4).length / attempts.length) * 100
            );

            performanceData.push({
              name: test.title,
              attempts: attempts.length,
              avgScore,
              passRate,
            });
          }
        }
      }
      setTestPerformance(performanceData);

      // Fetch top performers
      const { data: topUsers } = await supabase
        .from("profiles")
        .select("full_name, username")
        .order("total_minutes_all_time", { ascending: false })
        .limit(5);

      const performers: TopPerformer[] = [];
      if (topUsers) {
        for (let i = 0; i < topUsers.length; i++) {
          const user = topUsers[i];
          performers.push({
            name: user.full_name || user.username || "Unknown",
            score: 0,
            tests: 0,
            rank: i + 1,
          });
        }
      }
      setTopPerformers(performers);

      setStats({
        totalUsers: totalUsers || 0,
        activeUsersToday: 0, // Would need daily tracking to calculate
        testsCompleted,
        averageScore,
        totalStudyHours,
        proMembers: proMembers || 0,
      });

      // Fetch AI usage stats
      const { count: conventionalAnswers } = await supabase
        .from("user_answers")
        .select("*", { count: "exact", head: true })
        .not("answer_file_url", "is", null);

      const { count: mcqAnswers } = await supabase
        .from("user_answers")
        .select("*", { count: "exact", head: true })
        .not("ai_feedback", "is", null)
        .is("answer_file_url", null);

      const { count: studyAIGenerations } = await supabase
        .from("ai_generations")
        .select("*", { count: "exact", head: true });

      const { count: blurtSessions } = await supabase
        .from("blurt_sessions")
        .select("*", { count: "exact", head: true });

      // Calculate estimated cost
      const convCost = (conventionalAnswers || 0) * AI_COST_PER_REQUEST.conventionalGrading;
      const mcqCost = (mcqAnswers || 0) * AI_COST_PER_REQUEST.mcqExplanation;
      const studyCost = (studyAIGenerations || 0) * AI_COST_PER_REQUEST.studyAIGeneration;
      const blurtCost = (blurtSessions || 0) * AI_COST_PER_REQUEST.blurtAnalysis;
      const totalCost = convCost + mcqCost + studyCost + blurtCost;

      setAiUsage({
        conventionalAnswers: conventionalAnswers || 0,
        mcqExplanations: mcqAnswers || 0,
        studyAIGenerations: studyAIGenerations || 0,
        blurtSessions: blurtSessions || 0,
        estimatedCost: totalCost,
      });

      setIsLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // Fetch individual user analytics
  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        const data = await getIndividualUserAnalytics();
        setUserAnalytics(data);
      } catch {
        // silently fail
      } finally {
        setUsersLoading(false);
      }
    })();
  }, []);

  // Fetch room and feature analytics
  useEffect(() => {
    (async () => {
      try {
        const [roomData, featureData] = await Promise.all([
          getRoomAnalytics(),
          getFeatureAnalytics(),
        ]);
        setRoomStats(roomData.roomStats);
        setUserRoomActivity(roomData.userRoomActivity);
        setFeatureStats(featureData.featureStats);
        setUserFeatureUsage(featureData.userFeatureUsage);
      } catch {
        // silently fail
      }
    })();
  }, []);

  const filteredUsers = useMemo(() => {
    let filtered = userAnalytics;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [userAnalytics, userSearch, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortAsc ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  };

  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const toggleExpand = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setUserDetail(null);
      return;
    }
    setExpandedUserId(userId);
    setDetailLoading(true);
    try {
      const detail = await getUserDetail(userId);
      setUserDetail(detail);
    } catch {
      setUserDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const aiTypeIcon: Record<string, React.ReactNode> = {
    summary: <FileText className="w-3.5 h-3.5 text-blue-400" />,
    quiz: <HelpCircle className="w-3.5 h-3.5 text-green-400" />,
    flashcards: <BookOpen className="w-3.5 h-3.5 text-yellow-400" />,
    mindmap: <Map className="w-3.5 h-3.5 text-purple-400" />,
    infographic: <Image className="w-3.5 h-3.5 text-pink-400" />,
  };

  const aiTypeLabel: Record<string, string> = {
    summary: "Summaries",
    quiz: "Quizzes",
    flashcards: "Flashcards",
    mindmap: "Mind Maps",
    infographic: "Infographics",
  };

  const featureLabel: Record<string, string> = {
    "widget:timer": "Timer",
    "widget:music": "Music Player",
    "widget:notes": "Notes",
    "widget:tests": "Tests",
    "widget:stats": "Stats",
    "widget:leaderboard": "Leaderboard",
    "widget:chat": "Chat",
    "widget:bookmarks": "Bookmarks",
    "widget:background": "Background",
    "widget:settings": "Settings",
    "widget:notifications": "Notifications",
    "news_bot": "News Bot",
    "news_bot:category": "News Category Switch",
  };

  const featureIcon: Record<string, React.ReactNode> = {
    "widget:timer": <Timer className="w-4 h-4 text-orange-400" />,
    "widget:music": <Music className="w-4 h-4 text-purple-400" />,
    "widget:notes": <FileText className="w-4 h-4 text-blue-400" />,
    "widget:tests": <BookOpen className="w-4 h-4 text-green-400" />,
    "widget:stats": <BarChart3 className="w-4 h-4 text-cyan-400" />,
    "widget:leaderboard": <Award className="w-4 h-4 text-yellow-400" />,
    "widget:chat": <MessageSquare className="w-4 h-4 text-indigo-400" />,
    "widget:bookmarks": <BookOpen className="w-4 h-4 text-pink-400" />,
    "news_bot": <Newspaper className="w-4 h-4 text-emerald-400" />,
    "news_bot:category": <Hash className="w-4 h-4 text-teal-400" />,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Platform performance and user insights
          </p>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <Users className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Today
            </CardTitle>
            <Activity className="w-4 h-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsersToday}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUsers > 0
                ? `${((stats.activeUsersToday / stats.totalUsers) * 100).toFixed(1)}% of total`
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tests Completed
            </CardTitle>
            <BookOpen className="w-4 h-4 text-chart-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.testsCompleted.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Score
            </CardTitle>
            <Target className="w-4 h-4 text-chart-5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageScore > 0 ? `${stats.averageScore}%` : "N/A"}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Study Hours
            </CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudyHours.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total platform hours</p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pro Members
            </CardTitle>
            <Award className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.proMembers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUsers > 0
                ? `${((stats.proMembers / stats.totalUsers) * 100).toFixed(1)}% conversion`
                : "No data"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Test Performance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Test Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {testPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No test data available
              </p>
            ) : (
              <div className="space-y-4">
                {testPerformance.map((test, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[200px]">
                        {test.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{test.attempts} attempts</Badge>
                        <Badge
                          variant={test.passRate >= 70 ? "default" : test.passRate >= 50 ? "secondary" : "destructive"}
                        >
                          {test.passRate}% pass
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${test.avgScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Average Score: {test.avgScore}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signups by week */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            {userAnalytics.length > 0 ? (
              <div className="space-y-3">
                {(() => {
                  const now = new Date();
                  const buckets = [
                    { label: "Today", count: 0 },
                    { label: "This week", count: 0 },
                    { label: "This month", count: 0 },
                    { label: "Older", count: 0 },
                  ];
                  userAnalytics.forEach((u) => {
                    const d = new Date(u.joined);
                    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
                    if (diffDays === 0) buckets[0].count++;
                    else if (diffDays < 7) buckets[1].count++;
                    else if (diffDays < 30) buckets[2].count++;
                    else buckets[3].count++;
                  });
                  const max = Math.max(...buckets.map((b) => b.count), 1);
                  return buckets.map((b) => (
                    <div key={b.label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 shrink-0">{b.label}</span>
                      <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary rounded transition-all"
                          style={{ width: `${(b.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{b.count}</span>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Cost Estimation */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Usage & Cost Estimation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Conventional Grading</p>
              <p className="text-xl font-bold">{aiUsage.conventionalAnswers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0008/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">MCQ Explanations</p>
              <p className="text-xl font-bold">{aiUsage.mcqExplanations.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0002/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Study AI Generations</p>
              <p className="text-xl font-bold">{aiUsage.studyAIGenerations.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0011/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Blurt Sessions</p>
              <p className="text-xl font-bold">{aiUsage.blurtSessions.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0004/req</p>
            </div>
            <div className="p-4 rounded-lg bg-primary/20 border border-primary/30">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Est. Total Cost
              </p>
              <p className="text-2xl font-bold text-primary">${aiUsage.estimatedCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">All-time usage</p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-2">Model Configuration:</p>
            <div className="text-xs text-muted-foreground">
              <div>
                <Badge variant="outline" className="mb-1">All Features</Badge>
                <p>gemini-3-flash-preview @ $0.50/1M input, $3.00/1M output</p>
                <p className="text-white/60">Used for: Grading, MCQ, Study AI, Blurt Analysis, OCR</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Study Room Analytics */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-indigo-400" />
            Study Room Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {roomStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No room data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subscribers</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Active Chatters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomStats.map((room) => (
                    <React.Fragment key={room.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-secondary/60"
                        onClick={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedRoomId === room.id ? "rotate-90" : ""}`} />
                            <span className="font-medium">{room.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {room.category ? (
                            <Badge variant="outline">{room.category}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {room.subscribers}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-muted-foreground" />
                            {room.total_messages.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>{room.unique_chatters}</TableCell>
                      </TableRow>
                      {expandedRoomId === room.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-secondary/30 p-0">
                            <div className="p-4 grid md:grid-cols-2 gap-4">
                              {/* Subscribers */}
                              <div>
                                <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                                  Subscribers ({room.subscriber_names.length})
                                </h5>
                                {room.subscriber_names.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No subscribers</p>
                                ) : (
                                  <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                                    {room.subscriber_names.map((sub, i) => (
                                      <div key={i} className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/50">
                                        <span className="text-xs font-medium">{sub.name}</span>
                                        <span className="text-[11px] text-muted-foreground">{timeAgo(sub.joined_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {/* Top Chatters */}
                              <div>
                                <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                                  <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                                  Top Chatters
                                </h5>
                                {room.top_chatters.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No messages yet</p>
                                ) : (
                                  <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                                    {room.top_chatters.map((chatter, i) => (
                                      <div key={i} className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/50">
                                        <span className="text-xs font-medium">{chatter.name}</span>
                                        <span className="text-xs text-muted-foreground">{chatter.messages} msgs</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Widget & Feature Usage */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400" />
            Widget &amp; Feature Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {featureStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No usage data yet — tracking starts now</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {featureStats.map((f) => (
                <div key={f.feature} className="p-4 rounded-lg bg-secondary/50 flex items-center gap-3">
                  {featureIcon[f.feature] || <Activity className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{featureLabel[f.feature] || f.feature}</p>
                    <p className="text-xs text-muted-foreground">{f.unique_users} users</p>
                  </div>
                  <span className="text-lg font-bold">{f.total_uses.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual User Analytics */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Individual User Analytics
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {usersLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Loading user data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("tests_taken")} className="flex items-center hover:text-foreground transition-colors">
                      Tests <SortIcon field="tests_taken" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("avg_score")} className="flex items-center hover:text-foreground transition-colors">
                      Avg Score <SortIcon field="avg_score" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("total_minutes")} className="flex items-center hover:text-foreground transition-colors">
                      Study Time <SortIcon field="total_minutes" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("recent_minutes_7d")} className="flex items-center hover:text-foreground transition-colors">
                      Last 7d <SortIcon field="recent_minutes_7d" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("current_streak")} className="flex items-center hover:text-foreground transition-colors">
                      Streak <SortIcon field="current_streak" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("xp_points")} className="flex items-center hover:text-foreground transition-colors">
                      XP <SortIcon field="xp_points" />
                    </button>
                  </TableHead>
                  <TableHead>AI</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort("joined")} className="flex items-center hover:text-foreground transition-colors">
                      Joined <SortIcon field="joined" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <React.Fragment key={u.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-secondary/60"
                      onClick={() => toggleExpand(u.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-[160px]">
                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedUserId === u.id ? "rotate-90" : ""}`} />
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(u.full_name || u.username || "?")[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              {u.full_name || u.username || "Unknown"}
                              {u.is_pro_member && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
                            </div>
                            {u.username && (
                              <div className="text-[11px] text-muted-foreground">@{u.username}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${u.tests_taken > 0 ? "" : "text-muted-foreground"}`}>
                          {u.tests_taken || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.tests_taken > 0 ? (
                          <Badge
                            variant="outline"
                            className={
                              u.avg_score >= 70
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : u.avg_score >= 40
                                ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            }
                          >
                            {u.avg_score}%
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.total_minutes > 0 ? formatMinutes(u.total_minutes) : "—"}
                      </TableCell>
                      <TableCell>
                        {u.recent_minutes_7d > 0 ? (
                          <span className="text-sm text-green-500 font-medium">{formatMinutes(u.recent_minutes_7d)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Flame className={`w-3.5 h-3.5 ${u.current_streak > 0 ? "text-orange-500" : "text-muted-foreground/30"}`} />
                          <span className="text-sm">{u.current_streak}d</span>
                        </div>
                        {u.max_streak > 0 && u.max_streak > u.current_streak && (
                          <div className="text-[10px] text-muted-foreground">best: {u.max_streak}d</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-primary" />
                          <span className="text-sm">{u.xp_points.toLocaleString()}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">Lv.{u.xp_level}</div>
                      </TableCell>
                      <TableCell>
                        {u.ai_generations > 0 ? (
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span className="text-sm">{u.ai_generations}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {u.last_active ? timeAgo(u.last_active) : "Never"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(u.joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                      </TableCell>
                    </TableRow>
                    {/* Expanded detail row */}
                    {expandedUserId === u.id && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-secondary/30 p-0">
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Loading details...</span>
                            </div>
                          ) : userDetail ? (
                            <div className="p-5 space-y-5">
                              <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5">
                                {/* Test History */}
                                <div>
                                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <BookOpen className="w-4 h-4 text-chart-4" />
                                    Test History ({userDetail.tests.length})
                                  </h4>
                                  {userDetail.tests.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-3">No tests taken</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                                      {userDetail.tests.map((t) => (
                                        <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{t.test_title}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                              {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                                              {t.time_taken_seconds && ` · ${Math.round(t.time_taken_seconds / 60)}min`}
                                              {t.attempt_number > 1 && ` · Attempt #${t.attempt_number}`}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2 ml-3">
                                            {t.status === "completed" && t.percent != null ? (
                                              <Badge
                                                variant="outline"
                                                className={
                                                  t.percent >= 70
                                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                                    : t.percent >= 40
                                                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                                }
                                              >
                                                {t.score}/{t.total_marks} ({t.percent}%)
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-muted-foreground">{t.status}</Badge>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* AI Usage */}
                                <div>
                                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <Sparkles className="w-4 h-4 text-purple-400" />
                                    AI Feature Usage
                                  </h4>

                                  {/* Type breakdown */}
                                  {Object.keys(userDetail.ai.breakdown).length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      {Object.entries(userDetail.ai.breakdown).map(([type, count]) => (
                                        <div key={type} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background/60 border border-border/50">
                                          {aiTypeIcon[type] || <Sparkles className="w-3.5 h-3.5" />}
                                          <span className="text-xs font-medium">{aiTypeLabel[type] || type}</span>
                                          <span className="text-xs text-muted-foreground">({count})</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Recent AI generations */}
                                  {userDetail.ai.recent.length > 0 && (
                                    <div className="space-y-1.5 mb-4 max-h-[140px] overflow-y-auto pr-1">
                                      {userDetail.ai.recent.map((g, i) => (
                                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/50">
                                          {aiTypeIcon[g.type] || <Sparkles className="w-3.5 h-3.5" />}
                                          <span className="text-xs flex-1 truncate">{g.title || `Untitled ${g.type}`}</span>
                                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(g.date)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Blurt sessions */}
                                  {userDetail.blurts.length > 0 && (
                                    <>
                                      <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2 mt-3">
                                        <PenTool className="w-3.5 h-3.5 text-orange-400" />
                                        Blurt Sessions ({userDetail.blurts.length})
                                      </h5>
                                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                                        {userDetail.blurts.map((b, i) => (
                                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50">
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline" className="text-[10px] px-1.5">{b.mode}</Badge>
                                              <span className="text-xs truncate max-w-[180px]">{b.topic || "Untitled"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {b.score != null && (
                                                <span className="text-xs font-medium">{b.score}/10</span>
                                              )}
                                              <span className="text-[11px] text-muted-foreground">{timeAgo(b.date)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {/* Guided learning */}
                                  {userDetail.guided.length > 0 && (
                                    <>
                                      <h5 className="text-xs font-semibold flex items-center gap-1.5 mb-2 mt-3">
                                        <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                                        Guided Learning ({userDetail.guided.length})
                                      </h5>
                                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                                        {userDetail.guided.map((s, i) => (
                                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/60 border border-border/50">
                                            <div>
                                              <span className="text-xs font-medium">{s.subject || "General"}</span>
                                              <span className="text-[11px] text-muted-foreground ml-2">{s.exchanges} messages · {s.checkpoints} checkpoints</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {s.understanding != null && (
                                                <Badge variant="outline" className={
                                                  s.understanding >= 70
                                                    ? "bg-green-500/10 text-green-500 border-green-500/20 text-[10px]"
                                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]"
                                                }>
                                                  {s.understanding}%
                                                </Badge>
                                              )}
                                              <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}

                                  {Object.keys(userDetail.ai.breakdown).length === 0 &&
                                    userDetail.blurts.length === 0 &&
                                    userDetail.guided.length === 0 && (
                                    <p className="text-xs text-muted-foreground py-3">No AI feature usage</p>
                                  )}
                                </div>

                                {/* Room & Widget Usage */}
                                <div>
                                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <DoorOpen className="w-4 h-4 text-indigo-400" />
                                    Rooms & Widgets
                                  </h4>

                                  {/* Room subscriptions */}
                                  {userRoomActivity[u.id] && userRoomActivity[u.id].rooms_subscribed.length > 0 ? (
                                    <div className="mb-3">
                                      <p className="text-xs text-muted-foreground mb-1.5">
                                        Subscribed rooms ({userRoomActivity[u.id].rooms_subscribed.length})
                                        {userRoomActivity[u.id].messages_sent > 0 && (
                                          <span> · {userRoomActivity[u.id].messages_sent} messages</span>
                                        )}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {userRoomActivity[u.id].rooms_subscribed.map((name, i) => (
                                          <Badge key={i} variant="outline" className="text-[10px]">{name}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground mb-3">No room activity</p>
                                  )}

                                  {/* Widget usage */}
                                  {userFeatureUsage[u.id] && Object.keys(userFeatureUsage[u.id]).length > 0 ? (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1.5">Feature usage</p>
                                      <div className="space-y-1">
                                        {Object.entries(userFeatureUsage[u.id])
                                          .sort(([, a], [, b]) => b - a)
                                          .map(([feature, count]) => (
                                            <div key={feature} className="flex items-center justify-between p-1.5 rounded bg-background/60 border border-border/50">
                                              <div className="flex items-center gap-1.5">
                                                {featureIcon[feature] || <Activity className="w-3 h-3" />}
                                                <span className="text-xs">{featureLabel[feature] || feature}</span>
                                              </div>
                                              <span className="text-xs font-medium text-muted-foreground">{count}x</span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No widget usage</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-6">Failed to load details</p>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
