"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle,
  Circle,
} from "lucide-react";

interface Microtheme {
  subject: string;
  topics: string[];
  subtopics: string[];
  pyqFrequency: number;
  importance: "high" | "medium" | "low";
}

interface MicrothemeEditorProps {
  microthemes: Microtheme[];
  onChange: (microthemes: Microtheme[]) => void;
}

const importanceConfig = {
  high: {
    label: "High",
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Circle,
  },
  low: {
    label: "Low",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
  },
};

export function MicrothemeEditor({ microthemes, onChange }: MicrothemeEditorProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState<Record<number, string>>({});

  const updateMicrotheme = (index: number, updates: Partial<Microtheme>) => {
    const updated = [...microthemes];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeMicrotheme = (index: number) => {
    const updated = microthemes.filter((_, i) => i !== index);
    onChange(updated);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  const addTopic = (microthemeIndex: number) => {
    const topicToAdd = newTopic[microthemeIndex]?.trim();
    if (!topicToAdd) return;

    const updated = [...microthemes];
    updated[microthemeIndex] = {
      ...updated[microthemeIndex],
      topics: [...updated[microthemeIndex].topics, topicToAdd],
    };
    onChange(updated);
    setNewTopic((prev) => ({ ...prev, [microthemeIndex]: "" }));
  };

  const removeTopic = (microthemeIndex: number, topicIndex: number) => {
    const updated = [...microthemes];
    updated[microthemeIndex] = {
      ...updated[microthemeIndex],
      topics: updated[microthemeIndex].topics.filter((_, i) => i !== topicIndex),
    };
    onChange(updated);
  };

  const addNewMicrotheme = () => {
    onChange([
      ...microthemes,
      {
        subject: "New Subject",
        topics: [],
        subtopics: [],
        pyqFrequency: 5,
        importance: "medium",
      },
    ]);
    setExpandedIndex(microthemes.length);
  };

  // Sort microthemes by importance
  const sortedMicrothemes = [...microthemes].map((m, originalIndex) => ({
    ...m,
    originalIndex,
  }));

  const highPriority = sortedMicrothemes.filter((m) => m.importance === "high");
  const mediumPriority = sortedMicrothemes.filter((m) => m.importance === "medium");
  const lowPriority = sortedMicrothemes.filter((m) => m.importance === "low");

  const renderMicrotheme = (
    microtheme: Microtheme & { originalIndex: number }
  ) => {
    const { originalIndex } = microtheme;
    const isExpanded = expandedIndex === originalIndex;
    const config = importanceConfig[microtheme.importance];
    const ImportanceIcon = config.icon;

    return (
      <Collapsible
        key={originalIndex}
        open={isExpanded}
        onOpenChange={(open) => setExpandedIndex(open ? originalIndex : null)}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-lg border transition-all",
            isExpanded
              ? "bg-white/10 border-white/20"
              : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
          )}
        >
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 text-left">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
              )}

              <Badge
                variant="outline"
                className={cn("flex-shrink-0", config.color)}
              >
                <ImportanceIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>

              <span className="flex-1 font-medium text-white truncate">
                {microtheme.subject}
              </span>

              <span className="text-xs text-white/40 flex-shrink-0">
                {microtheme.topics.length} topics
              </span>

              <span className="text-xs text-white/40 flex-shrink-0">
                PYQ: {microtheme.pyqFrequency}
              </span>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-4 border-t border-white/10 pt-3">
              {/* Subject Name */}
              <div className="space-y-1">
                <label className="text-xs text-white/50">Subject Name</label>
                <Input
                  value={microtheme.subject}
                  onChange={(e) =>
                    updateMicrotheme(originalIndex, { subject: e.target.value })
                  }
                  className="h-8"
                />
              </div>

              {/* Importance & PYQ Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/50">Importance</label>
                  <Select
                    value={microtheme.importance}
                    onValueChange={(value) =>
                      updateMicrotheme(originalIndex, {
                        importance: value as "high" | "medium" | "low",
                      })
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-white/50">PYQ Frequency</label>
                  <Input
                    type="number"
                    min={0}
                    value={microtheme.pyqFrequency}
                    onChange={(e) =>
                      updateMicrotheme(originalIndex, {
                        pyqFrequency: parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-8"
                  />
                </div>
              </div>

              {/* Topics */}
              <div className="space-y-2">
                <label className="text-xs text-white/50">Topics</label>
                <div className="flex flex-wrap gap-2">
                  {microtheme.topics.map((topic, topicIndex) => (
                    <Badge
                      key={topicIndex}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {topic}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTopic(originalIndex, topicIndex);
                        }}
                        className="ml-1 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTopic[originalIndex] || ""}
                    onChange={(e) =>
                      setNewTopic((prev) => ({
                        ...prev,
                        [originalIndex]: e.target.value,
                      }))
                    }
                    placeholder="Add topic..."
                    className="h-8 flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTopic(originalIndex);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => addTopic(originalIndex)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Delete Button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => removeMicrotheme(originalIndex)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Subject
              </Button>
            </div>
          </CollapsibleContent>
        </motion.div>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      {/* High Priority */}
      {highPriority.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-red-400 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" />
            High Priority ({highPriority.length})
          </h5>
          <div className="space-y-2">
            {highPriority.map(renderMicrotheme)}
          </div>
        </div>
      )}

      {/* Medium Priority */}
      {mediumPriority.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-yellow-400 uppercase tracking-wide flex items-center gap-2">
            <Circle className="w-3 h-3" />
            Medium Priority ({mediumPriority.length})
          </h5>
          <div className="space-y-2">
            {mediumPriority.map(renderMicrotheme)}
          </div>
        </div>
      )}

      {/* Low Priority */}
      {lowPriority.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-green-400 uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="w-3 h-3" />
            Low Priority ({lowPriority.length})
          </h5>
          <div className="space-y-2">
            {lowPriority.map(renderMicrotheme)}
          </div>
        </div>
      )}

      {/* Add New Subject */}
      <Button
        variant="outline"
        className="w-full gap-2 border-dashed"
        onClick={addNewMicrotheme}
      >
        <Plus className="w-4 h-4" />
        Add Subject
      </Button>
    </div>
  );
}
