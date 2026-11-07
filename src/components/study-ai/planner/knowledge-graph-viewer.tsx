"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Network,
  Sparkles,
  Loader2,
  Star,
  Clock,
  Zap,
  Lock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildGraphFromPlan,
  getSubjectColor,
  makeNodeId,
  saveGraphEdges,
  clearGraphEdges,
  selectNextTask,
  type KnowledgeNode,
  type KnowledgeEdge,
  type KnowledgeGraphData,
  type StudyPlanForGraph,
  type TopicReviewRecord,
  type TaskRecommendation,
  type RawEdge,
} from "@/lib/knowledge-graph";
import { TopicStudyPanel } from "./topic-study-panel";

// ─── Props ────────────────────────────────────────────────────────────────────

interface KnowledgeGraphViewerProps {
  plan: StudyPlanForGraph & { examType: string };
  userId: string;
  isPro: boolean;
  topicReviews: TopicReviewRecord[];
  onBack: () => void;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusLabel(status: KnowledgeNode["status"]): string {
  const map: Record<KnowledgeNode["status"], string> = {
    mastered: "Mastered",
    "in-progress": "In Progress",
    ready: "Ready to Study",
    locked: "Locked",
  };
  return map[status];
}

function statusIcon(status: KnowledgeNode["status"]) {
  if (status === "mastered") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "in-progress") return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
  if (status === "ready") return <Star className="w-3.5 h-3.5 text-teal-400" />;
  return <Lock className="w-3.5 h-3.5 text-white/30" />;
}

