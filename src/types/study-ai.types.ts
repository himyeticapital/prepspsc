// Study with AI Module Types

import { Json } from "./database.types";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export type StudyAIUploadType = "pdf" | "image" | "youtube" | "anki";
export type StudyAIGenerationType =
  | "mindmap"
  | "summary"
  | "flashcards"
  | "quiz"
  | "infographic"
  | "slides";
export type BlurtMode = "digital" | "paper";
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

// Leitner SRS intervals (in days)
export const LEITNER_INTERVALS: Record<LeitnerBox, number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

// XP rewards for Study AI actions
export const STUDY_AI_XP = {
  MINDMAP_GENERATION: 10,
  SUMMARY_GENERATION: 5,
  FLASHCARD_GENERATION: 8,
  QUIZ_GENERATION: 10,
  INFOGRAPHIC_GENERATION: 8,
  SLIDES_GENERATION: 10,
  DAILY_VAULT_CARD: 2,
  DAILY_VAULT_COMPLETE: 50,
  BLURT_SESSION: 15,
  BLURT_90_PLUS: 25,
} as const;

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

// Study AI Goals (different from timer study_goals)
export interface StudyAIGoal {
  id: number;
  user_id: string;
  goal_text: string;
  created_at: string;
  next_revision_at: string | null;
  revision_count: number;
  last_revised_at: string | null;
  leitner_box: LeitnerBox;
  is_archived: boolean;
}

export interface StudyAIGoalInsert {
  id?: number;
  user_id: string;
  goal_text: string;
  created_at?: string;
  next_revision_at?: string | null;
  revision_count?: number;
  last_revised_at?: string | null;
  leitner_box?: LeitnerBox;
  is_archived?: boolean;
}

export interface StudyAIGoalUpdate {
  id?: number;
  user_id?: string;
  goal_text?: string;
  created_at?: string;
  next_revision_at?: string | null;
  revision_count?: number;
  last_revised_at?: string | null;
  leitner_box?: LeitnerBox;
  is_archived?: boolean;
}

// Study Uploads
export interface StudyUpload {
  id: number;
  user_id: string;
  goal_id: number;
  upload_type: StudyAIUploadType;
  file_url: string | null;
  file_name: string | null;
  extracted_text: string | null;
  metadata: Json;
  created_at: string;
}

export interface StudyUploadInsert {
  id?: number;
  user_id: string;
  goal_id: number;
  upload_type: StudyAIUploadType;
  file_url?: string | null;
  file_name?: string | null;
  extracted_text?: string | null;
  metadata?: Json;
  created_at?: string;
}

export interface StudyUploadUpdate {
  id?: number;
  user_id?: string;
  goal_id?: number;
  upload_type?: StudyAIUploadType;
  file_url?: string | null;
  file_name?: string | null;
  extracted_text?: string | null;
  metadata?: Json;
  created_at?: string;
}

// AI Generations
export interface AIGeneration {
  id: number;
  user_id: string;
  goal_id: number;
  generation_type: StudyAIGenerationType;
  output_data: Json;
  title: string | null;
  is_saved: boolean;
  created_at: string;
}

export interface AIGenerationInsert {
  id?: number;
  user_id: string;
  goal_id: number;
  generation_type: StudyAIGenerationType;
  output_data: Json;
  title?: string | null;
  is_saved?: boolean;
  created_at?: string;
}

export interface AIGenerationUpdate {
  id?: number;
  user_id?: string;
  goal_id?: number;
  generation_type?: StudyAIGenerationType;
  output_data?: Json;
  title?: string | null;
  is_saved?: boolean;
  created_at?: string;
}

// Revision Items (for individual flashcards/quiz questions)
export interface RevisionItem {
  id: number;
  user_id: string;
  generation_id: number;
  item_index: number;
  leitner_box: LeitnerBox;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  review_count: number;
  item_type: "flashcard" | "quiz_question";
  front_content: string | null;
  back_content: string | null;
  is_active: boolean;
}

export interface RevisionItemInsert {
  id?: number;
  user_id: string;
  generation_id: number;
  item_index: number;
  leitner_box?: LeitnerBox;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  review_count?: number;
  item_type: "flashcard" | "quiz_question";
  front_content?: string | null;
  back_content?: string | null;
  is_active?: boolean;
}

export interface RevisionItemUpdate {
  id?: number;
  user_id?: string;
  generation_id?: number;
  item_index?: number;
  leitner_box?: LeitnerBox;
  next_review_at?: string | null;
  last_reviewed_at?: string | null;
  review_count?: number;
  item_type?: "flashcard" | "quiz_question";
  front_content?: string | null;
  back_content?: string | null;
  is_active?: boolean;
}

