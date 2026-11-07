// Guided Learning Types
// Implements Google's Guided Learning (Socratic tutoring) approach

export type SessionStatus = "active" | "completed" | "abandoned";

export type MessageRole = "tutor" | "student";

export type MessageType =
  | "message"
  | "probing_question"
  | "checkpoint"
  | "hint"
  | "concept_summary"
  | "encouragement";

export type UnderstandingLevel = "strong" | "partial" | "weak";

export type DiagramType = "flowchart" | "map" | "structure" | "timeline" | "infographic";

// Media suggestion types for multimodal learning
export interface VideoSuggestion {
  title: string;
  searchQuery: string;
  reason: string;
}

export interface DiagramSuggestion {
  title: string;
  searchQuery: string;
  type: DiagramType;
}

export interface MediaResource {
  videos?: VideoSuggestion[];
  diagrams?: DiagramSuggestion[];
}

// Database row types
export interface GuidedLearningSessionRow {
  id: number;
  user_id: string;
  goal_id: number | null;
  planner_plan_id: string | null;
  subject: string | null;
  topics: string[] | null;
  exam_type: string | null;
  status: SessionStatus;
  current_concept: string | null;
  concepts_mastered: string[];
  concepts_struggling: string[];
  total_exchanges: number;
  checkpoints_passed: number;
  checkpoints_total: number;
  understanding_score: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface GuidedLearningMessageRow {
  id: number;
  session_id: number;
  role: MessageRole;
  content: string;
  message_type: MessageType;
  checkpoint_data: CheckpointData | null;
  media_data: MediaResource | null;
  student_checkpoint_response: string | null;
  checkpoint_correct: boolean | null;
  created_at: string;
}

// Checkpoint data structure
export interface CheckpointData {
  question: string;
  options: CheckpointOption[];
  correctAnswer: string;
  explanation: string;
}

export interface CheckpointOption {
  id: string;
  text: string;
}

// API Request/Response types
export interface GuidedLearningChatRequest {
  sessionId?: number;
  goalId?: number;
  plannerContext?: PlannerContext;
  message: string;
  checkpointResponse?: {
    messageId: number;
    selectedAnswer: string;
  };
}

export interface PlannerContext {
  planId: string;
  subject: string;
  topics: string[];
  examType: string;
}

export interface GuidedLearningChatResponse {
  sessionId: number;
  messages: GuidedMessage[];
  sessionState: SessionState;
}

export interface GuidedMessage {
  id: number;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  checkpointData?: CheckpointData;
  media?: MediaResource;
  createdAt: string;
}

export interface SessionState {
  status: SessionStatus;
  currentConcept: string | null;
  conceptsMastered: string[];
  conceptsStruggling: string[];
  understandingScore: number | null;
  checkpointsPassed: number;
  checkpointsTotal: number;
  totalExchanges: number;
}

// Gemini AI response structure
export interface GeminiTutorResponse {
  content: string;
  messageType: MessageType;
  checkpoint?: CheckpointData;
  media?: MediaResource;
  conceptProgress: {
    currentConcept: string;
    assessedUnderstanding: UnderstandingLevel;
    suggestCheckpoint: boolean;
  };
  sessionSuggestion: "continue" | "ready_for_checkpoint" | "consider_ending";
}

// Session result for Leitner integration
export interface SessionResult {
  sessionId: number;
  userId: string;
  goalId?: number;
  conceptsMastered: string[];
  conceptsStruggling: string[];
  understandingScore: number;
  totalExchanges: number;
  checkpointsPassed: number;
  checkpointsTotal: number;
}

// Component props
export interface GuidedLearningChatProps {
  goalId?: number;
  plannerContext?: PlannerContext;
  userId: string;
  isPro: boolean;
  existingSessionId?: number;
  onSessionComplete?: (result: SessionResult) => void;
  onClose?: () => void;
  maxHeight?: string;
  className?: string;
}

// Tutor context for prompt building
export interface TutoringContext {
  subject: string;
  topics: string[];
  examType: string;
  conversationHistory: string;
  conceptsMastered: string[];
  conceptsStruggling: string[];
  totalExchanges: number;
  checkpointsPassed: number;
  studentMessage: string;
}