// Node visual radius based on importance + pyqFrequency
function nodeRadius(node: KnowledgeNode): number {
  const base = node.importance === "high" ? 22 : node.importance === "medium" ? 17 : 13;
  return Math.min(base + node.pyqFrequency * 0.18, 36);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KnowledgeGraphViewer({
  plan,
  userId,
  isPro,
  topicReviews,
  onBack,
}: KnowledgeGraphViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<KnowledgeNode, KnowledgeEdge> | null>(null);

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasEdges, setHasEdges] = useState(false);
  const [recommendations, setRecommendations] = useState<TaskRecommendation[]>([]);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [studyPanel, setStudyPanel] = useState<{ topic: string; subject: string } | null>(null);
  const [tick, setTick] = useState(0); // forces re-render on simulation tick

  // ── Build initial graph ───────────────────────────────────────────────────

  const loadGraph = useCallback(() => {
    const data = buildGraphFromPlan(plan, topicReviews);
    const edgeCount = data.edges.length;
    setHasEdges(edgeCount > 0);
    setGraphData(data);
    setRecommendations(selectNextTask(data.nodes, data.edges));
  }, [plan, topicReviews]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // ── D3 simulation ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!svgRef.current || !graphData) return;

    let raf: number;

    const init = () => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // rAF ensures layout has settled; h-screen on the outer container gives
    // flex-1 a definite height so the SVG fills the remaining viewport space.
    const svgRect = svgRef.current.getBoundingClientRect();
    const width = svgRect.width > 0 ? svgRect.width : window.innerWidth - 32;
    const height = svgRect.height > 100 ? svgRect.height : Math.max(window.innerHeight - svgRect.top - 10, 400);

    // ── Defs: arrowheads + glow filters ─────────────────────────────────────
    const defs = svg.append("defs");

    // Arrowhead marker per subject color would be ideal, but one generic one works
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "rgba(255,255,255,0.45)");

    // Glow filter
    const glowFilter = defs.append("filter").attr("id", "glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Strong glow for recommended nodes
    const glowStrong = defs.append("filter").attr("id", "glow-strong").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glowStrong.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "coloredBlur");
    const feMerge2 = glowStrong.append("feMerge");
    feMerge2.append("feMergeNode").attr("in", "coloredBlur");
    feMerge2.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Background grid/stars ────────────────────────────────────────────────
    const bg = svg.append("g").attr("class", "bg");
    // Subtle star field
    for (let i = 0; i < 80; i++) {
      bg.append("circle")
        .attr("cx", Math.random() * width)
        .attr("cy", Math.random() * height)
        .attr("r", Math.random() * 1.2 + 0.3)
        .attr("fill", "rgba(255,255,255,0.15)");
    }

    // ── Zoom container ───────────────────────────────────────────────────────
    const g = svg.append("g").attr("class", "zoom-container");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    // ── Make a working copy of nodes/edges ────────────────────────────────────
    // D3 mutates node objects (x, y, vx, vy) — we need plain objects.
    // Pre-initialise positions spread across the full canvas so the simulation
    // starts expanded rather than clustering outward from the origin.
    const padding = 60;
    const nodesCopy: KnowledgeNode[] = graphData.nodes.map((n) => ({
      ...n,
      x: padding + Math.random() * (width - padding * 2),
      y: padding + Math.random() * (height - padding * 2),
    }));
    const nodeById = new Map(nodesCopy.map((n) => [n.id, n]));

    const edgesCopy = graphData.edges.map((e) => ({
      source: typeof e.source === "string" ? nodeById.get(e.source)! : nodeById.get((e.source as KnowledgeNode).id)!,
      target: typeof e.target === "string" ? nodeById.get(e.target)! : nodeById.get((e.target as KnowledgeNode).id)!,
      weight: e.weight ?? 0.5,
    })).filter((e) => e.source && e.target);

    const topRecommendedId = recommendations[0]?.node.id;

    // ── Simulation ────────────────────────────────────────────────────────────
    // Scale repulsion by node count so large graphs spread to fill the canvas
    const chargeStrength = Math.min(-800, -300 - nodesCopy.length * 3);

    const simulation = d3
      .forceSimulation<KnowledgeNode>(nodesCopy)
      .force(
        "link",
        d3
          .forceLink<KnowledgeNode, { source: KnowledgeNode; target: KnowledgeNode }>(edgesCopy)
          .id((d) => d.id)
          .distance(120)
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody<KnowledgeNode>().strength(chargeStrength))
      // Weak center so nodes aren't clamped in the middle — they can fill the space
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.06))
      // Soft x/y forces keep nodes within the visible area
      .force("x", d3.forceX<KnowledgeNode>(width / 2).strength(0.04))
      .force("y", d3.forceY<KnowledgeNode>(height / 2).strength(0.04))
      .force("collide", d3.forceCollide<KnowledgeNode>((d) => nodeRadius(d) + 14))
      .alphaDecay(0.015);

    simulationRef.current = simulation;

    // ── Edges ─────────────────────────────────────────────────────────────────
    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup
      .selectAll<SVGPathElement, { source: KnowledgeNode; target: KnowledgeNode; weight: number }>("path")
      .data(edgesCopy)
      .join("path")
      .attr("fill", "none")
      // Color edges by source subject, opacity scales with weight
      .attr("stroke", (d) => {
        const color = getSubjectColor(d.source.subject);
        // Base 35% opacity, up to 75% for strong weights
        const alpha = Math.round((0.35 + d.weight * 0.4) * 255).toString(16).padStart(2, "0");
        return `${color}${alpha}`;
      })
      .attr("stroke-width", (d) => 1.2 + d.weight * 1.8)
      .attr("marker-end", "url(#arrowhead)");

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll<SVGGElement, KnowledgeNode>("g")
      .data(nodesCopy)
      .join("g")
      .attr("class", "node")
      .style("cursor", (d) => (d.status !== "locked" ? "pointer" : "not-allowed"))
      .call(
        d3
          .drag<SVGGElement, KnowledgeNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Outer glow ring for recommended node
    node
      .filter((d) => d.id === topRecommendedId)
      .append("circle")
      .attr("r", (d) => nodeRadius(d) + 10)
      .attr("fill", "none")
      .attr("stroke", "#FBBF24")
      .attr("stroke-width", 2.5)
      .attr("opacity", 0.8)
      .attr("class", "recommended-ring");

    // Main node circle — progressive mastery shading
    // masteryLevel 0–5 (Leitner box): darker fill = more mastered
    // 0 = outline only, 1–2 = light fill, 3–4 = medium fill, 5 = full fill
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d))
      .attr("fill", (d) => {
        const color = getSubjectColor(d.subject);
        if (d.status === "locked") return "#1a1a1f";
        // Progressive fill: masteryLevel 0→0x10, 1→0x40, 2→0x70, 3→0xA0, 4→0xD0, 5→0xFF
        const alphaHex = ["18", "40", "70", "A0", "D0", "FF"][Math.min(d.masteryLevel, 5)];
        return `${color}${alphaHex}`;
      })
      .attr("stroke", (d) => {
        if (d.status === "locked") return "rgba(255,255,255,0.1)";
        if (d.isOverdue) return "#EF4444";
        return getSubjectColor(d.subject);
      })
      .attr("stroke-width", (d) => {
        if (d.id === topRecommendedId) return 2.5;
        if (d.status === "mastered") return 0;
        if (d.isOverdue) return 2;
        return 1.5;
      })
      .attr("stroke-dasharray", (d) => (d.isOverdue ? "5,3" : "none"))
      .attr("opacity", (d) => (d.status === "locked" ? 0.35 : 1))
      .attr("filter", (d) =>
        d.id === topRecommendedId
          ? "url(#glow-strong)"
          : d.status === "in-progress"
          ? "url(#glow)"
          : "none"
      );

    // Check mark for mastered nodes
    node
      .filter((d) => d.status === "mastered")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => `${nodeRadius(d) * 0.9}px`)
      .attr("fill", "white")
      .attr("opacity", 0.9)
      .text("✓");

    // Star for recommended
    node
      .filter((d) => d.id === topRecommendedId)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => `${nodeRadius(d) * 0.85}px`)
      .attr("fill", "#FBBF24")
      .text("★");

    // Topic label below node
    node
      .filter((d) => d.status !== "locked")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 14)
      .attr("font-size", "11px")
      .attr("font-family", "sans-serif")
      .attr("fill", (d) => (d.status === "mastered" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.85)"))
      .attr("font-weight", (d) => (d.id === topRecommendedId ? "700" : "400"))
      .text((d) => (d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label));

    // ── Interactions ──────────────────────────────────────────────────────────
    node
      .on("mouseover", (event, d) => {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          setTooltipPos({
            x: event.clientX - svgRect.left,
            y: event.clientY - svgRect.top - 10,
          });
        }
        setHoveredNode(d);
        d3.select(event.currentTarget as SVGGElement)
          .select("circle")
          .attr("stroke-width", 3)
          .attr("opacity", 1);
      })
      .on("mousemove", (event) => {
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          setTooltipPos({
            x: event.clientX - svgRect.left,
            y: event.clientY - svgRect.top - 10,
          });
        }
      })
      .on("mouseout", (event) => {
        setHoveredNode(null);
        const d = d3.select(event.currentTarget as SVGGElement).datum() as KnowledgeNode;
        d3.select(event.currentTarget as SVGGElement)
          .select("circle")
          .attr("stroke-width", d.status === "mastered" ? 0 : d.isOverdue ? 2 : 1.5)
          .attr("opacity", d.status === "locked" ? 0.35 : 1);
      })
      .on("click", (_, d) => {
        if (d.status === "locked") {
          toast.info("Complete prerequisites first to unlock this topic.");
          return;
        }
        setStudyPanel({ topic: d.label, subject: d.subject });
      });

    // ── Tick ──────────────────────────────────────────────────────────────────
    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const src = d.source as KnowledgeNode;
        const tgt = d.target as KnowledgeNode;
        if (!src.x || !src.y || !tgt.x || !tgt.y) return "";
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${src.x},${src.y}A${dr},${dr} 0 0,1 ${tgt.x},${tgt.y}`;
      });

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    }; // end init

    raf = requestAnimationFrame(init);
    return () => {
      cancelAnimationFrame(raf);
      simulationRef.current?.stop();
    };
  }, [graphData, recommendations, activeSubject]);

  // ── Prerequisite generation ───────────────────────────────────────────────

  const generatePrerequisites = useCallback(async () => {
    if (!graphData) return;
    setIsGenerating(true);

    const topics = graphData.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      subject: n.subject,
    }));

    try {
      const res = await fetch("/api/study-ai/generate-knowledge-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, topics }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Generation failed (${res.status})`);
      }
      const data = await res.json();
      const edges: RawEdge[] = data.edges ?? [];

      if (data.warning) {
        console.warn("[knowledge-graph] API warning:", data.warning);
        toast.error("AI couldn't generate prerequisites right now. Try again in a moment.");
        return;
      }

      saveGraphEdges(plan.id, edges);
      toast.success(`Knowledge graph ready — ${edges.length} prerequisite links mapped`);

      // Reload graph with new edges
      const newData = buildGraphFromPlan(plan, topicReviews);
      setGraphData(newData);
      setHasEdges(newData.edges.length > 0);
      setRecommendations(selectNextTask(newData.nodes, newData.edges));
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate prerequisites. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [graphData, plan, topicReviews]);

  const handleRegenerate = useCallback(async () => {
    clearGraphEdges(plan.id);
    loadGraph();
    await generatePrerequisites();
  }, [plan.id, loadGraph, generatePrerequisites]);

  // ── Subject legend ────────────────────────────────────────────────────────

  const subjects = graphData
    ? Array.from(new Set(graphData.nodes.map((n) => n.subject)))
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats = {
    total: graphData.nodes.length,
    mastered: graphData.nodes.filter((n) => n.status === "mastered").length,
    ready: graphData.nodes.filter((n) => n.status === "ready" || n.status === "in-progress").length,
    locked: graphData.nodes.filter((n) => n.status === "locked").length,
  };

  return (
    <div className="flex flex-col h-screen bg-[#09090B] relative overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black/40 backdrop-blur-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-white">Knowledge Graph</span>
            <span className="text-xs text-white/40 hidden sm:inline">— {plan.examType}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
              {stats.mastered} mastered
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {stats.ready} ready
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/40">
              {stats.locked} locked
            </span>
          </div>

          {hasEdges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="text-white/50 hover:text-white"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* ── Subject legend ── */}
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto border-b border-white/5 flex-shrink-0 scrollbar-hide">
        <button
          onClick={() => setActiveSubject(null)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all border",
            activeSubject === null
              ? "bg-white/10 border-white/20 text-white"
              : "border-transparent text-white/40 hover:text-white/70"
          )}
        >
          All
        </button>
        {subjects.map((subject) => {
          const color = getSubjectColor(subject);
          const isActive = activeSubject === subject;
          return (
            <button
              key={subject}
              onClick={() => setActiveSubject(isActive ? null : subject)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-all border",
                isActive ? "opacity-100" : "opacity-60 hover:opacity-90"
              )}
              style={{
                borderColor: isActive ? color : `${color}40`,
                background: isActive ? `${color}20` : "transparent",
                color: color,
              }}
            >
              {subject}
            </button>
          );
        })}
      </div>

      {/* ── Main graph SVG ── */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(45,212,191,0.04) 0%, transparent 70%)" }}
        />

        {/* ── No-edges overlay ── */}
        <AnimatePresence>
          {!hasEdges && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-0 flex justify-center pb-6 pointer-events-none"
            >
              <div className="text-center pointer-events-auto max-w-xs bg-black/60 backdrop-blur-sm border border-white/8 rounded-2xl px-6 py-4">
                <p className="text-white/80 font-semibold mb-1">Map prerequisite links</p>
                <p className="text-white/40 text-xs mb-3">
                  AI will analyse your syllabus and draw connections between topics.
                </p>
                <Button
                  onClick={generatePrerequisites}
                  disabled={isGenerating}
                  className="bg-primary text-black font-bold hover:bg-primary/90"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Mapping…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Prerequisite Map
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hover tooltip ── */}
        <AnimatePresence>
          {hoveredNode && (
            <motion.div
              key={hoveredNode.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute z-30 pointer-events-none"
              style={{
                left: Math.min(tooltipPos.x + 12, (containerRef.current?.clientWidth ?? 600) - 210),
                top: Math.max(tooltipPos.y - 60, 8),
              }}
            >
              <div
                className="rounded-xl border p-3 text-sm max-w-[200px] backdrop-blur-md"
                style={{
                  background: "rgba(9,9,11,0.92)",
                  borderColor: `${getSubjectColor(hoveredNode.subject)}40`,
                  boxShadow: `0 0 20px ${getSubjectColor(hoveredNode.subject)}20`,
                }}
              >
                <div className="font-semibold text-white mb-1 leading-tight">{hoveredNode.label}</div>
                <div
                  className="text-xs font-medium mb-2"
                  style={{ color: getSubjectColor(hoveredNode.subject) }}
                >
                  {hoveredNode.subject}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/60 mb-1">
                  {statusIcon(hoveredNode.status)}
                  {statusLabel(hoveredNode.status)}
                  {hoveredNode.masteryLevel > 0 && (
                    <span className="text-white/30 ml-1">
                      Lv {hoveredNode.masteryLevel}/5
                    </span>
                  )}
                  {hoveredNode.isOverdue && (
                    <span className="text-red-400 ml-1 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> Overdue
                    </span>
                  )}
                </div>
                {/* Mastery bar */}
                {hoveredNode.masteryLevel > 0 && (
                  <div className="flex gap-0.5 mb-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full"
                        style={{
                          background: i < hoveredNode.masteryLevel
                            ? getSubjectColor(hoveredNode.subject)
                            : "rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-2 text-xs text-white/40">
                  <span>Week {hoveredNode.week} · Day {hoveredNode.day}</span>
                  {hoveredNode.pyqFrequency > 0 && (
                    <span className="text-amber-400">{hoveredNode.pyqFrequency} PYQs</span>
                  )}
                </div>
                {hoveredNode.prerequisites.length > 0 && (
                  <div className="mt-1.5 text-xs text-white/30">
                    {hoveredNode.prerequisites.length} prerequisite{hoveredNode.prerequisites.length > 1 ? "s" : ""}
                  </div>
                )}
                {hoveredNode.status !== "locked" && (
                  <div className="mt-2 text-xs text-primary font-medium">
                    Click to study →
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Study Next panel ── */}
      {recommendations.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/8 bg-black/50 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Study Next
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {recommendations.map((rec, i) => {
              const color = getSubjectColor(rec.node.subject);
              return (
                <button
                  key={rec.node.id}
                  onClick={() =>
                    setStudyPanel({ topic: rec.node.label, subject: rec.node.subject })
                  }
                  className={cn(
                    "flex-shrink-0 rounded-xl border p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
                    i === 0
                      ? "border-amber-500/40 bg-amber-500/8"
                      : "border-white/8 bg-white/4 hover:bg-white/8"
                  )}
                  style={{ minWidth: 180 }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-white leading-tight line-clamp-2">
                      {rec.node.label}
                    </div>
                    {i === 0 && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
                  </div>
                  <div className="text-xs mb-1.5 font-medium" style={{ color }}>
                    {rec.node.subject}
                  </div>
                  <div className="text-xs text-white/40">
                    {rec.reasons[0]}
                    {rec.reasons.length > 1 && ` · ${rec.reasons[1]}`}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {rec.node.pyqFrequency > 0 && (
                      <span className="text-xs text-amber-400/70">
                        {rec.node.pyqFrequency} PYQs
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-white/30 ml-auto" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Topic Study Panel ── */}
      <AnimatePresence>
        {studyPanel && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 24, stiffness: 200 }}
            className="absolute inset-0 z-40 bg-[#09090B] overflow-y-auto"
          >
            {/* Sticky back bar */}
            <div className="sticky top-0 z-50 flex items-center px-4 py-2 bg-[#09090B]/95 backdrop-blur-sm border-b border-white/8">
              <button
                onClick={() => setStudyPanel(null)}
                className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Graph
              </button>
              <span className="ml-3 text-sm text-white/40 truncate">
                {studyPanel.subject} · {studyPanel.topic}
              </span>
            </div>
            <div className="p-4">
              <TopicStudyPanel
                subject={studyPanel.subject}
                topics={[studyPanel.topic]}
                examType={plan.examType}
                userId={userId}
                isPro={isPro}
                onClose={() => setStudyPanel(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