// Blurt Sessions
export interface BlurtSession {
  id: number;
  user_id: string;
  goal_id: number | null;
  topic: string | null;
  mode: BlurtMode;
  user_input: string | null;
  paper_image_url: string | null;
  ai_analysis: Json | null;
  score: number | null;
  xp_earned: number;
  created_at: string;
}

export interface BlurtSessionInsert {
  id?: number;
  user_id: string;
  goal_id?: number | null;
  topic?: string | null;
  mode: BlurtMode;
  user_input?: string | null;
  paper_image_url?: string | null;
  ai_analysis?: Json | null;
  score?: number | null;
  xp_earned?: number;
  created_at?: string;
}

export interface BlurtSessionUpdate {
  id?: number;
  user_id?: string;
  goal_id?: number | null;
  topic?: string | null;
  mode?: BlurtMode;
  user_input?: string | null;
  paper_image_url?: string | null;
  ai_analysis?: Json | null;
  score?: number | null;
  xp_earned?: number;
  created_at?: string;
}

// =============================================================================
// GENERATION OUTPUT TYPES
// =============================================================================

// Mind Map Node
export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
}

export interface MindMapOutput {
  title: string;
  markdown: string; // Markmap-compatible markdown
  rootNode: MindMapNode;
}

// Summary Output
export interface SummaryOutput {
  title: string;
  keyPoints: string[];
  keyDates?: { date: string; event: string }[];
  mainIdeas?: string[]; // Legacy support
  keyConcepts?: { concept: string; explanation: string }[]; // New enhanced format
  examFacts?: string[]; // Important facts for competitive exams
  conclusion?: string;
}

// Flashcard
export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardsOutput {
  title: string;
  cards: Flashcard[];
}

// Quiz Question
export interface QuizQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

export interface QuizOutput {
  title: string;
  questions: QuizQuestion[];
}

// Infographic Data
export interface InfographicChart {
  type: "bar" | "pie" | "line" | "doughnut";
  title: string;
  labels: string[];
  data: number[];
  colors?: string[];
  description?: string; // Enhanced: explanation of what the chart shows
}

export interface InfographicOutput {
  title: string;
  subtitle?: string; // Enhanced: brief topic description
  charts: InfographicChart[];
  keyFacts: { label: string; value: string; icon?: string }[];
  timeline?: { date: string; event: string; importance?: "high" | "medium" | "low" }[];
  highlights?: string[]; // Enhanced: key takeaways
}

// Animated Slides
export interface AnimatedSlide {
  id: string;
  title: string;
  layout: "title" | "bullets" | "two-column" | "highlight" | "comparison" | "timeline" | "closing";
  bullets?: string[];
  leftColumn?: { heading: string; items: string[] };
  rightColumn?: { heading: string; items: string[] };
  highlightText?: string;
  highlightSubtext?: string;
  timelineItems?: { label: string; description: string }[];
  speakerNotes?: string;
  emoji?: string;
  transition?: "fade" | "slideLeft" | "slideUp" | "zoom" | "flip";
}

export interface SlidesOutput {
  title: string;
  themeColor?: string;
  slides: AnimatedSlide[];
}

// Union type for all generation outputs
export type GenerationOutput =
  | MindMapOutput
  | SummaryOutput
  | FlashcardsOutput
  | QuizOutput
  | InfographicOutput
  | SlidesOutput;

// =============================================================================
// BLURT ANALYSIS TYPES
// =============================================================================

export interface BlurtAnalysis {
  score: number; // 0-100
  matchedPoints: string[];
  missedConcepts: string[];
  corrections: { original: string; corrected: string }[];
  feedback: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface GenerateRequest {
  goalId: number;
  generationType: StudyAIGenerationType;
  sourceContent: string;
}

export interface GenerateResponse {
  success: boolean;
  generation?: AIGeneration;
  error?: string;
  code?: "DAILY_LIMIT" | "PRO_REQUIRED" | "INVALID_INPUT";
  upgradeUrl?: string;
}

export interface BlurtAnalyzeRequest {
  goalId: number;
  userInput: string;
  mode: BlurtMode;
  paperImageUrl?: string;
}

export interface BlurtAnalyzeResponse {
  success: boolean;
  analysis?: BlurtAnalysis;
  xpEarned?: number;
  error?: string;
}

// =============================================================================
// DASHBOARD STATS TYPES
// =============================================================================

export interface StudyAIStats {
  totalStudyGoals: number;
  materialsGenerated: number;
  itemsSaved: number;
  revisionStreak: number;
  dueForReview: number;
  lastActivityAt: string | null;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface StudyAINotification {
  id: number;
  user_id: string;
  goal_id: number;
  type: "revision_due";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface GoalWithMaterials extends StudyAIGoal {
  uploads: StudyUpload[];
  generations: AIGeneration[];
}

export interface RevisionRating {
  rating: "easy" | "hard" | "again";
}
