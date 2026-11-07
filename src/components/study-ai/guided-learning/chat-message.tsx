"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  HelpCircle,
  CheckCircle2,
  Lightbulb,
  BookOpen,
  Sparkles,
  MessageCircle,
  User,
  Bot,
  Youtube,
  Image,
  ExternalLink,
  Volume2,
} from "lucide-react";
import { TTSControls } from "@/components/ui/tts-controls";
import type { GuidedMessage, MessageType, MediaResource, VideoSuggestion, DiagramSuggestion } from "@/lib/guided-learning/types";
import { CheckpointCard } from "./checkpoint-card";

interface ChatMessageProps {
  message: GuidedMessage;
  onCheckpointAnswer?: (answerId: string) => void;
  checkpointAnswered?: boolean;
  selectedAnswer?: string;
  isStreaming?: boolean;
  // TTS props
  ttsEnabled?: boolean;
  isSpeaking?: boolean;
  isPaused?: boolean;
  currentSpeakingId?: number | null;
  onPlay?: (text: string, messageId: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
}

const typeConfig: Record<
  MessageType,
  { icon: typeof MessageCircle; color: string; label: string }
> = {
  message: { icon: MessageCircle, color: "text-white/60", label: "" },
  probing_question: {
    icon: HelpCircle,
    color: "text-cyan-400",
    label: "Thinking Question",
  },
  checkpoint: {
    icon: CheckCircle2,
    color: "text-yellow-400",
    label: "Checkpoint",
  },
  hint: { icon: Lightbulb, color: "text-amber-400", label: "Hint" },
  concept_summary: {
    icon: BookOpen,
    color: "text-green-400",
    label: "Concept Mastered",
  },
  encouragement: {
    icon: Sparkles,
    color: "text-pink-400",
    label: "Great Job!",
  },
};

// Simple markdown-like rendering for chat messages
function renderContent(content: string) {
  // Split by paragraphs (double newline)
  const paragraphs = content.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    // Check if it's a list
    const lines = paragraph.split("\n");
    const isUnorderedList = lines.every((line) => /^[-*]\s/.test(line.trim()));
    const isOrderedList = lines.every((line) => /^\d+\.\s/.test(line.trim()));

    if (isUnorderedList) {
      return (
        <ul key={pIndex} className="list-disc list-inside space-y-1 text-white/80 my-2">
          {lines.map((line, lIndex) => (
            <li key={lIndex}>{renderInline(line.replace(/^[-*]\s/, ""))}</li>
          ))}
        </ul>
      );
    }

    if (isOrderedList) {
      return (
        <ol key={pIndex} className="list-decimal list-inside space-y-1 text-white/80 my-2">
          {lines.map((line, lIndex) => (
            <li key={lIndex}>{renderInline(line.replace(/^\d+\.\s/, ""))}</li>
          ))}
        </ol>
      );
    }

    // Regular paragraph
    return (
      <p key={pIndex} className="text-white/90 leading-relaxed mb-2 last:mb-0">
        {renderInline(paragraph)}
      </p>
    );
  });
}

// Render inline formatting (bold, code)
function renderInline(text: string) {
  // Split by bold markers (**text**) and inline code (`code`)
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Check for inline code
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find which comes first
    let firstMatch: { type: "bold" | "code"; match: RegExpMatchArray } | null = null;

    if (boldMatch && (!codeMatch || (boldMatch.index ?? 0) < (codeMatch.index ?? 0))) {
      firstMatch = { type: "bold", match: boldMatch };
    } else if (codeMatch) {
      firstMatch = { type: "code", match: codeMatch };
    }

    if (!firstMatch) {
      // No more matches, add remaining text
      parts.push(remaining);
      break;
    }

    // Add text before match
    const index = firstMatch.match.index ?? 0;
    if (index > 0) {
      parts.push(remaining.slice(0, index));
    }

    // Add formatted element
    if (firstMatch.type === "bold") {
      parts.push(
        <strong key={key++} className="text-white font-semibold">
          {firstMatch.match[1]}
        </strong>
      );
    } else {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-xs">
          {firstMatch.match[1]}
        </code>
      );
    }

    // Continue with remaining text
    remaining = remaining.slice(index + firstMatch.match[0].length);
  }

  return parts;
}

