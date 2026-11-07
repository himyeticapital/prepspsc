"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { BookMarked, Plus, Loader2, ChevronDown, Trash2, BookOpen, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SourcesPanel } from "./sources-panel";
import { NotesPanel } from "./notes-panel";
import { NotebookChatPanel } from "./notebook-chat-panel";
import { GenerateBar } from "./generate-bar";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Notebook {
  id: string;
  name: string;  // Open Notebook uses "name" not "title"
  created_at?: string;
  created?: string;
}

interface StudyPlanTopic {
  subject: string;
  topics: string[];
  fullName: string;
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

interface NotebookTabProps {
  topicContext?: string;
  topicList?: string[];
  subject?: string;
  topics?: string[];
  examType?: string;
  planId?: string;
  topicKey?: string;
  recommendedBooks?: RecommendedBook[];
  freeResources?: FreeResource[];
}

export function NotebookTab({ topicContext, topicList, subject, topics, examType, planId, topicKey, recommendedBooks, freeResources }: NotebookTabProps) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [studyPlanTopics, setStudyPlanTopics] = useState<StudyPlanTopic[]>([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const proxyCall = useCallback(proxyNotebook, []);

  // Fetch study plan topics for the topic picker
  useEffect(() => {
    const fetchStudyPlanTopics = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get study plans (table uses 'schedule' JSON, no 'status' column)
        const { data: plans } = await supabase
          .from("study_plans")
          .select("id, schedule, title")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (!plans || plans.length === 0) return;

        // Extract topics from plans — schedule contains week/day/session structure
        const topics: StudyPlanTopic[] = [];
        for (const plan of plans) {
          const schedule = plan.schedule as Record<string, unknown>;
          const weeks = (schedule?.weeks || []) as Array<Record<string, unknown>>;
          for (const week of weeks) {
            const days = (week.days || []) as Array<Record<string, unknown>>;
            for (const day of days) {
              const sessions = (day.sessions || []) as Array<Record<string, unknown>>;
              for (const session of sessions) {
                const subject = (session.subject || "") as string;
                const sessionTopics = (session.topics || []) as string[];
                if (subject && sessionTopics.length > 0) {
                  const fullName = `${subject} - ${sessionTopics.join(", ")}`;
                  if (!topics.find(t => t.fullName === fullName)) {
                    topics.push({ subject, topics: sessionTopics, fullName });
                  }
                }
              }
            }
          }
        }

        setStudyPlanTopics(topics);
      } catch (err) {
        console.error("Failed to fetch study plan topics:", err);
      }
    };

    fetchStudyPlanTopics();
  }, []);

  const isStandalone = !topicContext && (!topicList || topicList.length === 0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await proxyCall({ action: "list_notebooks" });
        const allNotebooks: Notebook[] = Array.isArray(data) ? data : (data.notebooks || []);

        if (isStandalone) {
          // In standalone mode, only show notebooks created from this tab
          // (tracked in localStorage) — exclude planner-created notebooks
          const standaloneIds: string[] = JSON.parse(localStorage.getItem("standalone-notebook-ids") || "[]");
          const filtered = allNotebooks.filter((nb) => standaloneIds.includes(nb.id));
          setNotebooks(filtered);
        } else {
          setNotebooks(allNotebooks);

          // If topicList provided, create one notebook per topic
          const topicsToCreate = topicList && topicList.length > 0
            ? topicList
            : topicContext ? [topicContext] : [];

          if (topicsToCreate.length > 0) {
            let lastCreatedId: string | null = null;
            for (const topic of topicsToCreate) {
              const match = allNotebooks.find((nb) =>
                nb.name.toLowerCase() === topic.toLowerCase()
              );
              if (match) {
                lastCreatedId = match.id;
              } else {
                try {
                  const nbData = await proxyCall({
                    action: "create_notebook",
                    title: topic,
                  });
                  const nb = nbData.id ? nbData : nbData.notebook;
                  allNotebooks.push(nb);
                  setNotebooks([...allNotebooks]);
                  lastCreatedId = nb.id;
                } catch (createErr) {
                  console.error("Failed to auto-create notebook:", createErr);
                }
              }
            }
            // Select the first topic's notebook by default
            const firstTopic = topicsToCreate[0];
            const firstMatch = allNotebooks.find((nb) =>
              nb.name.toLowerCase() === firstTopic.toLowerCase()
            );
            setSelectedNotebookId(firstMatch?.id || lastCreatedId);
          }
        }
      } catch (err) {
        console.error("Failed to load notebooks:", err);
        toast.error("Could not connect to notebook service");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [proxyCall, topicContext, isStandalone, topicList]);

