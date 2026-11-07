"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Expand,
  Shrink,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlannerMindmapData {
  markdown: string;
  title: string;
  subject: string;
  topics: string[];
  topicKey?: string;
  planId?: string;
}

export default function PlannerMindmapViewerPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markmapRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mindmapData, setMindmapData] = useState<PlannerMindmapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load data from sessionStorage on mount
  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem("planner-mindmap-data");
      if (storedData) {
        const data = JSON.parse(storedData);
        setMindmapData(data);
      } else {
        setError("No mindmap data found. Please generate a mindmap first.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Failed to load mindmap data:", err);
      setError("Failed to load mindmap data.");
      setIsLoading(false);
    }
  }, []);

  // Handle save to database
  const handleSave = async () => {
    if (!mindmapData || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/study-ai/save-planner-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: mindmapData.title,
          generationType: "mindmap",
          outputData: {
            markdown: mindmapData.markdown,
            title: mindmapData.title,
          },
          subject: mindmapData.subject,
          topics: mindmapData.topics,
        }),
      });

      if (response.ok) {
        setIsSaved(true);
        toast.success("Mind map saved! Find it in Study with AI → Saved section.");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save mind map");
    } finally {
      setIsSaving(false);
    }
  };

  const getBackUrl = () => {
    if (mindmapData?.topicKey) {
      const params = new URLSearchParams({ tab: "planner", expand: mindmapData.topicKey });
      if (mindmapData.planId) params.set("planId", mindmapData.planId);
      params.set("notebook", "true");
      return `/study-ai?${params.toString()}`;
    }
    return "/study-ai?tab=planner";
  };

  // Initialize Markmap
  useEffect(() => {
    if (!mindmapData) return;

    let mounted = true;
    let wheelHandler: ((e: WheelEvent) => void) | null = null;

    const initMarkmap = async () => {
      if (!svgRef.current || !containerRef.current || !mounted) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setTimeout(initMarkmap, 100);
        return;
      }

      try {
        const { Transformer } = await import("markmap-lib");
        const markmapView = await import("markmap-view");
        const { Markmap } = markmapView;

        const transformer = new Transformer();
        const { root } = transformer.transform(mindmapData.markdown);

        const svg = svgRef.current;
        svg.setAttribute("width", String(rect.width));
        svg.setAttribute("height", String(rect.height));
        svg.innerHTML = "";

        const mm = Markmap.create(svg, {
          autoFit: false,
          duration: 300,
          maxWidth: 200,
          paddingX: 24,
          spacingHorizontal: 100,
          spacingVertical: 8,
          initialExpandLevel: -1,
          zoom: true,
          pan: true,
        }, root);

        markmapRef.current = mm;

        // Track circle clicks
        let isCircleClick = false;
        let savedTransform: { x: number; y: number; k: number } | null = null;

        // Add toggle buttons to nodes
        const addToggleButtons = () => {
          const nodes = svg.querySelectorAll(".markmap-node");

          nodes.forEach((node) => {
            const nodeData = (node as any).__data__;
            const hasChildren = nodeData?.children && nodeData.children.length > 0;

            if (!hasChildren) return;
            if (node.querySelector(".custom-toggle-btn")) return;

            const foreignObj = node.querySelector("foreignObject");
            if (!foreignObj) return;

            const foX = parseFloat(foreignObj.getAttribute("x") || "0");
            const foWidth = parseFloat(foreignObj.getAttribute("width") || "0");

            const btnGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            btnGroup.setAttribute("class", "custom-toggle-btn");
            btnGroup.style.cursor = "pointer";

            const btnX = foX + foWidth + 8;
            const btnY = 0;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", String(btnX));
            circle.setAttribute("cy", String(btnY));
            circle.setAttribute("r", "10");
            circle.setAttribute("stroke-width", "2");

            const isFolded = node.classList.contains("markmap-fold");
            if (isFolded) {
              circle.setAttribute("fill", "#ffffff");
              circle.setAttribute("stroke", "#8B5CF6");
            } else {
              circle.setAttribute("fill", "#8B5CF6");
              circle.setAttribute("stroke", "#ffffff");
            }

            const symbol = document.createElementNS("http://www.w3.org/2000/svg", "text");
            symbol.setAttribute("x", String(btnX));
            symbol.setAttribute("y", String(btnY + 4));
            symbol.setAttribute("text-anchor", "middle");
            symbol.setAttribute("font-size", "14");
            symbol.setAttribute("font-weight", "bold");
            symbol.setAttribute("fill", isFolded ? "#8B5CF6" : "#ffffff");
            symbol.textContent = isFolded ? "+" : "−";

            btnGroup.appendChild(circle);
            btnGroup.appendChild(symbol);

            btnGroup.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              isCircleClick = true;

              const gElement = svg.querySelector("g");
              if (gElement) {
                const transform = gElement.getAttribute("transform");
                if (transform) {
                  const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
                  const scaleMatch = transform.match(/scale\(([^)]+)\)/);
                  if (translateMatch) {
                    savedTransform = {
                      x: parseFloat(translateMatch[1]),
                      y: parseFloat(translateMatch[2]),
                      k: scaleMatch ? parseFloat(scaleMatch[1]) : 1,
                    };
                  }
                }
              }

              if (!nodeData.payload) nodeData.payload = {};
              nodeData.payload.fold = nodeData.payload.fold ? 0 : 1;

              mm.renderData();

              const restoreTransform = () => {
                if (savedTransform) {
                  const gEl = svg.querySelector("g");
                  if (gEl) {
                    gEl.setAttribute(
                      "transform",
                      `translate(${savedTransform.x},${savedTransform.y}) scale(${savedTransform.k})`
                    );
                  }
                }
              };

              restoreTransform();
              setTimeout(restoreTransform, 50);
              setTimeout(() => {
                restoreTransform();
                addToggleButtons();
                isCircleClick = false;
                savedTransform = null;
              }, 350);
            });

            btnGroup.addEventListener("mousedown", (e) => {
              e.stopPropagation();
            });

            node.appendChild(btnGroup);
          });

          const defaultCircles = svg.querySelectorAll(".markmap-node > circle");
          defaultCircles.forEach((c) => {
            (c as SVGCircleElement).setAttribute("r", "0");
            (c as SVGCircleElement).style.display = "none";
          });
        };

        setTimeout(() => {
          if (mm && mounted) {
            mm.fit();
            addToggleButtons();
          }
        }, 300);

        setIsLoading(false);

        addToggleButtons();
        const intervals = [100, 300, 500, 1000, 2000];
        intervals.forEach((delay) => setTimeout(addToggleButtons, delay));

        const observer = new MutationObserver((mutations) => {
          let hasNewNodes = false;
          for (const mutation of mutations) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
              hasNewNodes = true;
              break;
            }
          }
          if (hasNewNodes) {
            requestAnimationFrame(addToggleButtons);
          }
        });
        observer.observe(svg, { childList: true, subtree: true });
        (svg as any).__observer = observer;

        try {
          const d3 = await import("d3");
          const svgSelection = d3.select(svg);
          svgSelection.on("dblclick.zoom", null);

          const gElement = svg.querySelector("g");
          if (gElement) {
            const gSelection = d3.select(gElement);
            gSelection.on("dblclick.zoom", null);
          }

          const zoomBehavior = (mm as any).zoom;
          if (zoomBehavior) {
            const originalFilter = zoomBehavior.filter();

            zoomBehavior.filter(function (this: any, event: any) {
              if (isCircleClick) return false;

              const target = event.target as Element;
              if (target && target.tagName && target.tagName.toLowerCase() === "circle") {
                return false;
              }

              if (typeof originalFilter === "function") {
                return originalFilter.call(this, event);
              }
              return !event.ctrlKey && !event.button;
            });

            const existingZoomHandler = zoomBehavior.on("zoom");
            if (existingZoomHandler) {
              zoomBehavior.on("zoom", function (this: any, event: any) {
                if (isCircleClick) return;
                existingZoomHandler.call(this, event);
              });
            }
          }
        } catch (err) {
          console.log("Could not modify d3 zoom:", err);
        }

        wheelHandler = (e: WheelEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const scale = e.deltaY > 0 ? 0.9 : 1.1;
          mm.rescale(scale);
        };
        svg.addEventListener("wheel", wheelHandler, { passive: false });
      } catch (error) {
        console.error("Failed to initialize markmap:", error);
        setError("Failed to render mindmap.");
        setIsLoading(false);
      }
    };

    const timer = setTimeout(initMarkmap, 50);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (svgRef.current) {
        if (wheelHandler) {
          svgRef.current.removeEventListener("wheel", wheelHandler);
        }
        const observer = (svgRef.current as any).__observer;
        if (observer) {
          observer.disconnect();
        }
      }
    };
  }, [mindmapData]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (markmapRef.current) {
        setTimeout(() => markmapRef.current?.fit(), 100);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleZoomIn = () => {
    if (markmapRef.current) {
      markmapRef.current.rescale(1.3);
    }
  };

  const handleZoomOut = () => {
    if (markmapRef.current) {
      markmapRef.current.rescale(0.77);
    }
  };

  const handleReset = () => {
    if (markmapRef.current) {
      markmapRef.current.fit();
    }
  };

  const handleExpandAll = async () => {
    if (!markmapRef.current || !svgRef.current || !mindmapData) return;

    try {
      const { Transformer } = await import("markmap-lib");
      const transformer = new Transformer();
      const { root } = transformer.transform(mindmapData.markdown);

      const expandAll = (node: any) => {
        node.payload = { ...node.payload, fold: 0 };
        if (node.children) {
          node.children.forEach(expandAll);
        }
      };
      expandAll(root);

      markmapRef.current.setData(root);
      setTimeout(() => markmapRef.current?.fit(), 300);
    } catch (error) {
      console.error("Failed to expand:", error);
    }
  };

  const handleCollapseAll = async () => {
    if (!markmapRef.current || !svgRef.current || !mindmapData) return;

    try {
      const { Transformer } = await import("markmap-lib");
      const transformer = new Transformer();
      const { root } = transformer.transform(mindmapData.markdown);

      const collapseAll = (node: any, depth: number) => {
        if (depth >= 1 && node.children && node.children.length > 0) {
          node.payload = { ...node.payload, fold: 1 };
        }
        if (node.children) {
          node.children.forEach((child: any) => collapseAll(child, depth + 1));
        }
      };
      collapseAll(root, 0);

      markmapRef.current.setData(root);
      setTimeout(() => markmapRef.current?.fit(), 300);
    } catch (error) {
      console.error("Failed to collapse:", error);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => markmapRef.current?.fit(), 100);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error}</p>
          <Button
            onClick={() => router.push(getBackUrl())}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f1a]/90 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(getBackUrl())}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {mindmapData?.title || "Mind Map"}
                </h1>
                <p className="text-sm text-white/50">
                  {mindmapData?.subject} - {mindmapData?.topics?.join(", ")}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isSaved}
              className={cn(
                "gap-2 border-white/20 text-white hover:bg-white/10",
                isSaved && "text-purple-400 border-purple-400/50"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSaved ? (
                <BookmarkCheck className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              {isSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomIn}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleZoomOut}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleReset}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Fit to View"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExpandAll}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Expand All"
        >
          <Expand className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCollapseAll}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Collapse All"
        >
          <Shrink className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          className="bg-[#1a1a2e] border-white/20 text-white hover:bg-white/10"
          title="Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Mindmap Container */}
      <div
        ref={containerRef}
        className={cn(
          "w-full overflow-hidden bg-[#0a0a12]",
          isFullscreen ? "h-screen" : "h-[calc(100vh-73px)]"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-white/60">Loading mindmap...</p>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ minWidth: "100%", minHeight: "100%" }}
          className={cn(
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100"
          )}
        />
      </div>

      {/* Instructions */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1a2e]/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white/60 border border-white/10">
        Drag to pan • Scroll to zoom • Click +/− buttons to expand/collapse
      </div>

      {/* Markmap Styles */}
      <style jsx global>{`
        :root {
          --markmap-circle-open-bg: #1e1e2e;
        }
        .markmap {
          width: 100%;
          height: 100%;
        }
        .markmap > svg {
          width: 100%;
          height: 100%;
        }
        .markmap-node > circle {
          display: none !important;
        }
        .custom-toggle-btn {
          cursor: pointer;
          pointer-events: all !important;
        }
        .custom-toggle-btn circle {
          transition: fill 0.2s ease, stroke 0.2s ease, transform 0.15s ease;
          filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.6));
        }
        .custom-toggle-btn:hover circle {
          fill: #a78bfa !important;
          stroke: #ffffff !important;
          filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.9));
        }
        .custom-toggle-btn text {
          pointer-events: none;
          user-select: none;
        }
        .markmap-link {
          fill: none;
          stroke: #6366f1;
          stroke-opacity: 0.5;
          stroke-width: 1.5;
        }
        .markmap-node text {
          fill: #ffffff;
          font-size: 13px;
        }
        .markmap-node foreignObject {
          overflow: visible !important;
          pointer-events: none;
        }
        .markmap-node foreignObject > * {
          pointer-events: auto;
        }
        .markmap-foreign {
          display: inline-block;
        }
        .markmap-foreign > div {
          display: inline-block;
          padding: 6px 12px;
          background: rgba(30, 30, 46, 0.95) !important;
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 6px;
          color: #ffffff !important;
          font-size: 13px;
          line-height: 1.4;
          max-width: 280px;
          white-space: normal;
          word-wrap: break-word;
        }
        .markmap-foreign > div:hover {
          background: rgba(42, 42, 62, 0.98) !important;
          border-color: rgba(139, 92, 246, 0.6);
        }
        .markmap-foreign > div * {
          background: transparent !important;
          text-decoration: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
