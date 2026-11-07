"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ListChecks, Clock, ArrowRight } from "lucide-react";

interface TestReadyCardProps {
  testId: string;
  totalQuestions: number;
  generationTimeMs: number;
  examName: string;
}

export function TestReadyCard({
  testId,
  totalQuestions,
  generationTimeMs,
  examName,
}: TestReadyCardProps) {
  const router = useRouter();

  const generationTimeSec = (generationTimeMs / 1000).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
      className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 w-full max-w-md"
    >
      {/* Success Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-4.5 h-4.5 text-green-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-400">
            Your mock test is ready!
          </p>
          <p className="text-[11px] text-white/40">{examName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-white/50 mb-4">
        <span className="flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5 text-green-400/70" />
          {totalQuestions} questions
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-green-400/70" />
          Generated in {generationTimeSec}s
        </span>
      </div>

      {/* Start Button */}
      <Button
        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
        onClick={() => router.push(`/test/${testId}`)}
      >
        Start Test
        <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </motion.div>
  );
}