  // Track notebook activity for spaced revision when tied to a study plan
  useEffect(() => {
    if (!selectedNotebookId || !planId || !subject || !topics?.length) return;

    // Fire-and-forget: register this topic for spaced revision
    fetch("/api/study-ai/notebook-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, topicKey, subject, topics }),
    }).catch(() => {
      // Silent fail — non-critical
    });
  }, [selectedNotebookId, planId, topicKey, subject, topics]);

  const trackStandaloneNotebook = (id: string) => {
    const ids: string[] = JSON.parse(localStorage.getItem("standalone-notebook-ids") || "[]");
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem("standalone-notebook-ids", JSON.stringify(ids));
    }
  };

  const untrackStandaloneNotebook = (id: string) => {
    const ids: string[] = JSON.parse(localStorage.getItem("standalone-notebook-ids") || "[]");
    localStorage.setItem("standalone-notebook-ids", JSON.stringify(ids.filter((i) => i !== id)));
  };

  const createNotebook = async () => {
    const title = newTitle.trim() || topicContext || "Untitled Notebook";
    setIsCreating(true);

    try {
      const data = await proxyCall({
        action: "create_notebook",
        title,
      });
      const nb = data.id ? data : data.notebook;
      if (isStandalone) trackStandaloneNotebook(nb.id);
      setNotebooks((prev) => [nb, ...prev]);
      setSelectedNotebookId(nb.id);
      setNewTitle("");
      setShowNewInput(false);
      toast.success("Notebook created");
    } catch (err) {
      toast.error("Failed to create notebook");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteNotebook = async (id: string) => {
    try {
      await proxyCall({ action: "delete_notebook", notebook_id: id });
      untrackStandaloneNotebook(id);
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      if (selectedNotebookId === id) setSelectedNotebookId(null);
      toast.success("Notebook deleted");
    } catch (err) {
      toast.error("Failed to delete notebook");
    }
  };

  const selectedNotebook = notebooks.find((n) => n.id === selectedNotebookId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Top bar */}
      <div className="widget-glass p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-violet-400" />
          </div>

          {/* Notebook selector */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all w-full text-left"
            >
              <span className="flex-1 text-sm text-white truncate">
                {selectedNotebook?.name || "Select Notebook"}
              </span>
              <ChevronDown className="w-4 h-4 text-white/40" />
            </button>

            {showDropdown && (
              <div className="absolute left-0 top-full mt-1 z-20 w-full max-h-60 overflow-y-auto rounded-xl bg-[#0a0a0b] border border-white/10 shadow-xl">
                {notebooks.map((nb) => (
                  <div
                    key={nb.id}
                    className={`flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer ${
                      selectedNotebookId === nb.id ? "bg-white/10" : ""
                    }`}
                  >
                    <button
                      onClick={() => { setSelectedNotebookId(nb.id); setShowDropdown(false); }}
                      className="flex-1 text-sm text-white text-left truncate"
                    >
                      {nb.name}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.id); }}
                      className="p-1 rounded hover:bg-red-500/20 text-white/20 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {notebooks.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-white/40">No notebooks yet</div>
                )}
              </div>
            )}
          </div>

          {/* New notebook - hide when scoped to specific topics */}
          {!topicContext && (!topicList || topicList.length === 0) && (
            <div className="relative">
              <Button
                size="sm"
                onClick={() => setShowTopicPicker(!showTopicPicker)}
                className="h-9 bg-violet-600 hover:bg-violet-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Notebook
              </Button>

              {/* Topic picker dropdown */}
              {showTopicPicker && (
                <div className="absolute right-0 top-full mt-2 z-30 w-80 max-h-96 overflow-y-auto rounded-xl bg-[#0a0a0b] border border-white/10 shadow-xl">
                  <div className="p-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">Create Notebook</span>
                      <button
                        onClick={() => setShowTopicPicker(false)}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Custom title input */}
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Custom notebook title..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && newTitle.trim() && createNotebook()}
                        className="h-8 text-sm bg-white/5 border-white/10 text-white flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={createNotebook}
                        disabled={isCreating || !newTitle.trim()}
                        className="h-8 px-3 bg-violet-600 hover:bg-violet-700"
                      >
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
                      </Button>
                    </div>
                  </div>

                  {/* Study plan topics */}
                  {studyPlanTopics.length > 0 && (
                    <div className="p-2">
                      <div className="px-2 py-1.5 text-xs text-white/40 font-medium flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" />
                        From Your Study Plan
                      </div>
                      {studyPlanTopics.slice(0, 15).map((topic, idx) => (
                        <button
                          key={idx}
                          onClick={async () => {
                            setNewTitle(topic.fullName);
                            setIsCreating(true);
                            try {
                              const data = await proxyCall({
                                action: "create_notebook",
                                title: topic.fullName,
                              });
                              const nb = data.id ? data : data.notebook;
                              if (isStandalone) trackStandaloneNotebook(nb.id);
                              setNotebooks((prev) => [nb, ...prev]);
                              setSelectedNotebookId(nb.id);
                              toast.success("Notebook created");
                              setShowTopicPicker(false);
                              setNewTitle("");
                            } catch {
                              toast.error("Failed to create notebook");
                            } finally {
                              setIsCreating(false);
                            }
                          }}
                          disabled={isCreating}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                          <div className="text-sm text-white truncate group-hover:text-violet-300">
                            {topic.subject}
                          </div>
                          <div className="text-xs text-white/50 truncate">
                            {topic.topics.join(", ")}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {studyPlanTopics.length === 0 && (
                    <div className="p-4 text-center text-xs text-white/40">
                      No study plan topics found.<br />
                      Create a study plan to see topics here.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {!selectedNotebookId ? (
        <div className="widget-glass p-12 rounded-2xl text-center">
          <BookMarked className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Notebook Selected</h3>
          <p className="text-white/50 text-sm">Select or create a notebook to get started</p>
        </div>
      ) : (
        <div className="widget-glass rounded-2xl overflow-hidden">
          {/* 3-column layout */}
          <div className="flex flex-col lg:flex-row" style={{ height: "80vh", minHeight: "600px" }}>
            {/* Sources panel */}
            <div className="w-full lg:w-[280px] border-b lg:border-b-0 lg:border-r border-white/10 flex-shrink-0">
              <SourcesPanel key={selectedNotebookId} notebookId={selectedNotebookId} subject={subject} topics={topics} examType={examType} recommendedBooks={recommendedBooks} freeResources={freeResources} />
            </div>

            {/* Notes panel */}
            <div className="flex-1 border-b lg:border-b-0 lg:border-r border-white/10 min-w-0">
              <NotesPanel key={selectedNotebookId} notebookId={selectedNotebookId} />
            </div>

            {/* Chat panel */}
            <div className="w-full lg:w-[440px] flex-shrink-0">
              <NotebookChatPanel key={selectedNotebookId} notebookId={selectedNotebookId} />
            </div>
          </div>

          {/* Generate bar */}
          <GenerateBar
            notebookId={selectedNotebookId}
            notebookTitle={selectedNotebook?.name || ""}
            subject={subject}
            topics={topics}
            examType={examType}
            planId={planId}
            topicKey={topicKey}
            onContentGenerated={() => {
              window.dispatchEvent(new CustomEvent("notebook:notes-refresh"));
            }}
          />
        </div>
      )}
    </motion.div>
  );
}
