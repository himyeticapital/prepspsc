"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Calendar,
  TrendingUp,
  PieChart,
  BarChart3,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InfographicOutput } from "@/types/study-ai.types";

interface InfographicViewerProps {
  generation: {
    id: number;
    goal_id: number;
    title: string;
    output_data: InfographicOutput;
    is_saved: boolean;
    created_at: string;
  };
  goalText: string;
}

export function InfographicViewer({ generation, goalText }: InfographicViewerProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(generation.is_saved);
  const [isSaving, setIsSaving] = useState(false);

  const infographicData = generation.output_data;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, isSaved: !isSaved }),
      });

      if (response.ok) {
        setIsSaved(!isSaved);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Get chart icon based on type
  const getChartIcon = (type: string) => {
    switch (type) {
      case "pie":
      case "doughnut":
        return <PieChart className="w-5 h-5" />;
      case "line":
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  // Simple bar chart renderer
  const renderBarChart = (labels: string[], data: number[], title: string) => {
    const maxValue = Math.max(...data);

    return (
      <div className="space-y-3">
        {labels.map((label, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/80">{label}</span>
              <span className="text-white/60">{data[index]}</span>
            </div>
            <div className="h-6 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(data[index] / maxValue) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Simple pie/doughnut chart renderer using CSS
  const renderPieChart = (labels: string[], data: number[], isDoughnut: boolean) => {
    const total = data.reduce((a, b) => a + b, 0);
    const colors = [
      "bg-primary",
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-cyan-500",
      "bg-yellow-500",
    ];

    let cumulativePercent = 0;
    const segments = data.map((value, index) => {
      const percent = (value / total) * 100;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;
      return { label: labels[index], value, percent, startPercent, color: colors[index % colors.length] };
    });

    // Create conic gradient
    const gradientStops = segments.map((seg, index) => {
      const color = seg.color.replace("bg-", "");
      const colorMap: Record<string, string> = {
        primary: "hsl(var(--primary))",
        "blue-500": "#3b82f6",
        "green-500": "#22c55e",
        "purple-500": "#a855f7",
        "orange-500": "#f97316",
        "pink-500": "#ec4899",
        "cyan-500": "#06b6d4",
        "yellow-500": "#eab308",
      };
      return `${colorMap[color] || "#6366f1"} ${seg.startPercent}% ${seg.startPercent + seg.percent}%`;
    }).join(", ");

    return (
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="relative">
          <div
            className="w-48 h-48 rounded-full"
            style={{
              background: `conic-gradient(${gradientStops})`,
            }}
          >
            {isDoughnut && (
              <div className="absolute inset-8 bg-card rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">{total}</span>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {segments.map((seg, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", seg.color)} />
              <span className="text-sm text-white/80">{seg.label}</span>
              <span className="text-sm text-white/60">({seg.percent.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Simple line chart renderer
  const renderLineChart = (labels: string[], data: number[]) => {
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue || 1;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - minValue) / range) * 80 - 10;
      return { x, y, value, label: labels[index] };
    });

    const pathD = points.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    ).join(" ");

    return (
      <div className="relative h-64">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="0.2"
            />
          ))}

          {/* Line */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Points */}
          {points.map((point, index) => (
            <motion.circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="hsl(var(--primary))"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1 }}
            />
          ))}
        </svg>

        {/* Labels */}
        <div className="flex justify-between mt-2">
          {labels.map((label, index) => (
            <span key={index} className="text-xs text-white/60 truncate max-w-[60px]">
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/study-ai/goals/${generation.goal_id}`)}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">{infographicData.title}</h1>
                {infographicData.subtitle && (
                  <p className="text-sm text-primary/80">{infographicData.subtitle}</p>
                )}
                <p className="text-sm text-white/60">{goalText}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "gap-2",
                isSaved && "text-primary border-primary"
              )}
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="space-y-8">
          {/* Key Facts */}
          {infographicData.keyFacts && infographicData.keyFacts.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Key Facts
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {infographicData.keyFacts.map((fact, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-card p-4 rounded-xl"
                  >
                    <p className="text-sm text-white/60 mb-1">{fact.label}</p>
                    <p className="text-2xl font-bold text-primary">{fact.value}</p>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Charts */}
          {infographicData.charts && infographicData.charts.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Data Visualizations
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {infographicData.charts.map((chart, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="glass-card p-6 rounded-xl"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      {getChartIcon(chart.type)}
                      <h3 className="font-semibold">{chart.title}</h3>
                    </div>

                    {chart.type === "bar" && renderBarChart(chart.labels, chart.data, chart.title)}
                    {(chart.type === "pie" || chart.type === "doughnut") &&
                      renderPieChart(chart.labels, chart.data, chart.type === "doughnut")}
                    {chart.type === "line" && renderLineChart(chart.labels, chart.data)}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Timeline */}
          {infographicData.timeline && infographicData.timeline.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Timeline
              </h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />

                <div className="space-y-4">
                  {infographicData.timeline.map((event, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="relative pl-10"
                    >
                      {/* Timeline dot */}
                      <div className="absolute left-2 top-2 w-4 h-4 rounded-full bg-primary border-2 border-background" />

                      <div className="glass-card p-4 rounded-xl">
                        <p className="text-sm font-semibold text-primary mb-1">
                          {event.date}
                        </p>
                        <p className="text-white/80">{event.event}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {/* Key Highlights/Takeaways */}
          {infographicData.highlights && infographicData.highlights.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Key Takeaways
              </h2>
              <div className="glass-card p-6 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                <ul className="space-y-3">
                  {infographicData.highlights.map((highlight, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <p className="text-white/90">{highlight}</p>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.section>
          )}

          {/* Empty state */}
          {(!infographicData.keyFacts || infographicData.keyFacts.length === 0) &&
           (!infographicData.charts || infographicData.charts.length === 0) &&
           (!infographicData.timeline || infographicData.timeline.length === 0) && (
            <div className="text-center py-12">
              <p className="text-white/60">No infographic data available</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
