"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatTime, calculatePercentage } from "@/lib/utils";
import {
  Trophy,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  ArrowLeft,
  RotateCcw,
  ChevronRight,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import type {
  Test,
  TestAnalytics,
  TestAttempt,
  TestSection,
  UserAnswer,
  Question,
  ImprovementTrend,
  MCQFeedback,
  ConventionalFeedback,
} from "@/types/database.types";

interface AttemptWithAnswers extends TestAttempt {
  user_answers: (UserAnswer & { question: Question })[];
}

interface TestAnalyticsClientProps {
  test: Test;
  analytics: TestAnalytics | null;
  attempts: AttemptWithAnswers[];
  sections: TestSection[];
}

// Type guards
function isMCQFeedback(feedback: unknown): feedback is MCQFeedback {
  return (
    typeof feedback === "object" &&
    feedback !== null &&
    "isCorrect" in feedback &&
    "explanation" in feedback
  );
}

function isConventionalFeedback(feedback: unknown): feedback is ConventionalFeedback {
  return (
    typeof feedback === "object" &&
    feedback !== null &&
    "score" in feedback &&
    "feedback" in feedback &&
    "strengths" in feedback
  );
}

export function TestAnalyticsClient({
  test,
  analytics,
  attempts,
  sections,
}: TestAnalyticsClientProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate stats
  const totalAttempts = analytics?.total_attempts || attempts.length;
  const bestScore = analytics?.best_score || 0;
  const averageScore = analytics?.average_score || 0;
  const latestAttempt = attempts[0];
  const latestScore = latestAttempt
    ? calculatePercentage(latestAttempt.score || 0, latestAttempt.total_marks || test.total_marks || 100)
    : 0;

  // Improvement trend data
  const trendData: ImprovementTrend[] = Array.isArray(analytics?.improvement_trend)
    ? (analytics.improvement_trend as unknown as ImprovementTrend[])
    : attempts.map((a, i) => ({
        attempt: attempts.length - i,
        score: calculatePercentage(a.score || 0, a.total_marks || test.total_marks || 100),
        date: a.completed_at || a.started_at,
      })).reverse();

  // Section performance data
  const sectionPerformance = analytics?.section_performance as Record<string, number> || {};
  const sectionData = Object.entries(sectionPerformance).map(([name, score]) => ({
    name: name.length > 15 ? name.substring(0, 15) + "..." : name,
    fullName: name,
    score: Math.round(score),
  }));

  // Strengths and weaknesses
  const strengths = Array.isArray(analytics?.strengths) ? analytics.strengths as string[] : [];
  const weaknesses = Array.isArray(analytics?.weaknesses) ? analytics.weaknesses as string[] : [];

  // Get wrong questions from latest attempt
  const wrongQuestions = latestAttempt?.user_answers?.filter(
    (answer) => answer.question?.type === "mcq" ? !answer.is_correct : answer.marks_obtained < answer.question?.marks * 0.5
  ) || [];

  // No analytics yet
  if (!analytics && attempts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Analytics Yet</h1>
        <p className="text-muted-foreground mb-6">
          Complete the test at least once to see your performance analytics.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/tests">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tests
            </Link>
          </Button>
          <Button className="primary-glow" asChild>
            <Link href={`/test/${test.id}`}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Take Test
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Badge variant="outline">
              {test.test_type === "mcq" ? "MCQ" : test.test_type === "conventional" ? "Essay" : "Mixed"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{test.title}</h1>
          <p className="text-muted-foreground">Performance Analytics</p>
        </div>
        <Button className="primary-glow" asChild>
          <Link href={`/test/${test.id}`}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Test
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAttempts}</p>
                <p className="text-xs text-muted-foreground">Total Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Trophy className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(bestScore)}%</p>
                <p className="text-xs text-muted-foreground">Best Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(averageScore)}%</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(latestScore)}%</p>
                <p className="text-xs text-muted-foreground">Latest Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Score Trend
              </CardTitle>
              <CardDescription>Your performance over multiple attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex justify-center items-center">
                {isMounted && trendData.length > 1 ? (
                  <LineChart width={400} height={240} data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="attempt"
                      stroke="#a1a1aa"
                      fontSize={12}
                      tickFormatter={(value) => `#${value}`}
                    />
                    <YAxis
                      stroke="#a1a1aa"
                      fontSize={12}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [`${Math.round(value as number)}%`, "Score"]}
                      labelFormatter={(label) => `Attempt #${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#2dd4bf"
                      strokeWidth={2}
                      dot={{ fill: "#2dd4bf", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                ) : (
                  <p className="text-muted-foreground">
                    {!isMounted ? "Loading chart..." : "Complete more attempts to see your progress trend"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Section Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Section Performance
              </CardTitle>
              <CardDescription>Your performance by topic/section</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex justify-center items-center">
                {isMounted && sectionData.length > 0 ? (
                  <BarChart width={400} height={240} data={sectionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      type="number"
                      stroke="#a1a1aa"
                      fontSize={12}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="#a1a1aa"
                      fontSize={12}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value, _name, props) => [
                        `${value}%`,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (props as any).payload?.fullName,
                      ]}
                    />
                    <Bar
                      dataKey="score"
                      fill="#2dd4bf"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                ) : (
                  <p className="text-muted-foreground">
                    {!isMounted ? "Loading chart..." : "No section data available yet"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Strengths & Weaknesses */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {strengths.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle className="w-4 h-4" />
                  Strengths
                </CardTitle>
                <CardDescription>Topics you're doing well in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {strengths.map((strength, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-primary/5"
                    >
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm">{strength}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {weaknesses.length > 0 && (
            <Card className="border-orange-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-500">
                  <AlertTriangle className="w-4 h-4" />
                  Needs Improvement
                </CardTitle>
                <CardDescription>Topics to focus on</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {weaknesses.map((weakness, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/5"
                    >
                      <Lightbulb className="w-4 h-4 text-orange-500" />
                      <span className="text-sm">{weakness}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* Questions to Review */}
      {wrongQuestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Questions to Review
              </CardTitle>
              <CardDescription>
                Questions you got wrong in your last attempt
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {wrongQuestions.slice(0, 5).map((answer, index) => {
                  const question = answer.question;
                  if (!question) return null;

                  const aiFeedback = answer.ai_feedback;
                  const section = sections.find((s) => s.id === question.section_id);

                  return (
                    <div
                      key={answer.id}
                      className="p-4 rounded-lg border border-border bg-secondary/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                          <XCircle className="w-4 h-4 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm mb-1 line-clamp-2">
                            {question.content}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            {section && (
                              <Badge variant="outline" className="text-xs">
                                {section.name}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {question.marks} marks
                            </Badge>
                            {question.type === "mcq" && (
                              <span className="text-xs text-muted-foreground">
                                Your answer: {answer.user_answer || "Skipped"}
                              </span>
                            )}
                          </div>

                          {/* AI Explanation */}
                          {aiFeedback && isMCQFeedback(aiFeedback) && (
                            <div className="p-2 rounded bg-primary/5 border border-primary/10">
                              <p className="text-xs text-muted-foreground">
                                <span className="text-primary font-medium">Correct: </span>
                                {aiFeedback.explanation}
                              </p>
                            </div>
                          )}

                          {aiFeedback && isConventionalFeedback(aiFeedback) && (
                            <div className="p-2 rounded bg-primary/5 border border-primary/10">
                              <p className="text-xs text-muted-foreground">
                                <span className="text-primary font-medium">Feedback: </span>
                                {aiFeedback.feedback}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {wrongQuestions.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{wrongQuestions.length - 5} more questions to review
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* All Attempts */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              All Attempts
            </CardTitle>
            <CardDescription>
              Your complete attempt history for this test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempts.map((attempt, index) => {
                const attemptScore = calculatePercentage(
                  attempt.score || 0,
                  attempt.total_marks || test.total_marks || 100
                );
                const isPassed = test.passing_marks
                  ? (attempt.score || 0) >= test.passing_marks
                  : attemptScore >= 40;

                return (
                  <Link
                    key={attempt.id}
                    href={`/results/${attempt.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          isPassed ? "bg-primary/10" : "bg-destructive/10"
                        )}
                      >
                        {isPassed ? (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          Attempt #{attempt.attempt_number || attempts.length - index}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.completed_at || attempt.started_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p
                          className={cn(
                            "font-bold",
                            isPassed ? "text-primary" : "text-destructive"
                          )}
                        >
                          {attempt.score}/{attempt.total_marks || test.total_marks}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(attempt.time_taken_seconds || 0)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
