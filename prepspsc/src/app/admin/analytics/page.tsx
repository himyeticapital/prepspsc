"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

// AI Cost per request (using gemini-3-flash-preview)
// gemini-3-flash: $0.50/1M input, $3.00/1M output (6.5x more than 2.0-flash)
const AI_COST_PER_REQUEST = {
  conventionalGrading: 0.005,   // ~3000 input + ~1200 output tokens @ 3-flash
  mcqExplanation: 0.0013,       // ~600 input + ~400 output tokens @ 3-flash
  studyAIGeneration: 0.007,     // ~3000 input + ~2000 output tokens @ 3-flash
  blurtAnalysis: 0.0026,        // ~2000 input + ~500 output tokens @ 3-flash
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

        {/* Placeholder for activity chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Activity tracking coming soon
            </p>
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
              <p className="text-xs text-muted-foreground">@ $0.005/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">MCQ Explanations</p>
              <p className="text-xl font-bold">{aiUsage.mcqExplanations.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0013/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Study AI Generations</p>
              <p className="text-xl font-bold">{aiUsage.studyAIGenerations.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.007/req</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground mb-1">Blurt Sessions</p>
              <p className="text-xl font-bold">{aiUsage.blurtSessions.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">@ $0.0026/req</p>
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

      {/* Top Performers */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Top Study Time Users</CardTitle>
        </CardHeader>
        <CardContent>
          {topPerformers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No user data available
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {topPerformers.map((user, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    index === 0
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : index === 1
                      ? "bg-gray-400/10 border-gray-400/30"
                      : index === 2
                      ? "bg-orange-600/10 border-orange-600/30"
                      : "bg-secondary border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? "bg-yellow-500 text-black"
                          : index === 1
                          ? "bg-gray-400 text-black"
                          : index === 2
                          ? "bg-orange-600 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{user.rank}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
