"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, Loader2, Play, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

interface MigrationStatus {
  total: number;
  migrated: number;
  remaining: number;
  percent: number;
}

interface MigrationResult {
  migrated: number;
  attempted: number;
  remaining: number;
  complete: boolean;
  errors?: Array<{ questionId: number; error: string }>;
}

export default function AIManagementPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/admin/generate-mcq-explanation");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const startMigration = async () => {
    setMigrating(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/cron/migrate-mcq-explanations");
      const data = await response.json();
      setLastResult(data);
      // Refresh status after migration
      await fetchStatus();
    } catch (error) {
      console.error("Migration failed:", error);
      setLastResult({
        migrated: 0,
        attempted: 0,
        remaining: status?.remaining || 0,
        complete: false,
        errors: [{ questionId: 0, error: "Migration request failed" }],
      });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            AI Management
          </h1>
          <p className="text-muted-foreground">
            Manage AI-powered features and migrations
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to Admin</Link>
        </Button>
      </div>

      {/* MCQ Explanation Migration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            MCQ AI Explanations
            {status?.percent === 100 ? (
              <Badge variant="default" className="bg-green-500">Complete</Badge>
            ) : (
              <Badge variant="secondary">In Progress</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Pregenerate AI explanations for MCQ questions to provide instant feedback during test results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Migration Progress</span>
              <span className="font-medium">
                {status?.migrated || 0}/{status?.total || 0} questions ({status?.percent || 0}%)
              </span>
            </div>
            <Progress value={status?.percent || 0} className="h-2" />
            {status?.remaining && status.remaining > 0 && (
              <p className="text-xs text-muted-foreground">
                {status.remaining} questions remaining
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={startMigration}
              disabled={migrating || status?.percent === 100}
            >
              {migrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : status?.percent === 100 ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  All Migrated
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Migration Batch
                </>
              )}
            </Button>
            <Button variant="outline" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>

          {/* Last Result */}
          {lastResult && (
            <div className={`p-4 rounded-lg border ${
              lastResult.errors?.length ? "border-destructive/50 bg-destructive/10" : "border-primary/50 bg-primary/10"
            }`}>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                {lastResult.errors?.length ? (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-primary" />
                )}
                Last Migration Result
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Migrated: {lastResult.migrated} of {lastResult.attempted} attempted</li>
                <li>Remaining: {lastResult.remaining} questions</li>
                {lastResult.complete && <li className="text-primary font-medium">Migration Complete!</li>}
                {lastResult.errors?.map((err, i) => (
                  <li key={i} className="text-destructive">
                    Question {err.questionId}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Info */}
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">How it works:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Each batch processes 3 questions (fits 30s timeout)</li>
              <li>External cron runs every minute for faster migration</li>
              <li>Questions without explanations use real-time AI (slower)</li>
              <li>Once migrated, test results are instant for MCQs</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Conventional Queue Status - could add more here */}
      <Card>
        <CardHeader>
          <CardTitle>Conventional Answer Queue</CardTitle>
          <CardDescription>
            Background processing queue for conventional (essay) answers that require personalized AI evaluation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Conventional answers are automatically queued and processed in the background.
            The cron job runs every minute to process pending evaluations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
