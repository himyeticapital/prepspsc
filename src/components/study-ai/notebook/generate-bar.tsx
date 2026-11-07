"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Loader2, FileText, Layers, HelpCircle, BarChart3 } from "lucide-react";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type GenerationType = "summary" | "mindmap" | "flashcards" | "quiz" | "infographic";

interface GenerateBarProps {
  notebookId: string;
  notebookTitle: string;
  subject?: string;
  topics?: string[];
  examType?: string;
  planId?: string;
  topicKey?: string;
  onContentGenerated?: () => void;
}

export function GenerateBar({ notebookId, notebookTitle, subject, topics, examType, planId, topicKey, onContentGenerated }: GenerateBarProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Fetch source content from the notebook to pass to generate-topic-content
  const fetchSourceContent = async (): Promise<string> => {
    try {
      const data = await proxyNotebook({ action: "list_sources", notebook_id: notebookId });
      const sources = Array.isArray(data) ? data : (data.sources || []);
      if (sources.length === 0) return "";

      const texts: string[] = [];
      for (const source of sources.slice(0, 5)) {
        try {
          const detail = await proxyNotebook({ action: "get_source_insights", source_id: source.id });
          // Try to get full text from source detail
          const text = detail?.full_text || detail?.content || source.full_text || "";
          if (text.length >= 50) {
            texts.push(`=== SOURCE: ${source.title || "Source"} ===\n${text}`);
          }
        } catch {
          // Skip sources we can't fetch
        }
      }
      return texts.join("\n\n");
    } catch {
      return "";
    }
  };

  const handleGenerateContent = async (type: GenerationType) => {
    setIsGenerating(type);
    try {
      const sourceContent = await fetchSourceContent();

      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-topic-content",
        {
          body: {
            subject: subject || notebookTitle,
            topics: topics || [notebookTitle],
            examType: examType || "general",
            generationType: type,
            sourceContent: sourceContent || null,
          },
        }
      );

      if (fnError) {
        let actualError = fnError.message || "Failed to generate";
        try {
          const errorBody = await (fnError as unknown as { context: Response }).context?.json?.();
          if (errorBody?.error) actualError = errorBody.error;
        } catch { /* fall through */ }
        throw new Error(actualError);
      }

      // Save to "Generated This Session" in topic-study-panel's sessionStorage
      const subj = subject || notebookTitle;
      const topicsList = topics || [notebookTitle];
      const generatedStorageKey = `planner-generated-${subj}-${topicsList.join("-")}`.replace(/\s+/g, "_").toLowerCase();
      try {
        const existing = sessionStorage.getItem(generatedStorageKey);
        const prev: { type: string; data: unknown; title: string }[] = existing ? JSON.parse(existing) : [];
        const filtered = prev.filter(c => c.type !== type);
        filtered.push({ type, data: data.content, title: data.title });
        sessionStorage.setItem(generatedStorageKey, JSON.stringify(filtered));
      } catch { /* ignore storage errors */ }

      // Navigate to the existing viewer pages (same as topic-study-panel)
      const baseData = { subject: subj, topics: topicsList, examType: examType || "general", planId, topicKey };

      switch (type) {
        case "summary":
          sessionStorage.setItem("planner-summary-data", JSON.stringify({
            title: data.title,
            keyPoints: data.content.keyPoints,
            keyDates: data.content.keyDates,
            keyConcepts: data.content.keyConcepts,
            examFacts: data.content.examFacts,
            conclusion: data.content.conclusion,
            ...baseData,
          }));
          router.push("/study-ai/planner/view/summary");
          break;
        case "flashcards":
          sessionStorage.setItem("planner-flashcards-data", JSON.stringify({
            title: data.title,
            cards: data.content.cards,
            ...baseData,
          }));
          router.push("/study-ai/planner/view/flashcards");
          break;
        case "quiz":
          sessionStorage.setItem("planner-quiz-data", JSON.stringify({
            title: data.title,
            questions: data.content.questions,
            ...baseData,
          }));
          router.push("/study-ai/planner/view/quiz");
          break;
        case "infographic":
          sessionStorage.setItem("planner-infographic-data", JSON.stringify({
            title: data.title,
            keyFacts: data.content.keyFacts,
            highlights: data.content.highlights,
            ...baseData,
          }));
          router.push("/study-ai/planner/view/infographic");
          break;
        case "mindmap":
          sessionStorage.setItem("planner-mindmap-data", JSON.stringify({
            markdown: data.content.markdown,
            title: data.title,
            ...baseData,
          }));
          router.push("/study-ai/planner/view/mindmap");
          break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate";
      toast.error(message);
    } finally {
      setIsGenerating(null);
    }
  };

  const topRow = [
    { key: "summary", label: "Summary", icon: FileText, color: "bg-green-500/20 text-green-400 border-green-500/30", onClick: () => handleGenerateContent("summary") },
    { key: "mindmap", label: "Mind Map", icon: Map, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", onClick: () => handleGenerateContent("mindmap") },
    { key: "flashcards", label: "Flashcards", icon: Layers, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", onClick: () => handleGenerateContent("flashcards") },
    { key: "quiz", label: "Quiz", icon: HelpCircle, color: "bg-rose-500/20 text-rose-400 border-rose-500/30", onClick: () => handleGenerateContent("quiz") },
    { key: "infographic", label: "Infographic", icon: BarChart3, color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", onClick: () => handleGenerateContent("infographic") },
  ];

  const renderButton = ({ key, label, icon: Icon, color, onClick }: { key: string; label: string; icon: typeof FileText; color: string; onClick: () => void | Promise<void> }) => (
    <button
      key={key}
      onClick={onClick}
      disabled={isGenerating !== null}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 ${color}`}
    >
      {isGenerating === key ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );

  return (
    <div className="border-t border-white/10 p-3 space-y-2">
      <div className="flex gap-2">
        {topRow.map(renderButton)}
      </div>
    </div>
  );
}
