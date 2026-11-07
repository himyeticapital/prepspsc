"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquare, Plus, Trash2, Settings, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { proxyNotebook } from "@/lib/notebook-proxy";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface Source {
  id: string;
  title?: string;
  name?: string;
}

type ContextMode = "none" | "key_insights" | "full_content";

interface NotebookChatPanelProps {
  notebookId: string;
}

export function NotebookChatPanel({ notebookId }: NotebookChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>("key_insights");
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const proxyCall = useCallback(proxyNotebook, []);

  // Reset state and load sessions + sources when notebook changes
  useEffect(() => {
    // Reset all state immediately when notebook changes
    setMessages([]);
    setSessions([]);
    setSources([]);
    setActiveSessionId(null);
    setInput("");

    const load = async () => {
      try {
        const [sessionsData, sourcesData] = await Promise.all([
          proxyCall({ action: "list_chat_sessions", notebook_id: notebookId }),
          proxyCall({ action: "list_sources", notebook_id: notebookId }),
        ]);
        const sessions = Array.isArray(sessionsData) ? sessionsData : (sessionsData.sessions || []);
        const sourcesArr = Array.isArray(sourcesData) ? sourcesData : (sourcesData.sources || []);
        setSessions(sessions);
        setSources(sourcesArr.map((s: Source) => ({ id: s.id, title: s.title || s.name || "" })));

        if (sessions.length > 0) {
          setActiveSessionId(sessions[0].id);
        }
      } catch (err) {
        console.error("Failed to load chat data:", err);
      }
    };
    load();
  }, [notebookId, proxyCall]);

  // Load messages when session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      try {
        const data = await proxyCall({
          action: "get_chat_messages",
          session_id: activeSessionId,
        });
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    };
    loadMessages();
  }, [activeSessionId, proxyCall]);

  const createSession = async () => {
    try {
      const data = await proxyCall({
        action: "create_chat_session",
        notebook_id: notebookId,
      });
      const newSession = data.id ? data : data.session;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      setShowSessionDropdown(false);
    } catch (err) {
      toast.error("Failed to create session");
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await proxyCall({ action: "delete_chat_session", session_id: sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
      toast.success("Session deleted");
    } catch (err) {
      toast.error("Failed to delete session");
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Auto-create session if none
      let sessionId = activeSessionId;
      if (!sessionId) {
        const data = await proxyCall({
          action: "create_chat_session",
          notebook_id: notebookId,
        });
        const newSess = data.id ? data : data.session;
        sessionId = newSess.id;
        setSessions((prev) => [newSess, ...prev]);
        setActiveSessionId(sessionId);
      }

      const data = await proxyCall({
        action: "send_chat_message",
        session_id: sessionId,
        notebook_id: notebookId,
        message: userMessage,
        context_mode: contextMode,
      });

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      toast.error("Failed to send message");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Chat with Notebook</h3>
        <div className="flex items-center gap-1">
          {/* Context mode */}
          <div className="relative">
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
              title="Context settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            {showContextMenu && (
              <div className="absolute right-0 top-8 z-10 w-44 p-2 rounded-xl bg-[#0a0a0b] border border-white/10 shadow-xl">
                {(["none", "key_insights", "full_content"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setContextMode(mode); setShowContextMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all ${
                      contextMode === mode ? "bg-blue-500/20 text-blue-400" : "text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {mode === "none" ? "No context" : mode === "key_insights" ? "Key insights" : "Full content"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Session selector */}
          <div className="relative">
            <button
              onClick={() => setShowSessionDropdown(!showSessionDropdown)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition-all"
            >
              <span className="truncate max-w-[80px]">{activeSession?.title || "Sessions"}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSessionDropdown && (
              <div className="absolute right-0 top-8 z-10 w-52 p-2 rounded-xl bg-[#0a0a0b] border border-white/10 shadow-xl">
                <button
                  onClick={createSession}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-blue-400 hover:bg-blue-500/10 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  New Session
                </button>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                      activeSessionId === session.id ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <button
                      onClick={() => { setActiveSessionId(session.id); setShowSessionDropdown(false); }}
                      className="flex-1 text-left truncate"
                    >
                      {session.title}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-5 h-5 text-white/30" />
            </div>
            <p className="text-sm font-medium text-white/40 mb-1">Ask anything about your sources</p>
            <p className="text-xs text-white/25">Get summaries, explanations, and insights</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ChatMessage message={msg} sources={sources} />
            </motion.div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-blue-400/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your sources..."
            rows={1}
            className="flex-1 min-h-[36px] max-h-[100px] text-sm bg-white/5 border-white/10 text-white resize-none"
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
