"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Loader2,
  GraduationCap,
  RefreshCw,
  Crown,
} from "lucide-react";
import { VoiceInput } from "@/components/ui/voice-input";
import { useTextToSpeech } from "@/hooks/use-text-to-speech";
import { toast } from "sonner";
import { SessionHeader } from "./session-header";
import { ChatMessage } from "./chat-message";
import { createClient } from "@/lib/supabase/client";
import type {
  GuidedLearningChatProps,
  GuidedMessage,
  SessionState,
  GuidedLearningChatResponse,
  PlannerContext,
} from "@/lib/guided-learning/types";

// Supabase Edge Function URL for longer timeouts
const EDGE_FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/guided-learning-chat`;

// Streaming message interface for progressive updates
interface StreamingMessage extends GuidedMessage {
  isStreaming?: boolean;
  streamedContent?: string;
}

export function GuidedLearningChat({
  goalId,
  plannerContext,
  userId,
  isPro,
  existingSessionId,
  onSessionComplete,
  onClose,
  maxHeight = "60vh",
  className,
}: GuidedLearningChatProps) {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(existingSessionId || null);
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "active",
    currentConcept: null,
    conceptsMastered: [],
    conceptsStruggling: [],
    understandingScore: null,
    checkpointsPassed: 0,
    checkpointsTotal: 0,
    totalExchanges: 0,
  });
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [checkpointAnswers, setCheckpointAnswers] = useState<
    Record<number, string>
  >({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("guided-tts-enabled") === "true";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAutoPlayedIdRef = useRef<number | null>(null);

  // Text-to-Speech hook
  const {
    speak,
    stop: stopSpeaking,
    pause: pauseSpeaking,
    resume: resumeSpeaking,
    isSpeaking,
    isPaused,
    isSupported: ttsSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    currentMessageId: speakingMessageId,
  } = useTextToSpeech();

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Save TTS enabled state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("guided-tts-enabled", ttsEnabled.toString());
    }
  }, [ttsEnabled]);

  // Auto-play new tutor messages when TTS is enabled
  useEffect(() => {
    if (!ttsEnabled || !ttsSupported || messages.length === 0 || isLoading) return;

    const lastMessage = messages[messages.length - 1];
    // Only auto-play tutor messages that haven't been played yet and are not streaming
    if (
      lastMessage.role === "tutor" &&
      !lastMessage.isStreaming &&
      lastAutoPlayedIdRef.current !== lastMessage.id
    ) {
      // Mark as played immediately to prevent re-triggering
      lastAutoPlayedIdRef.current = lastMessage.id;
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        speak(lastMessage.content, lastMessage.id);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [messages, ttsEnabled, ttsSupported, isLoading, speak]);

  // Initialize or resume session
  useEffect(() => {
    const initSession = async () => {
      setIsInitializing(true);

      try {
        if (existingSessionId) {
          // Resume existing session
          const response = await fetch(
            `/api/study-ai/guided-learning/sessions/${existingSessionId}`
          );

          if (response.ok) {
            const data = await response.json();
            setSessionId(data.session.id);
            setMessages(
              data.messages.map((m: {
                id: number;
                role: string;
                content: string;
                message_type: string;
                checkpoint_data: unknown;
                media_data: unknown;
                created_at: string;
                student_checkpoint_response?: string;
              }) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                messageType: m.message_type,
                checkpointData: m.checkpoint_data,
                media: m.media_data,
                createdAt: m.created_at,
              }))
            );
            setSessionState({
              status: data.session.status,
              currentConcept: data.session.current_concept,
              conceptsMastered: data.session.concepts_mastered || [],
              conceptsStruggling: data.session.concepts_struggling || [],
              understandingScore: data.session.understanding_score,
              checkpointsPassed: data.session.checkpoints_passed || 0,
              checkpointsTotal: data.session.checkpoints_total || 0,
              totalExchanges: data.session.total_exchanges || 0,
            });

            // Load checkpoint answers
            const answers: Record<number, string> = {};
            data.messages.forEach((m: { id: number; message_type: string; student_checkpoint_response?: string }) => {
              if (m.message_type === "checkpoint" && m.student_checkpoint_response) {
                answers[m.id] = m.student_checkpoint_response;
              }
            });
            setCheckpointAnswers(answers);
          }
        } else {
          // Check for existing active session
          const params = new URLSearchParams();
          if (goalId) params.set("goalId", goalId.toString());
          if (plannerContext) {
            params.set("planId", plannerContext.planId);
            params.set("subject", plannerContext.subject);
          }
          params.set("status", "active");
          params.set("includeMessages", "true");

          const response = await fetch(
            `/api/study-ai/guided-learning/sessions?${params}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data.sessions && data.sessions.length > 0) {
              const session = data.sessions[0];
              setSessionId(session.id);
              setMessages(
                (data.messages || []).map((m: {
                  id: number;
                  role: string;
                  content: string;
                  message_type: string;
                  checkpoint_data: unknown;
                  media_data: unknown;
                  created_at: string;
                  student_checkpoint_response?: string;
                }) => ({
                  id: m.id,
                  role: m.role,
                  content: m.content,
                  messageType: m.message_type,
                  checkpointData: m.checkpoint_data,
                  media: m.media_data,
                  createdAt: m.created_at,
                }))
              );
              setSessionState({
                status: session.status,
                currentConcept: session.current_concept,
                conceptsMastered: session.concepts_mastered || [],
                conceptsStruggling: session.concepts_struggling || [],
                understandingScore: session.understanding_score,
                checkpointsPassed: session.checkpoints_passed || 0,
                checkpointsTotal: session.checkpoints_total || 0,
                totalExchanges: session.total_exchanges || 0,
              });

              // Load checkpoint answers
              const answers: Record<number, string> = {};
              (data.messages || []).forEach((m: { id: number; message_type: string; student_checkpoint_response?: string }) => {
                if (m.message_type === "checkpoint" && m.student_checkpoint_response) {
                  answers[m.id] = m.student_checkpoint_response;
                }
              });
              setCheckpointAnswers(answers);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing session:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initSession();
  }, [existingSessionId, goalId, plannerContext]);

  // Send message with streaming support
  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setInputValue("");

    try {
      // Get auth token for Edge Function
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Please sign in to continue");
        setIsLoading(false);
        return;
      }

      // Call Edge Function (non-streaming for instant response)
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          goalId,
          plannerContext,
          message: message.trim(),
          stream: false, // Disable streaming - show full response at once
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          toast.error(error.message || "Daily limit reached");
        } else {
          toast.error(error.error || "Failed to send message");
        }
        setIsLoading(false);
        return;
      }

      // Check if streaming response
      const contentType = response.headers.get("Content-Type");
      if (contentType?.includes("text/event-stream") && response.body) {
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedText = "";
        let tempTutorMessageId = Date.now(); // Temporary ID for streaming message

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);

                if (data.type === "init") {
                  // Set session ID and add student message
                  setSessionId(data.sessionId);
                  if (data.studentMessage) {
                    setMessages(prev => [...prev, data.studentMessage]);
                  }
                  // Add placeholder for tutor message (streaming)
                  setMessages(prev => [...prev, {
                    id: tempTutorMessageId,
                    role: "tutor",
                    content: "",
                    messageType: "message",
                    isStreaming: true,
                    streamedContent: "",
                    createdAt: new Date().toISOString(),
                  }]);
                } else if (data.type === "text") {
                  // Update streaming content
                  streamedText += data.content;
                  setMessages(prev => prev.map(m =>
                    m.id === tempTutorMessageId
                      ? { ...m, streamedContent: streamedText }
                      : m
                  ));
                } else if (data.type === "done") {
                  // Replace streaming message with final message
                  if (data.tutorMessage) {
                    setMessages(prev => prev.map(m =>
                      m.id === tempTutorMessageId
                        ? { ...data.tutorMessage, isStreaming: false }
                        : m
                    ));
                  }
                  // Update session state
                  if (data.sessionState) {
                    setSessionState(data.sessionState);

                    // Check if session completed
                    if (data.sessionState.status === "completed") {
                      toast.success("Session completed! Great work!");
                      onSessionComplete?.({
                        sessionId: sessionId || data.sessionId,
                        userId,
                        goalId,
                        conceptsMastered: data.sessionState.conceptsMastered,
                        conceptsStruggling: data.sessionState.conceptsStruggling,
                        understandingScore: data.sessionState.understandingScore || 0,
                        totalExchanges: data.sessionState.totalExchanges,
                        checkpointsPassed: data.sessionState.checkpointsPassed,
                        checkpointsTotal: data.sessionState.checkpointsTotal,
                      });
                    }
                  }
                } else if (data.type === "error") {
                  toast.error(data.error || "Failed to get response");
                  // Remove streaming placeholder
                  setMessages(prev => prev.filter(m => m.id !== tempTutorMessageId));
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete JSON chunks
                console.debug("Parse chunk error (likely incomplete):", parseError);
              }
            }
          }
        } catch (streamError) {
          console.error("Stream reading error:", streamError);
          toast.error("Connection interrupted. Please try again.");
          // Remove streaming placeholder on error
          setMessages(prev => prev.filter(m => m.id !== tempTutorMessageId));
        }
      } else {
        // Handle non-streaming response (fallback)
        const data: GuidedLearningChatResponse = await response.json();

        setSessionId(data.sessionId);
        setMessages((prev) => [...prev, ...data.messages]);
        setSessionState(data.sessionState);

        // Check if session completed
        if (data.sessionState.status === "completed") {
          toast.success("Session completed! Great work!");
          onSessionComplete?.({
            sessionId: data.sessionId,
            userId,
            goalId,
            conceptsMastered: data.sessionState.conceptsMastered,
            conceptsStruggling: data.sessionState.conceptsStruggling,
            understandingScore: data.sessionState.understandingScore || 0,
            totalExchanges: data.sessionState.totalExchanges,
            checkpointsPassed: data.sessionState.checkpointsPassed,
            checkpointsTotal: data.sessionState.checkpointsTotal,
          });
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle checkpoint answer
  const handleCheckpointAnswer = async (messageId: number, answerId: string) => {
    if (checkpointAnswers[messageId]) return; // Already answered

    setCheckpointAnswers((prev) => ({ ...prev, [messageId]: answerId }));

    try {
      // Get auth token for Edge Function
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) return;

      // Call Edge Function directly (non-streaming for checkpoint responses)
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          goalId,
          plannerContext,
          message: `I selected option ${answerId.toUpperCase()}`,
          checkpointResponse: {
            messageId,
            selectedAnswer: answerId,
          },
          stream: false, // Don't stream checkpoint responses
        }),
      });

      if (response.ok) {
        const data: GuidedLearningChatResponse = await response.json();
        setMessages((prev) => [...prev, ...data.messages]);
        setSessionState(data.sessionState);
      }
    } catch (error) {
      console.error("Error submitting checkpoint answer:", error);
    }
  };

  // Complete session
  const handleComplete = async () => {
    if (!sessionId) return;

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/study-ai/guided-learning/sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete" }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success("Session completed! Great work!");
        setSessionState((prev) => ({ ...prev, status: "completed" }));
        onSessionComplete?.(data.result);
      }
    } catch (error) {
      console.error("Error completing session:", error);
      toast.error("Failed to complete session");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Start new session (for first message)
  const handleStartSession = () => {
    const welcomeMessage = "Hi, I'm ready to learn!";
    sendMessage(welcomeMessage);
  };

  // Handle expand toggle
  const handleExpandToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  // Handle close - contract first if expanded
  const handleClose = () => {
    if (isExpanded) {
      setIsExpanded(false);
    }
    onClose?.();
  };

  // Get display content for a message (handles streaming)
  const getMessageContent = (message: StreamingMessage) => {
    if (message.isStreaming && message.streamedContent !== undefined) {
      return message.streamedContent;
    }
    return message.content;
  };

  return (
    <>
      {/* Expanded Overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={handleExpandToggle}
        />
      )}

      <div
        className={cn(
          "flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden transition-all duration-300",
          isExpanded
            ? "fixed inset-4 md:inset-8 lg:inset-12 z-50 rounded-2xl shadow-2xl"
            : "rounded-xl",
          className
        )}
        style={isExpanded ? undefined : { maxHeight }}
      >
        {/* Header */}
        <SessionHeader
          sessionState={sessionState}
          subject={plannerContext?.subject}
          topics={plannerContext?.topics}
          isExpanded={isExpanded}
          onExpandToggle={handleExpandToggle}
          onClose={handleClose}
          onComplete={
            sessionState.totalExchanges >= 5 && sessionState.status === "active"
              ? handleComplete
              : undefined
          }
          // TTS props
          ttsEnabled={ttsEnabled}
          onTTSToggle={setTtsEnabled}
          voices={voices}
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          speechRate={rate}
          onRateChange={setRate}
          isTTSSupported={ttsSupported}
        />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isInitializing ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-white/50" />
          </div>
        ) : messages.length === 0 ? (
          // Empty state - start session
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Ready to Learn?
            </h3>
            <p className="text-sm text-white/60 mb-6 max-w-xs">
              I'll guide you through the topic using questions and discussions.
              No direct answers - just discovery!
            </p>
            <Button
              onClick={handleStartSession}
              disabled={isLoading}
              className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <GraduationCap className="w-4 h-4 mr-2" />
              )}
              Start Guided Session
            </Button>

            {!isPro && (
              <p className="text-xs text-white/40 mt-4 flex items-center gap-1">
                <Crown className="w-3 h-3 text-yellow-500" />
                Free: 3 sessions/day • Pro: Unlimited
              </p>
            )}
          </div>
        ) : (
          // Messages list
          <AnimatePresence>
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={{
                  ...message,
                  content: getMessageContent(message),
                }}
                onCheckpointAnswer={(answerId) =>
                  handleCheckpointAnswer(message.id, answerId)
                }
                checkpointAnswered={!!checkpointAnswers[message.id]}
                selectedAnswer={checkpointAnswers[message.id]}
                isStreaming={message.isStreaming}
                // TTS props
                ttsEnabled={ttsEnabled && ttsSupported}
                isSpeaking={isSpeaking}
                isPaused={isPaused}
                currentSpeakingId={speakingMessageId}
                onPlay={(text, messageId) => speak(text, messageId)}
                onPause={pauseSpeaking}
                onResume={resumeSpeaking}
                onStop={stopSpeaking}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Loading indicator - only show when not streaming */}
        {isLoading && messages.length > 0 && !messages.some(m => m.isStreaming) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-white/50"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <span className="text-sm">Thinking...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {messages.length > 0 && sessionState.status === "active" && (
        <div className="p-3 border-t border-white/10 bg-white/5">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              disabled={isLoading}
              className="min-h-[44px] max-h-[120px] resize-none bg-white/5 border-white/10 text-white placeholder:text-white/40"
              rows={1}
            />
            <VoiceInput
              onTranscript={(text) => setInputValue(text)}
              disabled={isLoading}
              className="h-[44px] w-[44px] text-white/60 hover:text-white hover:bg-white/10"
            />
            <Button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
              className="h-[44px] w-[44px] bg-primary hover:bg-primary/80"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Session Completed State */}
      {sessionState.status === "completed" && (
        <div className="p-4 border-t border-white/10 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <GraduationCap className="w-5 h-5" />
              <span className="text-sm font-medium">Session Complete!</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-white/60 hover:text-white"
            >
              Close
            </Button>
          </div>
          {sessionState.understandingScore !== null && (
            <p className="text-xs text-white/50 mt-2">
              Understanding score: {sessionState.understandingScore}%
            </p>
          )}
        </div>
      )}
    </div>
    </>
  );
}
