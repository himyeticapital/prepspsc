"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Loader2, Check, FolderOpen, BookOpen, FileText as FileTextIcon, Youtube, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SourceCard } from "./source-card";
import { AddSourceModal } from "./add-source-modal";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";

interface Source {
  id: string;
  title: string;
  type: "url" | "pdf" | "youtube" | "audio" | "text";
  status: string | null;
  insights_count: number;
  embedded?: boolean;
  embedded_chunks?: number;
}

interface WebResult {
  title: string;
  url: string;
  snippet: string;
  selected: boolean;
}

interface RecommendedBook {
  title: string;
  author: string;
  relevantChapters?: string[];
}

interface FreeResource {
  title: string;
  url: string;
  description: string;
}

interface SourcesPanelProps {
  notebookId: string;
  subject?: string;
  topics?: string[];
  examType?: string;
  recommendedBooks?: RecommendedBook[];
  freeResources?: FreeResource[];
}

export function SourcesPanel({ notebookId, subject, topics, examType, recommendedBooks, freeResources }: SourcesPanelProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [webQuery, setWebQuery] = useState("");
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingSelected, setIsAddingSelected] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      const data = await proxyNotebook({ action: "list_sources", notebook_id: notebookId });
      setSources(Array.isArray(data) ? data : (data.sources || []));
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Poll while any source is still processing or not embedded
  useEffect(() => {
    const needsPolling = sources.some(
      (s) => !s.embedded || s.title === "Processing..." ||
        s.status === "new" || s.status === "queued" || s.status === "running"
    );
    if (!needsPolling || isLoading) return;
    const timer = setInterval(fetchSources, 4000);
    return () => clearInterval(timer);
  }, [sources, isLoading, fetchSources]);

  // Listen for source highlight events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const el = document.getElementById(`source-${detail.sourceId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-blue-400");
      setTimeout(() => el?.classList.remove("ring-2", "ring-blue-400"), 2000);
    };
    window.addEventListener("notebook:highlight-source", handler);
    return () => window.removeEventListener("notebook:highlight-source", handler);
  }, []);

  const handleWebSearch = async () => {
    if (!webQuery.trim()) return;
    setIsSearching(true);
    setWebResults([]);

    try {
      const data = await proxyNotebook({ action: "web_search", query: webQuery });
      setWebResults(
        (data.results || []).map((r: Omit<WebResult, "selected">) => ({ ...r, selected: false }))
      );
    } catch (err) {
      toast.error("Web search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleResult = (index: number) => {
    setWebResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r))
    );
  };

  const addSelectedResults = async () => {
    const selected = webResults.filter((r) => r.selected);
    if (selected.length === 0) return;
    setIsAddingSelected(true);

    // Process one at a time — SurrealDB gets transaction conflicts with concurrent writes
    let added = 0;
    let failed = 0;
    const failedUrls: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const result = selected[i];
      toast.loading(`Adding source ${i + 1}/${selected.length}...`, { id: "add-sources" });
      try {
        await proxyNotebook({
          action: "add_source",
          notebook_id: notebookId,
          source_type: "url",
          url: result.url,
        });
        added++;
      } catch (err) {
        failed++;
        failedUrls.push(new URL(result.url).hostname);
        console.error(`Failed to add source ${result.url}:`, (err as Error).message);
      }
    }

    toast.dismiss("add-sources");
    if (added > 0) {
      toast.success(`Added ${added} source${added > 1 ? "s" : ""}`);
      setWebResults([]);
      setWebQuery("");
      fetchSources();
    }
    if (failed > 0) {
      toast.error(`Failed: ${failedUrls.join(", ")} (site too slow or blocked)`);
    }
    setIsAddingSelected(false);
  };

  const handleRetrySource = async (sourceId: string) => {
    try {
      toast.loading("Retrying source...", { id: `retry-${sourceId}` });
      await proxyNotebook({
        action: "retry_source",
        source_id: sourceId,
        notebook_id: notebookId,
      });
      toast.success("Retry queued — will process when worker restarts", { id: `retry-${sourceId}` });
      fetchSources();
    } catch (err) {
      toast.error("Retry failed", { id: `retry-${sourceId}` });
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    try {
      await proxyNotebook({ action: "delete_source", source_id: sourceId });

      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      toast.success("Source deleted");
    } catch (err) {
      toast.error("Failed to delete source");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Sources</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Source
        </button>
      </div>

      {/* Web search */}
      <div className="p-3 border-b border-white/10">
        <div className="flex gap-2">
          <Input
            placeholder="Search the web for sources"
            value={webQuery}
            onChange={(e) => setWebQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleWebSearch()}
            className="h-8 text-xs bg-white/5 border-white/10 text-white"
          />
          <Button
            size="sm"
            onClick={handleWebSearch}
            disabled={isSearching || !webQuery.trim()}
            className="h-8 px-2 bg-blue-600 hover:bg-blue-700"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Web results */}
        <AnimatePresence>
          {webResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-1.5"
            >
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {webResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => toggleResult(i)}
                    className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-all text-xs ${
                      result.selected ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      result.selected ? "bg-blue-600 border-blue-600" : "border-white/30"
                    }`}>
                      {result.selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{result.title}</p>
                      <p className="text-white/40 truncate">{new URL(result.url).hostname}</p>
                      <p className="text-white/30 line-clamp-1 mt-0.5">{result.snippet}</p>
                    </div>
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                onClick={addSelectedResults}
                disabled={!webResults.some((r) => r.selected) || isAddingSelected}
                className="w-full h-7 text-xs bg-blue-600 hover:bg-blue-700"
              >
                {isAddingSelected ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Add Selected ({webResults.filter((r) => r.selected).length})
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Source cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-xs text-white/40">Add sources to get started</p>
          </div>
        ) : (
          sources.map((source) => (
            <div key={source.id} id={`source-${source.id}`} className="transition-all duration-300">
              <SourceCard
                source={source}
                onDelete={() => handleDeleteSource(source.id)}
                onRetry={() => handleRetrySource(source.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Quick Links & Resources */}
      {subject && topics && topics.length > 0 && (
        <div className="p-3 border-t border-white/10 space-y-2">
          {/* YouTube & PDF search links */}
          <div className="flex gap-1.5">
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${subject} ${topics.join(" ")} ${examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC"}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center gap-1.5 p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
            >
              <Youtube className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] text-white/70">YouTube</span>
              <ExternalLink className="w-2.5 h-2.5 text-white/40 ml-auto" />
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${subject} ${topics.join(" ")} ${examType === "sikkim-psc" ? "Sikkim PSC" : "UPSC"} PDF notes filetype:pdf`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center gap-1.5 p-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] text-white/70">PDF Notes</span>
              <ExternalLink className="w-2.5 h-2.5 text-white/40 ml-auto" />
            </a>
          </div>

          {/* Recommended Books */}
          {recommendedBooks && recommendedBooks.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-medium text-white">Recommended Books</span>
              </div>
              <div className="space-y-1.5">
                {recommendedBooks.slice(0, 2).map((book, idx) => (
                  <div key={idx} className="text-[10px]">
                    <span className="text-white font-medium">{book.title}</span>
                    <span className="text-white/40"> by {book.author}</span>
                    {book.relevantChapters && book.relevantChapters.length > 0 && (
                      <p className="text-amber-400/80 mt-0.5">Ch: {book.relevantChapters.join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free Govt Resources */}
          {freeResources && freeResources.length > 0 && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileTextIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-medium text-white">Free Govt. Resources</span>
              </div>
              <div className="space-y-1">
                {freeResources.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-1.5 text-[10px] group hover:bg-emerald-500/10 p-1 -mx-1 rounded transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-white font-medium group-hover:text-emerald-400 transition-colors">{resource.title}</span>
                      <p className="text-white/40 text-[9px] truncate">{resource.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AddSourceModal
        notebookId={notebookId}
        onSourceAdded={fetchSources}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