// Render video suggestions
function VideoSuggestions({ videos }: { videos: VideoSuggestion[] }) {
  if (!videos || videos.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
        <Youtube className="w-3.5 h-3.5" />
        <span>Recommended Videos</span>
      </div>
      <div className="space-y-1.5">
        {videos.map((video, index) => (
          <a
            key={index}
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(video.searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors group"
          >
            <Youtube className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 font-medium truncate group-hover:text-white">
                {video.title}
              </p>
              <p className="text-xs text-white/50 truncate">{video.reason}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

// Render diagram suggestions
function DiagramSuggestions({ diagrams }: { diagrams: DiagramSuggestion[] }) {
  if (!diagrams || diagrams.length === 0) return null;

  const typeLabels: Record<string, string> = {
    flowchart: "Flowchart",
    map: "Map",
    structure: "Structure Diagram",
    timeline: "Timeline",
    infographic: "Infographic",
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
        <Image className="w-3.5 h-3.5" />
        <span>Visual Diagrams</span>
      </div>
      <div className="space-y-1.5">
        {diagrams.map((diagram, index) => (
          <a
            key={index}
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(diagram.searchQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors group"
          >
            <Image className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 font-medium truncate group-hover:text-white">
                {diagram.title}
              </p>
              <p className="text-xs text-white/50 truncate">
                {typeLabels[diagram.type] || diagram.type}
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

// Render media resources
function MediaResources({ media }: { media?: MediaResource }) {
  if (!media) return null;

  return (
    <>
      <VideoSuggestions videos={media.videos || []} />
      <DiagramSuggestions diagrams={media.diagrams || []} />
    </>
  );
}

export function ChatMessage({
  message,
  onCheckpointAnswer,
  checkpointAnswered,
  selectedAnswer,
  isStreaming = false,
  ttsEnabled = false,
  isSpeaking = false,
  isPaused = false,
  currentSpeakingId,
  onPlay,
  onPause,
  onResume,
  onStop,
}: ChatMessageProps) {
  const isTutor = message.role === "tutor";
  const config = typeConfig[message.messageType] || typeConfig.message;
  const Icon = config.icon;
  const isThisMessageSpeaking = currentSpeakingId === message.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-3",
        isTutor ? "flex-row" : "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isTutor
            ? "bg-gradient-to-br from-purple-500 to-blue-500"
            : "bg-white/10"
        )}
      >
        {isTutor ? (
          <Bot className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-white/70" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 max-w-[85%]",
          isTutor ? "mr-8" : "ml-8"
        )}
      >
        {/* Type Label (for special message types) */}
        {isTutor && config.label && (
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className={cn("w-3.5 h-3.5", config.color)} />
            <span className={cn("text-xs font-medium", config.color)}>
              {config.label}
            </span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isTutor
              ? "bg-white/5 border border-white/10 rounded-tl-sm"
              : "bg-primary/20 border border-primary/30 rounded-tr-sm"
          )}
        >
          {/* Text Content */}
          <div className="text-sm">
            {message.content ? (
              <>
                {renderContent(message.content)}
                {/* Typing cursor for streaming messages */}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-400 animate-pulse rounded-sm" />
                )}
              </>
            ) : isStreaming ? (
              /* Empty streaming state - show thinking dots */
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              renderContent(message.content)
            )}
          </div>

          {/* Media Resources (YouTube videos and diagrams) - only show when not streaming */}
          {isTutor && message.media && !isStreaming && <MediaResources media={message.media} />}

          {/* Checkpoint Card - only show when not streaming */}
          {message.messageType === "checkpoint" && message.checkpointData && !isStreaming && (
            <div className="mt-3">
              <CheckpointCard
                checkpoint={message.checkpointData}
                onAnswer={onCheckpointAnswer}
                answered={checkpointAnswered}
                selectedAnswer={selectedAnswer}
              />
            </div>
          )}
        </div>

        {/* Timestamp and TTS Controls - hide during streaming */}
        {!isStreaming && (
          <div
            className={cn(
              "flex items-center gap-2 mt-1",
              isTutor ? "justify-start" : "justify-end"
            )}
          >
            <span className="text-[10px] text-white/30">
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* TTS Controls for tutor messages */}
            {isTutor && ttsEnabled && onPlay && onPause && onResume && onStop && (
              <TTSControls
                isSpeaking={isSpeaking}
                isPaused={isPaused}
                isThisMessage={isThisMessageSpeaking}
                onPlay={() => onPlay(message.content, message.id)}
                onPause={onPause}
                onResume={onResume}
                onStop={onStop}
                size="sm"
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
