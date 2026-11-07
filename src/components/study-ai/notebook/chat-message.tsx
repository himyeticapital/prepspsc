"use client";

import React from "react";
import { Bot, User } from "lucide-react";
import { CitationLink } from "./citation-link";

interface ChatMessageProps {
  message: {
    role: "user" | "assistant";
    content: string;
  };
  sources: { id: string; title?: string; name?: string }[];
}

// Render inline formatting: **bold**, *italic*, `code`, [source:ID]
function renderInline(
  text: string,
  sources: { id: string; title?: string; name?: string }[]
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find first match among: bold, italic, inline code, citation
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const codeMatch = remaining.match(/`(.+?)`/);
    const citationMatch = remaining.match(/\[source:([^\]]+)\]/);

    type MatchType = "bold" | "italic" | "code" | "citation";
    let firstMatch: { type: MatchType; match: RegExpMatchArray } | null = null;
    let minIndex = Infinity;

    for (const [type, match] of [
      ["bold", boldMatch],
      ["italic", italicMatch],
      ["code", codeMatch],
      ["citation", citationMatch],
    ] as [MatchType, RegExpMatchArray | null][]) {
      if (match && (match.index ?? Infinity) < minIndex) {
        minIndex = match.index ?? Infinity;
        firstMatch = { type, match };
      }
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    const index = firstMatch.match.index ?? 0;
    if (index > 0) {
      parts.push(remaining.slice(0, index));
    }

    switch (firstMatch.type) {
      case "bold":
        parts.push(
          <strong key={key++} className="text-white font-semibold">
            {firstMatch.match[1]}
          </strong>
        );
        break;
      case "italic":
        parts.push(
          <em key={key++} className="text-white/80 italic">
            {firstMatch.match[1]}
          </em>
        );
        break;
      case "code":
        parts.push(
          <code
            key={key++}
            className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-[13px] font-mono"
          >
            {firstMatch.match[1]}
          </code>
        );
        break;
      case "citation": {
        const sourceId = firstMatch.match[1];
        const sourceIndex = sources.findIndex((s) => s.id === sourceId);
        const source = sources.find((s) => s.id === sourceId);
        if (source) {
          parts.push(
            <CitationLink
              key={key++}
              sourceId={sourceId}
              sourceTitle={source.title || source.name || ""}
              index={sourceIndex + 1}
            />
          );
        } else {
          parts.push(
            <span key={key++} className="text-white/30 text-xs">
              [?]
            </span>
          );
        }
        break;
      }
    }

    remaining = remaining.slice(index + firstMatch.match[0].length);
  }

  return parts;
}

// Render full markdown content: paragraphs, headers, lists, code blocks
function renderContent(
  content: string,
  sources: { id: string; title?: string; name?: string }[]
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Code block (```)
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre
          key={elements.length}
          className="my-2 p-3 rounded-lg bg-black/40 border border-white/10 overflow-x-auto"
        >
          <code className="text-[13px] font-mono text-cyan-200 leading-relaxed">
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      continue;
    }

    // Headers
    const headerMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const cls =
        level === 1
          ? "text-base font-bold text-white mt-3 mb-1.5"
          : level === 2
            ? "text-[15px] font-semibold text-white mt-2.5 mb-1"
            : "text-sm font-semibold text-white/90 mt-2 mb-1";
      elements.push(
        <div key={elements.length} className={cls}>
          {renderInline(text, sources)}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list block
    if (/^[-*•]\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={elements.length} className="my-1.5 ml-1 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-white/85">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400/60 flex-shrink-0" />
              <span className="text-sm leading-relaxed">
                {renderInline(item, sources)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list block
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={elements.length} className="my-1.5 ml-1 space-y-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-white/85">
              <span className="mt-0.5 text-xs font-semibold text-blue-400/80 flex-shrink-0 w-4 text-right">
                {idx + 1}.
              </span>
              <span className="text-sm leading-relaxed">
                {renderInline(item, sources)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Regular paragraph — collect consecutive non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().match(/^#{1,3}\s/) &&
      !/^[-*•]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p
          key={elements.length}
          className="text-sm text-white/85 leading-relaxed mb-1.5 last:mb-0"
        >
          {renderInline(paraLines.join(" "), sources)}
        </p>
      );
    }
  }

  return elements;
}

export function ChatMessage({ message, sources }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? "bg-blue-600"
            : "bg-gradient-to-br from-purple-500 to-blue-500"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-white" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[88%] rounded-2xl ${
          isUser
            ? "bg-blue-600 px-3.5 py-2.5 text-white rounded-tr-sm"
            : "bg-white/[0.04] border border-white/[0.08] px-4 py-3 rounded-tl-sm"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="space-y-0">{renderContent(message.content, sources)}</div>
        )}
      </div>
    </div>
  );
}
