"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Expand,
  Shrink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MindMapOutput } from "@/types/study-ai.types";

interface MindmapViewerProps {
  generation: {
    id: number;
    goal_id: number;
    title: string;
    output_data: MindMapOutput;
    is_saved: boolean;
    created_at: string;
  };
  goalText: string;
}

export function MindmapViewer({ generation, goalText }: MindmapViewerProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markmapRef = useRef<any>(null);
  const [isSaved, setIsSaved] = useState(generation.is_saved);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mindmapData = generation.output_data;

  // Initialize Markmap
  useEffect(() => {
    let mounted = true;
    let wheelHandler: ((e: WheelEvent) => void) | null = null;

    const initMarkmap = async () => {
      if (!svgRef.current || !containerRef.current || !mounted) return;

      // Wait for container to have dimensions
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Retry after a short delay if container isn't ready
        setTimeout(initMarkmap, 100);
        return;
      }

      try {
        // Dynamic import for client-side only
        const { Transformer } = await import("markmap-lib");
        const markmapView = await import("markmap-view");
        const { Markmap } = markmapView;

        const transformer = new Transformer();

        // Convert markdown to markmap data
        const { root } = transformer.transform(mindmapData.markdown);

        // Set explicit dimensions on SVG before creating markmap
        const svg = svgRef.current;
        svg.setAttribute('width', String(rect.width));
        svg.setAttribute('height', String(rect.height));
        svg.innerHTML = "";

        // Create markmap instance with options
        // IMPORTANT: Disable autoFit to prevent zoom changes on expand/collapse
        const mm = Markmap.create(svg, {
          autoFit: false, // Disabled to prevent zoom on circle click
          duration: 300,
          maxWidth: 200,
          paddingX: 24,
          spacingHorizontal: 100, // Horizontal space between parent and children
          spacingVertical: 8, // Vertical space between siblings
          initialExpandLevel: -1, // Expand all
          zoom: true, // Enable zoom
          pan: true, // Enable pan
        }, root);

        markmapRef.current = mm;

        // Override Markmap's internal handleClick to prevent zoom
        const originalHandleClick = (mm as any).handleClick;
        if (originalHandleClick) {
          (mm as any).handleClick = function(this: any, ...args: any[]) {
            // Call original but prevent any fit/zoom behavior after
            const result = originalHandleClick.apply(this, args);
            // Don't call fit() - Markmap's default behavior
            return result;
          };
        }

        // Track circle clicks to restore transform
        let isCircleClick = false;
        let savedTransform: { x: number; y: number; k: number } | null = null;

        // Track which circles have handlers attached (WeakSet allows GC of removed elements)
        const circlesWithHandlers = new WeakSet<Element>();

        // Function to add custom toggle buttons to nodes with children
        const addToggleButtons = () => {
          const nodes = svg.querySelectorAll('.markmap-node');

          nodes.forEach((node) => {
            const nodeData = (node as any).__data__;
            const hasChildren = nodeData?.children && nodeData.children.length > 0;

            if (!hasChildren) return;

            // Check if we already added a toggle button
            if (node.querySelector('.custom-toggle-btn')) return;

            // Get the foreignObject (text box) to position our button after it
            const foreignObj = node.querySelector('foreignObject');
            if (!foreignObj) return;

            // Get the position from the foreignObject
            const foX = parseFloat(foreignObj.getAttribute('x') || '0');
            const foWidth = parseFloat(foreignObj.getAttribute('width') || '0');

            // Create a group for our custom button
            const btnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            btnGroup.setAttribute('class', 'custom-toggle-btn');
            btnGroup.style.cursor = 'pointer';

            // Position it after the text box
            const btnX = foX + foWidth + 8;
            const btnY = 0;

            // Create the circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', String(btnX));
            circle.setAttribute('cy', String(btnY));
            circle.setAttribute('r', '10');
            circle.setAttribute('stroke-width', '2');

            // Style based on fold state
            const isFolded = node.classList.contains('markmap-fold');
            if (isFolded) {
              circle.setAttribute('fill', '#ffffff');
              circle.setAttribute('stroke', '#8B5CF6');
            } else {
              circle.setAttribute('fill', '#8B5CF6');
              circle.setAttribute('stroke', '#ffffff');
            }

            // Add +/- symbol
            const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            symbol.setAttribute('x', String(btnX));
            symbol.setAttribute('y', String(btnY + 4));
            symbol.setAttribute('text-anchor', 'middle');
            symbol.setAttribute('font-size', '14');
            symbol.setAttribute('font-weight', 'bold');
            symbol.setAttribute('fill', isFolded ? '#8B5CF6' : '#ffffff');
            symbol.textContent = isFolded ? '+' : '−';

            btnGroup.appendChild(circle);
            btnGroup.appendChild(symbol);

            // Add click handler
            btnGroup.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();

              isCircleClick = true;

              // Save transform
              const gElement = svg.querySelector('g');
              if (gElement) {
                const transform = gElement.getAttribute('transform');
                if (transform) {
                  const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
                  const scaleMatch = transform.match(/scale\(([^)]+)\)/);
                  if (translateMatch) {
                    savedTransform = {
                      x: parseFloat(translateMatch[1]),
                      y: parseFloat(translateMatch[2]),
                      k: scaleMatch ? parseFloat(scaleMatch[1]) : 1
                    };
                  }
                }
              }

              // Toggle fold
              if (!nodeData.payload) nodeData.payload = {};
              nodeData.payload.fold = nodeData.payload.fold ? 0 : 1;

              mm.renderData();

              // Restore transform
              const restoreTransform = () => {
                if (savedTransform) {
                  const gEl = svg.querySelector('g');
                  if (gEl) {
                    gEl.setAttribute('transform', `translate(${savedTransform.x},${savedTransform.y}) scale(${savedTransform.k})`);
                  }
                }
              };

              restoreTransform();
              setTimeout(restoreTransform, 50);
              setTimeout(() => {
                restoreTransform();
                addToggleButtons(); // Re-add buttons after render
                isCircleClick = false;
                savedTransform = null;
              }, 350);
            });

            btnGroup.addEventListener('mousedown', (e) => {
              e.stopPropagation();
            });

            node.appendChild(btnGroup);
          });

          // Hide Markmap's default circles
          const defaultCircles = svg.querySelectorAll('.markmap-node > circle');
          defaultCircles.forEach(c => {
            (c as SVGCircleElement).setAttribute('r', '0');
            (c as SVGCircleElement).style.display = 'none';
          });
        };

        // Fit to container after a short delay
        setTimeout(() => {
          if (mm && mounted) {
            mm.fit();
            addToggleButtons();
          }
        }, 300);

        setIsLoading(false);

        // Add toggle buttons immediately after initial render
        addToggleButtons();

        // Add toggle buttons repeatedly during first few seconds to catch Markmap's animations
        const intervals = [100, 300, 500, 1000, 2000];
        intervals.forEach(delay => setTimeout(addToggleButtons, delay));

        // Watch for DOM changes and re-add toggle buttons
        const observer = new MutationObserver((mutations) => {
          // Check if new nodes were added
          let hasNewNodes = false;
          for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              hasNewNodes = true;
              break;
            }
          }
          if (hasNewNodes) {
            requestAnimationFrame(addToggleButtons);
          }
        });
        observer.observe(svg, {
          childList: true,
          subtree: true
        });

        // Store observer for cleanup
        (svg as any).__observer = observer;

        // Modify d3-zoom to disable zoom when clicking circles
        try {
          const d3 = await import('d3');
          const svgSelection = d3.select(svg);

          // Remove double-click zoom handler entirely
          svgSelection.on('dblclick.zoom', null);

          // Get the g element where zoom is applied
          const gElement = svg.querySelector('g');
          if (gElement) {
            const gSelection = d3.select(gElement);
            gSelection.on('dblclick.zoom', null);
          }

          // Intercept zoom start and cancel if it's from a circle click
          const zoomBehavior = (mm as any).zoom;
          if (zoomBehavior) {
            // Store original filter
            const originalFilter = zoomBehavior.filter();

            // Create new filter that blocks circle clicks
            zoomBehavior.filter(function(this: any, event: any) {
              // Always block if isCircleClick flag is set
              if (isCircleClick) {
                return false;
              }

              // Block events on circles
              const target = event.target as Element;
              if (target && target.tagName && target.tagName.toLowerCase() === 'circle') {
                return false;
              }

              // Use original filter for everything else
              if (typeof originalFilter === 'function') {
                return originalFilter.call(this, event);
              }
              return !event.ctrlKey && !event.button;
            });

            // Also intercept zoom events and cancel if from circle
            const existingZoomHandler = zoomBehavior.on('zoom');
            if (existingZoomHandler) {
              zoomBehavior.on('zoom', function(this: any, event: any) {
                // Check if this was triggered by a circle click
                if (isCircleClick) {
                  return; // Don't apply zoom
                }
                existingZoomHandler.call(this, event);
              });
            }
          }
        } catch (err) {
          console.log('Could not modify d3 zoom:', err);
        }

        // Add wheel event listener for zoom (prevent page scroll)
        wheelHandler = (e: WheelEvent) => {
          e.preventDefault();
          e.stopPropagation();
          const scale = e.deltaY > 0 ? 0.9 : 1.1;
          mm.rescale(scale);
        };
        svg.addEventListener('wheel', wheelHandler, { passive: false });
      } catch (error) {
        console.error("Failed to initialize markmap:", error);
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initMarkmap, 50);

    return () => {
      mounted = false;
      clearTimeout(timer);
      // Cleanup
      if (svgRef.current) {
        if (wheelHandler) {
          svgRef.current.removeEventListener('wheel', wheelHandler);
        }
        // Disconnect mutation observer
        const observer = (svgRef.current as any).__observer;
        if (observer) {
          observer.disconnect();
        }
      }
    };
  }, [mindmapData.markdown]);

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
    if (!markmapRef.current || !svgRef.current) return;

    try {
      const { Transformer } = await import("markmap-lib");
      const transformer = new Transformer();
      const { root } = transformer.transform(mindmapData.markdown);

      // Set all nodes to expanded
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
    if (!markmapRef.current || !svgRef.current) return;

    try {
      const { Transformer } = await import("markmap-lib");
      const transformer = new Transformer();
      const { root } = transformer.transform(mindmapData.markdown);

      // Collapse all except root and first level
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
                onClick={() => router.push(`/study-ai/goals/${generation.goal_id}`)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-white">{mindmapData.title}</h1>
                <p className="text-sm text-white/50">{goalText}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "gap-2 border-white/20 text-white hover:bg-white/10",
                isSaved && "text-purple-400 border-purple-400/50"
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
          style={{ minWidth: '100%', minHeight: '100%' }}
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
        /* CSS variables for markmap circles */
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
        /* Hide Markmap's default circles */
        .markmap-node > circle {
          display: none !important;
        }
        /* Custom toggle buttons */
        .custom-toggle-btn {
          cursor: pointer;
          pointer-events: all !important;
        }
        .custom-toggle-btn circle {
          transition: fill 0.2s ease, stroke 0.2s ease, transform 0.15s ease;
          filter: drop-shadow(0 0 4px rgba(139, 92, 246, 0.6));
        }
        .custom-toggle-btn:hover circle {
          fill: #A78BFA !important;
          stroke: #ffffff !important;
          filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.9));
        }
        .custom-toggle-btn text {
          pointer-events: none;
          user-select: none;
        }
        /* Links between nodes */
        .markmap-link {
          fill: none;
          stroke: #6366F1;
          stroke-opacity: 0.5;
          stroke-width: 1.5;
        }
        /* Text styling */
        .markmap-node text {
          fill: #ffffff;
          font-size: 13px;
        }
        /* Foreign object - the text container */
        .markmap-node foreignObject {
          overflow: visible !important;
          /* Allow clicks to pass through to circle underneath */
          pointer-events: none;
        }
        .markmap-node foreignObject > * {
          /* Re-enable pointer events on the actual content */
          pointer-events: auto;
        }
        .markmap-foreign {
          display: inline-block;
        }
        /* Node text boxes */
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
        /* Remove any inline styling from content */
        .markmap-foreign > div * {
          background: transparent !important;
          text-decoration: none !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
