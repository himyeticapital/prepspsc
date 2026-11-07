// Supabase Edge Function: Conversational AI Mock Test Generator
// Users chat naturally to describe an exam, the AI identifies the pattern,
// then generates a mock test from PYQs (SPSC) or AI-generated questions (other exams).
// Streams NDJSON events for real-time frontend updates.
//
// Deploy: npx supabase functions deploy mock-test-chat --project-ref <your-project-ref>

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite"; // cheap default (see src/lib/ai-models.ts)
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const HARDCODED_EXAM_NAMES = ["SPSC"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaperSection {
  subject: string;
  query: string;
  count: number;
}

interface ExamPattern {
  name: string;
  description: string;
  total_questions: number;
  duration_minutes: number;
  negative_marking: boolean;
  negative_mark_value: number;
  marks_per_question: number;
  sections: PaperSection[];
}

interface MockTestChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  action?: "generate";
  confirmedPattern?: ExamPattern;
  patternSource?: "spsc" | "ai";
  patternId?: string;
}

// NDJSON event types
type StreamEvent =
  | { type: "text"; content: string }
  | { type: "exam_pattern"; pattern: ExamPattern; source: "spsc" | "ai"; patternId?: string }
  | { type: "generating"; progress: string }
  | { type: "test_ready"; testId: string; totalQuestions: number; generationTimeMs: number }
  | { type: "done" }
  | { type: "error"; error: string };

// ---------------------------------------------------------------------------
// EXAM_PATTERNS (all 64 SPSC patterns, copied from mock-test/index.ts)
// ---------------------------------------------------------------------------

const EXAM_PATTERNS: Record<string, ExamPattern> = {
  "undersecretary-prelims": {
    name: "Under Secretary Preliminary Examination",
    description:
      "SPSC Under Secretary Prelims — General Studies paper covering polity, history, geography, science, current affairs, and Sikkim-specific topics.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "constitution governance fundamental rights directive principles", count: 15 },
      { subject: "History", query: "Indian history freedom movement ancient medieval modern Sikkim", count: 15 },
      { subject: "Geography", query: "Indian geography rivers mountains climate Sikkim", count: 12 },
      { subject: "General Knowledge", query: "current affairs India Sikkim government schemes awards", count: 20 },
      { subject: "Science", query: "general science physics chemistry biology", count: 12 },
      { subject: "Indian Economy", query: "Indian economy planning budget GDP fiscal policy", count: 8 },
      { subject: "Environment", query: "environment ecology biodiversity conservation Sikkim", count: 8 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
    ],
  },
  "si-police-prelims": {
    name: "Sub Inspector of Police Preliminary Examination",
    description:
      "SPSC SI Police Prelims — General Studies + basic aptitude covering polity, law, current affairs, and reasoning.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "constitution law criminal procedure IPC evidence act", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim police administration", count: 25 },
      { subject: "History", query: "Indian history Sikkim history freedom movement", count: 15 },
      { subject: "Geography", query: "Indian geography Sikkim geography physical features", count: 10 },
      { subject: "Science", query: "general science forensic science technology", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "arithmetic reasoning logic number series", count: 10 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
    ],
  },
  "general-prelims": {
    name: "General Preliminary Examination",
    description:
      "SPSC General Prelims — broad general studies paper for various SPSC posts.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "constitution governance rights duties", count: 12 },
      { subject: "History", query: "Indian history Sikkim history culture", count: 12 },
      { subject: "Geography", query: "geography India Sikkim rivers mountains", count: 10 },
      { subject: "General Knowledge", query: "current affairs general awareness", count: 16 },
      { subject: "Science", query: "general science physics chemistry biology", count: 10 },
      { subject: "Indian Economy", query: "economy planning budget financial institutions", count: 8 },
      { subject: "General English", query: "English grammar comprehension vocabulary", count: 12 },
    ],
  },
  "spsc-mains-gs1": {
    name: "SPSC Mains General Studies Paper 1",
    description:
      "SPSC Mains GS Paper 1 — Indian Polity, History, Geography, and Sikkim-specific topics.",
    total_questions: 150,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "constitution governance panchayati raj public policy fundamental rights directive principles", count: 35 },
      { subject: "History", query: "Indian history world history Sikkim history art and culture ancient medieval modern freedom movement", count: 30 },
      { subject: "Geography", query: "Indian geography world geography Sikkim geography climate change physical features rivers mountains", count: 30 },
      { subject: "General Knowledge", query: "current affairs awards international organizations United Nations summits", count: 25 },
      { subject: "Environment", query: "ecology biodiversity environmental law climate change conservation wildlife Sikkim", count: 15 },
      { subject: "Indian Economy", query: "economic development five year planning financial institutions RBI banking fiscal monetary policy", count: 15 },
    ],
  },
  "spsc-mains-gs2": {
    name: "SPSC Mains General Studies Paper 2",
    description:
      "SPSC Mains GS Paper 2 — Science, Technology, Economy, and Quantitative Aptitude.",
    total_questions: 150,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "physics chemistry biology applied science technology inventions discoveries", count: 35 },
      { subject: "Indian Economy", query: "macroeconomics fiscal policy banking trade GDP budget monetary policy inflation", count: 30 },
      { subject: "General Knowledge", query: "science and technology current affairs space ISRO defense developments digital India", count: 25 },
      { subject: "Environment", query: "environmental science pollution conservation sustainable development waste management climate", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "quantitative aptitude data interpretation number series reasoning logical ability", count: 25 },
      { subject: "General English", query: "English grammar reading comprehension vocabulary synonyms antonyms sentence correction", count: 15 },
    ],
  },
  "junior-engineer-prelims": {
    name: "Junior Engineer Preliminary Examination",
    description:
      "SPSC Junior Engineer Prelims — General Studies component for engineering posts.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "physics mechanics thermodynamics electronics engineering basics", count: 25 },
      { subject: "Indian Polity", query: "constitution governance fundamental rights duties amendments", count: 15 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim government schemes", count: 20 },
      { subject: "Geography", query: "Indian geography Sikkim geography rivers mountains natural resources", count: 10 },
      { subject: "Indian Economy", query: "economy basics economic development infrastructure planning budget", count: 10 },
      { subject: "General English", query: "English grammar vocabulary sentence formation comprehension", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics arithmetic reasoning number series data interpretation", count: 10 },
    ],
  },
  "forest-ranger-prelims": {
    name: "Forest Ranger Preliminary Examination",
    description:
      "SPSC Forest Ranger Prelims — Environment-heavy general studies paper.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Environment", query: "ecology biodiversity forestry wildlife national parks sanctuaries conservation forest management", count: 25 },
      { subject: "Science", query: "biology botany zoology plant science animal science taxonomy genetics", count: 20 },
      { subject: "General Knowledge", query: "current affairs environmental schemes government policies wildlife protection act", count: 15 },
      { subject: "Geography", query: "physical geography Sikkim geography rivers mountains soil types rainfall climate zones", count: 15 },
      { subject: "Indian Polity", query: "environmental law constitutional provisions forest rights act wildlife protection", count: 10 },
      { subject: "History", query: "Sikkim history forest history environmental movements chipko movement", count: 5 },
      { subject: "General English", query: "English grammar vocabulary reading comprehension sentence correction", count: 10 },
    ],
  },
  "quick-practice-30": {
    name: "Quick 30-Question Practice Test",
    description:
      "Quick 30-question practice test — broad general studies for a quick revision session.",
    total_questions: 30,
    duration_minutes: 30,
    negative_marking: false,
    negative_mark_value: 0,
    marks_per_question: 1,
    sections: [
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim recent events", count: 8 },
      { subject: "Indian Polity", query: "constitution basics fundamental rights governance parliament", count: 5 },
      { subject: "History", query: "Indian history Sikkim history important dates events", count: 5 },
      { subject: "Geography", query: "basic geography India rivers mountains states capitals", count: 4 },
      { subject: "Science", query: "general science everyday science physics chemistry biology", count: 4 },
      { subject: "General English", query: "English grammar vocabulary common usage idioms", count: 4 },
    ],
  },
  "combined-mains-gs3": {
    name: "Combined Mains General Studies Paper 3",
    description: "SPSC Combined Mains GS Paper 3 — Economy, Science & Technology, Environment, and Ethics.",
    total_questions: 150,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Economy", query: "economic development planning fiscal monetary policy trade GDP budget infrastructure", count: 30 },
      { subject: "Science", query: "science technology inventions discoveries space ISRO biotechnology IT digital", count: 30 },
      { subject: "Environment", query: "ecology biodiversity conservation climate change pollution sustainable development", count: 25 },
      { subject: "Indian Polity", query: "governance ethics public administration integrity accountability transparency", count: 25 },
      { subject: "General Knowledge", query: "current affairs international relations bilateral India foreign policy", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "data interpretation statistics reasoning logical analysis", count: 20 },
    ],
  },
  "combined-mains-english": {
    name: "Combined Mains English Paper",
    description: "SPSC Combined Mains Paper I — English language, comprehension, grammar, and essay writing.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar sentence correction error spotting articles prepositions tenses", count: 30 },
      { subject: "General English", query: "reading comprehension passage understanding inference vocabulary context", count: 25 },
      { subject: "General English", query: "vocabulary synonyms antonyms idioms phrases one word substitution", count: 20 },
      { subject: "General English", query: "English essay precis letter writing paragraph formal informal", count: 15 },
      { subject: "General English", query: "fill in the blanks cloze test sentence completion rearrangement", count: 10 },
    ],
  },
  "sscs-prelims": {
    name: "Sikkim State Civil Service Preliminary Examination",
    description: "SPSC SSCS Prelims — Comprehensive general studies for Sikkim civil services.",
    total_questions: 200,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General Knowledge", query: "current affairs India Sikkim international events government schemes awards", count: 35 },
      { subject: "Indian Polity", query: "constitution governance fundamental rights Parliament judiciary local government", count: 30 },
      { subject: "History", query: "Indian history ancient medieval modern Sikkim history world history freedom movement", count: 25 },
      { subject: "Geography", query: "Indian geography world geography Sikkim geography rivers mountains climate", count: 25 },
      { subject: "General English", query: "English grammar comprehension vocabulary sentence correction", count: 25 },
      { subject: "Science", query: "general science physics chemistry biology technology inventions", count: 20 },
      { subject: "Indian Economy", query: "Indian economy planning budget GDP fiscal monetary policy banking", count: 20 },
      { subject: "Environment", query: "ecology biodiversity environment conservation Sikkim", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "aptitude reasoning data interpretation number series", count: 10 },
    ],
  },
  "si-police-mains": {
    name: "Sub Inspector Police Mains Examination",
    description: "SPSC SI Police Mains — English + 2 General Studies papers covering law, polity, and current affairs.",
    total_questions: 150,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "constitution criminal law IPC CrPC evidence act police administration law enforcement", count: 30 },
      { subject: "General Knowledge", query: "current affairs India Sikkim national international events awards", count: 25 },
      { subject: "General English", query: "English grammar comprehension vocabulary essay writing", count: 25 },
      { subject: "History", query: "Indian history modern India freedom movement Sikkim history world history", count: 20 },
      { subject: "Geography", query: "Indian geography Sikkim geography physical features climate rivers", count: 15 },
      { subject: "Science", query: "forensic science general science technology cyber crime investigation", count: 15 },
      { subject: "Indian Economy", query: "economy development planning government schemes welfare programs", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "reasoning aptitude mental ability logical deduction", count: 10 },
    ],
  },
  "si-excise": {
    name: "Sub Inspector Excise Examination",
    description: "SPSC SI Excise — English, GK, Science, Mathematics, and Social Science.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary comprehension sentence correction", count: 20 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim", count: 20 },
      { subject: "Science", query: "physics chemistry biology general science", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics arithmetic algebra geometry mensuration", count: 20 },
      { subject: "History", query: "Indian history Sikkim history social science civics", count: 10 },
      { subject: "Geography", query: "Indian geography Sikkim geography social studies", count: 10 },
    ],
  },
  "sub-jailer": {
    name: "Sub Jailer Examination",
    description: "SPSC Sub Jailer — General studies covering GK, polity, history, and social sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim prison administration", count: 25 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 20 },
      { subject: "Indian Polity", query: "constitution governance criminal justice system prison law", count: 15 },
      { subject: "History", query: "Indian history Sikkim history world history social reform movements", count: 15 },
      { subject: "Geography", query: "Indian geography Sikkim geography physical features", count: 10 },
      { subject: "Science", query: "general science biology psychology basic science", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "arithmetic reasoning mental ability logical deduction", count: 5 },
    ],
  },
  "sub-fire-officer": {
    name: "Sub Fire Officer Examination",
    description: "SPSC Sub Fire Officer — Science-heavy exam covering GK, Mathematics, Physics, Chemistry, Biology, and English.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "physics mechanics thermodynamics heat transfer fire science combustion", count: 25 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics arithmetic geometry mensuration trigonometry", count: 20 },
      { subject: "Science", query: "chemistry chemical reactions fire extinguishing agents elements compounds", count: 15 },
      { subject: "General Knowledge", query: "current affairs fire safety disaster management emergency services", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "biology human anatomy first aid emergency response physiology", count: 10 },
    ],
  },
  "assistant-engineer-civil": {
    name: "Assistant Engineer (Civil) Examination",
    description: "SPSC AE Civil — General English & GK + Civil Engineering fundamentals.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "civil engineering structures construction materials concrete steel strength RCC", count: 25 },
      { subject: "General Knowledge", query: "current affairs India Sikkim infrastructure development government schemes", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "engineering mathematics calculus mechanics structural analysis", count: 15 },
      { subject: "Geography", query: "surveying geotechnical soil mechanics geology terrain mapping", count: 10 },
      { subject: "Environment", query: "environmental engineering water supply sanitation waste management pollution", count: 10 },
      { subject: "Indian Polity", query: "building codes regulations construction law public works", count: 5 },
    ],
  },
  "assistant-engineer-electrical": {
    name: "Assistant Engineer (Electrical) Examination",
    description: "SPSC AE Electrical — General English & GK + Electrical Engineering fundamentals.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "electrical engineering circuits power systems transformers motors generators", count: 30 },
      { subject: "General Knowledge", query: "current affairs India Sikkim power sector energy infrastructure", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "engineering mathematics electrical circuits analysis network theory", count: 15 },
      { subject: "Science", query: "electronics digital systems control systems instrumentation", count: 10 },
      { subject: "Indian Economy", query: "power sector policy energy economy electricity infrastructure", count: 5 },
      { subject: "Indian Polity", query: "electricity act regulations power sector governance", count: 5 },
    ],
  },
  "assistant-engineer-mechanical": {
    name: "Assistant Engineer (Mechanical) Examination",
    description: "SPSC AE Mechanical — General English & GK + Mechanical Engineering fundamentals.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "mechanical engineering thermodynamics fluid mechanics manufacturing machines", count: 30 },
      { subject: "General Knowledge", query: "current affairs India Sikkim industrial development manufacturing", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "engineering mathematics mechanics dynamics kinematics", count: 15 },
      { subject: "Science", query: "material science metallurgy heat treatment production technology", count: 10 },
      { subject: "Indian Economy", query: "industrial policy manufacturing sector economy development", count: 5 },
      { subject: "Indian Polity", query: "industrial regulations safety standards factory act", count: 5 },
    ],
  },
  "assistant-engineer-agriculture": {
    name: "Assistant Engineer (Agriculture) Examination",
    description: "SPSC AE Agriculture — General English & GK + Agricultural engineering and sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "agriculture engineering irrigation farm machinery soil conservation crop science", count: 25 },
      { subject: "General Knowledge", query: "current affairs agriculture schemes Sikkim organic farming India rural development", count: 20 },
      { subject: "Environment", query: "agriculture ecology organic farming sustainable agriculture soil science", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "botany plant science horticulture crop production seed technology", count: 10 },
      { subject: "Indian Economy", query: "agricultural economy rural development cooperatives farming", count: 10 },
      { subject: "Geography", query: "soil types climate agriculture regions irrigation systems", count: 5 },
    ],
  },
  "gdmo": {
    name: "General Duty Medical Officer Examination",
    description: "SPSC GDMO — General Ability, Preventive & Social Medicine, General Medicine, Pediatrics, Surgery, Gynecology.",
    total_questions: 150,
    duration_minutes: 180,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "general medicine internal medicine diagnosis clinical pharmacology therapeutics", count: 30 },
      { subject: "Science", query: "surgery surgical procedures surgical anatomy operative techniques", count: 25 },
      { subject: "Science", query: "preventive social community medicine public health epidemiology biostatistics", count: 25 },
      { subject: "Science", query: "pediatrics child health neonatology growth development immunization", count: 20 },
      { subject: "Science", query: "gynecology obstetrics maternal health reproductive medicine", count: 20 },
      { subject: "General Knowledge", query: "health schemes national health policy medical ethics public health programs", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension medical terminology", count: 15 },
    ],
  },
  "veterinary-officer": {
    name: "Veterinary Officer Examination",
    description: "SPSC Veterinary Officer — General English & GK + Veterinary Science and Animal Husbandry.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "veterinary science animal husbandry livestock diseases pathology anatomy", count: 30 },
      { subject: "Science", query: "animal nutrition breeding genetics dairy science poultry farming", count: 20 },
      { subject: "General Knowledge", query: "current affairs animal husbandry schemes Sikkim livestock India", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Environment", query: "animal ecology wildlife conservation biodiversity zoonotic diseases", count: 10 },
      { subject: "Indian Economy", query: "dairy industry livestock economy rural development", count: 5 },
      { subject: "Indian Polity", query: "animal welfare act veterinary regulations food safety", count: 5 },
    ],
  },
  "dental-surgeon": {
    name: "Dental Surgeon (Junior Grade) Examination",
    description: "SPSC Dental Surgeon Jr Grade — General English & GK + Dental Sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "dental surgery oral medicine dental anatomy pathology orthodontics", count: 35 },
      { subject: "Science", query: "general anatomy physiology pharmacology biochemistry microbiology", count: 20 },
      { subject: "General Knowledge", query: "current affairs health policy dental education India", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "preventive dentistry public health community dentistry", count: 10 },
      { subject: "Indian Polity", query: "medical regulations health policy dental council", count: 5 },
    ],
  },
  "specialist-sr-grade": {
    name: "Specialist (Senior Grade) Medical Examination",
    description: "SPSC Specialist Sr Grade — Medical specializations: Anaesthesia, ENT, Surgery, Gynecology, Microbiology, Ophthalmology.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "medical specialization surgery anaesthesia clinical medicine advanced pathology", count: 35 },
      { subject: "Science", query: "general medicine diagnosis clinical pharmacology evidence-based medicine", count: 20 },
      { subject: "Science", query: "anatomy physiology biochemistry microbiology immunology", count: 15 },
      { subject: "General Knowledge", query: "medical ethics health policy national health programs", count: 10 },
      { subject: "General English", query: "English grammar comprehension medical communication", count: 10 },
      { subject: "Science", query: "preventive community medicine public health research methodology", count: 10 },
    ],
  },
  "staff-nurse": {
    name: "Staff Nurse (GNM) Examination",
    description: "SPSC Staff Nurse GNM — General English & GK + Nursing Sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "nursing medical surgical community health pediatric obstetric nursing", count: 30 },
      { subject: "Science", query: "anatomy physiology pharmacology microbiology nutrition biochemistry", count: 20 },
      { subject: "General Knowledge", query: "current affairs health schemes national health mission India Sikkim", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "community health nursing public health maternal child health", count: 10 },
      { subject: "Science", query: "mental health psychiatric nursing psychology first aid", count: 5 },
      { subject: "Indian Polity", query: "nursing council regulations health education policy", count: 5 },
    ],
  },
  "paramedical": {
    name: "Paramedical Various Posts Examination",
    description: "SPSC Paramedical — General English & GK + basic medical sciences for various paramedical posts.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "medical science anatomy physiology pathology basic clinical knowledge", count: 25 },
      { subject: "Science", query: "pharmacology biochemistry microbiology laboratory techniques diagnostics", count: 20 },
      { subject: "General Knowledge", query: "current affairs health programs India Sikkim medical schemes", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "community health hygiene sanitation nutrition public health", count: 10 },
      { subject: "Environment", query: "environmental health water sanitation waste management infection control", count: 10 },
      { subject: "Indian Polity", query: "health policy regulations medical council ethics", count: 5 },
    ],
  },
  "health-educator": {
    name: "Health Educator Examination",
    description: "SPSC Health Educator — GK-focused exam with health education and public health emphasis.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General Knowledge", query: "current affairs health education public health India Sikkim health programs", count: 20 },
      { subject: "Science", query: "community health hygiene nutrition disease prevention health education", count: 20 },
      { subject: "Environment", query: "environmental health sanitation water safety waste disposal pollution", count: 10 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Science", query: "anatomy physiology basic medical science first aid", count: 10 },
      { subject: "Indian Polity", query: "health policy national health mission NRHM regulations", count: 5 },
      { subject: "Indian Economy", query: "health expenditure government health schemes budgets", count: 5 },
    ],
  },
  "mphw": {
    name: "Multi Purpose Health Worker (Male/Female) Examination",
    description: "SPSC MPHW — General English & GK + Community Health Sciences.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "community health primary healthcare disease prevention immunization maternal child health", count: 25 },
      { subject: "General Knowledge", query: "current affairs health programs India Sikkim NRHM NHM", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "anatomy physiology nutrition hygiene first aid emergency care", count: 10 },
      { subject: "Environment", query: "environmental health sanitation safe drinking water vector control", count: 10 },
      { subject: "Indian Polity", query: "health regulations family welfare population policy", count: 5 },
    ],
  },
  "drug-inspector": {
    name: "Drug Inspector Examination",
    description: "SPSC Drug Inspector — General English & GK + Pharmaceutical Sciences and Drug Regulation.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "pharmacy pharmacology drug chemistry pharmaceutical analysis formulations", count: 30 },
      { subject: "Science", query: "pharmacognosy biochemistry microbiology quality control drug testing", count: 20 },
      { subject: "General Knowledge", query: "current affairs drug regulation India pharmaceutical industry", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Indian Polity", query: "drugs cosmetics act drug regulation CDSCO pharmaceutical law", count: 10 },
      { subject: "Science", query: "clinical pharmacology toxicology adverse drug reactions drug safety", count: 10 },
    ],
  },
  "food-safety-officer": {
    name: "Food Safety Officer Examination",
    description: "SPSC Food Safety Officer — General English & GK + Food Science, Hygiene, and Safety Regulations.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "food science food chemistry nutrition food processing food technology", count: 25 },
      { subject: "Science", query: "food microbiology hygiene food safety HACCP quality assurance", count: 20 },
      { subject: "General Knowledge", query: "current affairs food safety India FSSAI regulations standards", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Indian Polity", query: "food safety standards act FSSAI regulations food adulteration law", count: 10 },
      { subject: "Environment", query: "food contamination pesticides environmental toxicology water quality", count: 10 },
      { subject: "Science", query: "biochemistry chemistry analytical methods food testing", count: 5 },
    ],
  },
  "pharmacist-ayush": {
    name: "Pharmacist AYUSH (Ayurveda/Homeopathy) Examination",
    description: "SPSC Pharmacist AYUSH — General English & GK + Traditional Medicine & Pharmacy.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "ayurveda homeopathy traditional medicine herbal pharmacology medicinal plants", count: 30 },
      { subject: "Science", query: "pharmacy pharmacognosy drug preparation formulation dispensing", count: 20 },
      { subject: "General Knowledge", query: "current affairs AYUSH ministry traditional medicine India Sikkim health", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "anatomy physiology pathology basic medical science", count: 10 },
      { subject: "Indian Polity", query: "AYUSH policy drug regulation traditional medicine legislation", count: 5 },
      { subject: "Environment", query: "medicinal plants biodiversity herbal resources conservation", count: 5 },
    ],
  },
  "yoga-instructor-ayush": {
    name: "Yoga Instructor (AYUSH) Examination",
    description: "SPSC Yoga Instructor AYUSH — General English & GK + Yoga, Philosophy, and Wellness Sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "yoga therapy anatomy physiology pranayama asana meditation wellness", count: 30 },
      { subject: "History", query: "yoga philosophy Indian philosophy Patanjali yoga sutras Ayurveda tradition", count: 20 },
      { subject: "General Knowledge", query: "current affairs yoga international day India AYUSH ministry health", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "human anatomy physiology nutrition health fitness sports science", count: 10 },
      { subject: "Indian Polity", query: "AYUSH policy health education physical education regulations", count: 5 },
      { subject: "Environment", query: "naturopathy wellness holistic health mindfulness", count: 5 },
    ],
  },
  "scientific-officer-ayush": {
    name: "Scientific Officer (AYUSH) Examination",
    description: "SPSC Scientific Officer AYUSH — Scientific research in traditional medicine systems.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "ayurveda research methodology scientific analysis traditional medicine pharmacology", count: 30 },
      { subject: "Science", query: "chemistry biochemistry phytochemistry analytical methods drug testing quality control", count: 20 },
      { subject: "General Knowledge", query: "current affairs AYUSH ministry traditional medicine India research", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension scientific writing", count: 15 },
      { subject: "Science", query: "pharmacognosy herbal drugs medicinal plants botany", count: 10 },
      { subject: "Indian Polity", query: "AYUSH regulations drug policy traditional medicine legislation", count: 5 },
      { subject: "Environment", query: "medicinal plants conservation biodiversity herbal resources", count: 5 },
    ],
  },
  "tutor-clinical-instructor": {
    name: "Tutor / Clinical Instructor Examination",
    description: "SPSC Tutor/Clinical Instructor — Nursing Education and Clinical Training.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "nursing education clinical training medical surgical community health obstetric pediatric", count: 30 },
      { subject: "Science", query: "anatomy physiology pharmacology pathology microbiology", count: 20 },
      { subject: "Science", query: "teaching methodology clinical education student assessment curriculum development", count: 15 },
      { subject: "General Knowledge", query: "current affairs health programs nursing education India Sikkim", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Indian Polity", query: "nursing council regulations health education policy", count: 5 },
      { subject: "Science", query: "mental health community nursing research methodology evidence based practice", count: 5 },
    ],
  },
  "ldc-prelims": {
    name: "Lower Division Clerk (LDC) Examination",
    description: "SPSC LDC — Popular entry-level exam covering General English, GK, and basic aptitude.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary comprehension sentence correction fill blanks", count: 25 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim government", count: 25 },
      { subject: "Arithmetic and Logical Reasoning", query: "arithmetic reasoning mental ability number series percentage", count: 20 },
      { subject: "Indian Polity", query: "constitution governance fundamental rights duties parliament", count: 10 },
      { subject: "History", query: "Indian history Sikkim history important events dates", count: 10 },
      { subject: "Geography", query: "India geography Sikkim geography rivers mountains states capitals", count: 10 },
    ],
  },
  "accounts-clerk": {
    name: "Accounts Clerk / Junior Store Keeper Examination",
    description: "SPSC Accounts Clerk — English, GK, Arithmetic, and basic Commerce & Accounting.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Arithmetic and Logical Reasoning", query: "arithmetic accounting calculation percentage profit loss interest", count: 25 },
      { subject: "General English", query: "English grammar vocabulary comprehension letter writing", count: 20 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim commerce trade", count: 20 },
      { subject: "Indian Economy", query: "accounting basics commerce trade business finance banking", count: 15 },
      { subject: "Indian Polity", query: "governance administration financial management government", count: 10 },
      { subject: "Science", query: "computer basics office technology digital literacy", count: 10 },
    ],
  },
  "stenographer": {
    name: "Stenographer Grade III Examination",
    description: "SPSC Stenographer — English-heavy exam with General English and General Awareness.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary comprehension sentence correction synonyms antonyms", count: 40 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim government schemes", count: 25 },
      { subject: "Indian Polity", query: "constitution governance administration parliament judiciary", count: 5 },
      { subject: "History", query: "Indian history Sikkim history important events", count: 5 },
      { subject: "Geography", query: "India geography states capitals Sikkim", count: 5 },
    ],
  },
  "cooperative-inspector": {
    name: "Cooperative Inspector / Auditor Examination",
    description: "SPSC Cooperative Inspector — General English & GK + Commerce, Economics, and Cooperation.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Economy", query: "cooperative movement cooperatives banking credit societies economics commerce", count: 25 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim cooperative sector government schemes", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "accounting arithmetic profit loss interest percentage calculation", count: 15 },
      { subject: "Indian Polity", query: "cooperative laws governance administration regulation", count: 10 },
      { subject: "History", query: "cooperative movement history India Sikkim social reform", count: 5 },
      { subject: "Geography", query: "India geography Sikkim geography rural development", count: 5 },
    ],
  },
  "statistical-inspector": {
    name: "Statistical Inspector Examination",
    description: "SPSC Statistical Inspector — General English & GK + Economics, Mathematics, and Statistics.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Arithmetic and Logical Reasoning", query: "statistics probability data analysis sampling regression statistical methods", count: 25 },
      { subject: "Indian Economy", query: "economics macroeconomics microeconomics national income GDP economic indicators", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics algebra calculus number theory quantitative aptitude", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs India economic data census surveys", count: 15 },
      { subject: "Indian Polity", query: "statistical organizations census bureau planning commission", count: 5 },
      { subject: "Science", query: "computer applications data processing information technology", count: 5 },
    ],
  },
  "revenue-inspector": {
    name: "Revenue Inspector Examination",
    description: "SPSC Revenue Inspector — General English & GK + Land Revenue, Administration, and Law.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Polity", query: "land revenue administration governance property law registration", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim government schemes revenue administration", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 20 },
      { subject: "Geography", query: "land survey geography Sikkim geography terrain mapping cadastral", count: 15 },
      { subject: "Indian Economy", query: "taxation revenue fiscal policy land economics property valuation", count: 10 },
      { subject: "History", query: "Indian history Sikkim history land reforms agrarian history", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "arithmetic calculation measurement area revenue computation", count: 5 },
    ],
  },
  "revenue-surveyor": {
    name: "Revenue Surveyor / Assistant Revenue Surveyor Examination",
    description: "SPSC Revenue Surveyor — General English & GK + Land Survey, Revenue Administration.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Geography", query: "land survey mapping cadastral survey revenue land records topography", count: 25 },
      { subject: "Arithmetic and Logical Reasoning", query: "measurement calculation area perimeter trigonometry surveying mathematics", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs India Sikkim land revenue administration", count: 15 },
      { subject: "Indian Polity", query: "land laws revenue administration property registration governance", count: 10 },
      { subject: "Science", query: "surveying instruments GPS GIS technology remote sensing", count: 10 },
      { subject: "Indian Economy", query: "land economy property valuation revenue collection", count: 5 },
    ],
  },
  "commercial-tax-inspector": {
    name: "Commercial Tax Inspector Examination",
    description: "SPSC Commercial Tax Inspector — General English & GK + Commerce, Accountancy, and Mathematics.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Indian Economy", query: "taxation GST commercial tax trade commerce accountancy business", count: 25 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics arithmetic accounting calculation profit loss", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs India Sikkim tax policy commercial law", count: 15 },
      { subject: "Indian Polity", query: "tax law GST regulations commercial law governance", count: 15 },
      { subject: "History", query: "Indian history trade commerce economic history", count: 5 },
      { subject: "Geography", query: "India geography economic geography trade routes", count: 5 },
    ],
  },
  "fisheries-officer": {
    name: "Block Officer (Fisheries) Examination",
    description: "SPSC Block Officer Fisheries — General English & GK + Fisheries and Aquatic Sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "fisheries aquaculture fish biology ichthyology aquatic ecology fish farming", count: 30 },
      { subject: "Environment", query: "aquatic ecosystem water quality freshwater marine biodiversity conservation", count: 15 },
      { subject: "General Knowledge", query: "current affairs fisheries schemes India Sikkim blue revolution", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "zoology biology genetics nutrition feed management", count: 10 },
      { subject: "Indian Economy", query: "fisheries economy aquaculture development rural livelihood", count: 10 },
      { subject: "Indian Polity", query: "fisheries policy regulations marine law aquaculture act", count: 5 },
    ],
  },
  "assistant-director-fisheries": {
    name: "Assistant Director (Fisheries) Examination",
    description: "SPSC AD Fisheries — Advanced Fisheries Science, Aquaculture Management, and Administration.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "fisheries science aquaculture management fish biology limnology marine biology", count: 30 },
      { subject: "Science", query: "fish genetics breeding hatchery technology fish nutrition disease management", count: 20 },
      { subject: "General Knowledge", query: "current affairs fisheries policy blue revolution India Sikkim aquaculture", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Environment", query: "aquatic ecosystem conservation water resources biodiversity fisheries management", count: 10 },
      { subject: "Indian Economy", query: "fisheries economy exports international trade aquaculture industry", count: 10 },
      { subject: "Indian Polity", query: "fisheries regulations marine policy aquaculture guidelines administration", count: 5 },
    ],
  },
  "livestock-assistant": {
    name: "Stockman / Livestock Assistant Examination",
    description: "SPSC Livestock Assistant — General English & GK + Animal Husbandry and Livestock Sciences.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "animal husbandry livestock management cattle dairy poultry sheep goat", count: 30 },
      { subject: "Science", query: "animal diseases veterinary first aid vaccination deworming breeding", count: 20 },
      { subject: "General Knowledge", query: "current affairs animal husbandry schemes India Sikkim livestock", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Science", query: "nutrition feed management fodder crops animal genetics", count: 10 },
      { subject: "Indian Economy", query: "dairy industry livestock economy cooperatives milk production", count: 5 },
      { subject: "Environment", query: "pasture management grazing land animal ecology", count: 5 },
    ],
  },
  "lecturer-diet": {
    name: "Lecturer DIETs Examination",
    description: "SPSC Lecturer DIETs — General paper + Education, Psychology, and Teaching Methodology.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "education psychology pedagogy teaching methodology learning theories curriculum", count: 25 },
      { subject: "General Knowledge", query: "current affairs education policy NEP India Sikkim teaching profession", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension essay writing", count: 20 },
      { subject: "Indian Polity", query: "education policy right to education constitutional provisions NEP governance", count: 10 },
      { subject: "History", query: "history of education Indian education system reform movements", count: 10 },
      { subject: "Science", query: "child development educational psychology assessment evaluation", count: 10 },
      { subject: "Geography", query: "social science geography teaching social studies", count: 5 },
    ],
  },
  "iti-instructor": {
    name: "ITI Instructor Examination",
    description: "SPSC ITI Instructor — General English & GK + Technical trade knowledge for Industrial Training Institutes.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "engineering workshop technology industrial training mechanics electrical basics", count: 25 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 20 },
      { subject: "General Knowledge", query: "current affairs skill development India Sikkim ITI vocational training", count: 20 },
      { subject: "Arithmetic and Logical Reasoning", query: "workshop mathematics calculation measurement technical drawing", count: 15 },
      { subject: "Science", query: "safety engineering occupational health industrial safety fire safety", count: 10 },
      { subject: "Indian Polity", query: "skill development policy apprenticeship act vocational education", count: 5 },
      { subject: "Indian Economy", query: "industrial development skill India manufacturing sector employment", count: 5 },
    ],
  },
  "principal-iti": {
    name: "Principal ITI Examination",
    description: "SPSC Principal ITI — General English & GK + Technical Education Administration and Management.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "technical education vocational training industrial management engineering basics", count: 25 },
      { subject: "General Knowledge", query: "current affairs skill development India Sikkim education policy", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension administration writing", count: 15 },
      { subject: "Indian Polity", query: "education policy NEP vocational training governance administration", count: 15 },
      { subject: "Science", query: "engineering workshop safety industrial technology trades", count: 10 },
      { subject: "Indian Economy", query: "skill development employment industrial growth manufacturing", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "management aptitude administrative reasoning data analysis", count: 5 },
    ],
  },
  "assistant-professor-sheda": {
    name: "Assistant Professor SHEDA Examination",
    description: "SPSC Assistant Professor SHEDA — Buddhist Studies, Sanskrit, Tibetan Grammar, and Philosophy.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "History", query: "Buddhist philosophy religion history Tibet Sikkim monastery Buddhism dharma", count: 25 },
      { subject: "History", query: "Sanskrit literature Tibetan grammar ancient texts religious manuscripts", count: 15 },
      { subject: "History", query: "Nyingma philosophy Buddhist astrology Tibetan culture religious studies", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs Sikkim culture religion Buddhism India heritage", count: 15 },
      { subject: "Indian Polity", query: "cultural policy education religion constitutional provisions minority", count: 5 },
      { subject: "Geography", query: "Sikkim geography Tibetan plateau Himalayan region cultural geography", count: 5 },
      { subject: "Environment", query: "sacred landscapes monastery conservation cultural heritage", count: 5 },
    ],
  },
  "assistant-town-planner": {
    name: "Assistant Town Planner Examination",
    description: "SPSC Assistant Town Planner — General English & GK + Urban Planning and Development.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Geography", query: "urban planning town planning city development land use zoning infrastructure", count: 25 },
      { subject: "Science", query: "civil engineering architecture building construction structural design", count: 20 },
      { subject: "General Knowledge", query: "current affairs urban development smart cities Sikkim India", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Environment", query: "environmental planning urban ecology green building sustainable development", count: 10 },
      { subject: "Indian Polity", query: "urban governance municipal corporation town planning act building regulations", count: 10 },
      { subject: "Indian Economy", query: "urban economy infrastructure development real estate housing", count: 5 },
    ],
  },
  "assistant-architect": {
    name: "Assistant Architect Examination",
    description: "SPSC Assistant Architect — Architecture, Design, Building Construction, and Urban Planning.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "architecture design building construction structural engineering materials", count: 30 },
      { subject: "Geography", query: "urban planning site planning landscape architecture climatology", count: 15 },
      { subject: "General Knowledge", query: "current affairs architecture heritage buildings India Sikkim", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Science", query: "building services HVAC plumbing electrical systems", count: 10 },
      { subject: "Environment", query: "green architecture sustainable design environmental planning", count: 10 },
      { subject: "History", query: "history of architecture Indian architecture world architecture heritage", count: 5 },
      { subject: "Indian Polity", query: "building codes regulations town planning act NBC", count: 5 },
    ],
  },
  "assistant-geologist": {
    name: "Assistant Geologist Examination",
    description: "SPSC Assistant Geologist — Geology, Earth Sciences, Mineralogy, and Environmental Geology.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "geology earth science mineralogy petrology structural geology stratigraphy", count: 30 },
      { subject: "Geography", query: "geomorphology physical geography Sikkim geology Himalayan geology terrain", count: 20 },
      { subject: "Science", query: "hydrogeology groundwater mining mineral resources economic geology", count: 15 },
      { subject: "General Knowledge", query: "current affairs geological survey India mining Sikkim natural resources", count: 10 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Environment", query: "environmental geology landslides earthquakes natural hazards climate", count: 10 },
      { subject: "Indian Economy", query: "mining industry mineral resources economic development", count: 5 },
    ],
  },
  "digital-analyst": {
    name: "Digital Project Analyst / Software Developer Examination",
    description: "SPSC Digital Project Analyst & Software Developer — General English & GK + IT and Computer Science.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "computer science programming software development databases algorithms data structures", count: 30 },
      { subject: "Science", query: "IT networking cybersecurity cloud computing digital technology web development", count: 20 },
      { subject: "General Knowledge", query: "current affairs digital India IT sector technology e-governance", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "logic reasoning programming aptitude data analysis", count: 10 },
      { subject: "Indian Polity", query: "IT act cyber law digital governance e-governance policy", count: 5 },
      { subject: "Indian Economy", query: "digital economy IT industry startup ecosystem", count: 5 },
    ],
  },
  "assistant-programmer": {
    name: "Assistant Programmer Examination",
    description: "SPSC Assistant Programmer — General English & GK + Programming, Computer Science, and IT.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "programming languages C Java Python software development coding algorithms", count: 30 },
      { subject: "Science", query: "database SQL networking operating systems computer fundamentals", count: 20 },
      { subject: "General Knowledge", query: "current affairs IT technology digital India e-governance", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "logical reasoning data structures aptitude programming logic", count: 10 },
      { subject: "Indian Polity", query: "IT regulations cyber law data protection digital governance", count: 5 },
      { subject: "Indian Economy", query: "IT industry digital economy software technology", count: 5 },
    ],
  },
  "assistant-director-it": {
    name: "Assistant Director (IT) Examination",
    description: "SPSC AD IT — Advanced Computer Science and IT Administration.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "computer science networking systems administration database management software engineering", count: 30 },
      { subject: "Science", query: "cybersecurity cloud computing IT infrastructure project management SDLC", count: 20 },
      { subject: "General Knowledge", query: "current affairs IT sector digital India e-governance technology", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension technical writing", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "data structures algorithms programming logic aptitude", count: 10 },
      { subject: "Indian Polity", query: "IT act cybersecurity policy digital governance e-governance framework", count: 10 },
      { subject: "Indian Economy", query: "digital economy IT industry software exports startup", count: 5 },
    ],
  },
  "lab-assistant": {
    name: "Laboratory Assistant Examination",
    description: "SPSC Lab Assistant — General English & GK + General Science and Mathematics.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "general science chemistry biology laboratory techniques experiments", count: 25 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics arithmetic algebra geometry calculation", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs general awareness India Sikkim", count: 15 },
      { subject: "Science", query: "physics mechanics optics electricity magnetism", count: 10 },
    ],
  },
  "field-assistant": {
    name: "Field Assistant Examination",
    description: "SPSC Field Assistant — General English & GK + Mathematics, Economics, and Statistics.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics statistics probability data analysis arithmetic", count: 25 },
      { subject: "Indian Economy", query: "economics economic development statistics data collection analysis", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs India Sikkim economic data surveys census", count: 15 },
      { subject: "Indian Polity", query: "governance administration planning statistics bureau", count: 10 },
      { subject: "Geography", query: "field survey geography data collection mapping", count: 10 },
      { subject: "Science", query: "computer basics data entry information technology", count: 5 },
    ],
  },
  "ado-wdo-hdo": {
    name: "ADO/WDO/HDO (Agriculture/Women/Horticulture Development Officer) Examination",
    description: "SPSC ADO/WDO/HDO — GK + Development Administration, Agriculture, and Social Welfare.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "agriculture horticulture crop science rural development women empowerment", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim development schemes agriculture women welfare", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Indian Economy", query: "rural economy agriculture development cooperative movement", count: 15 },
      { subject: "Indian Polity", query: "panchayati raj rural governance development administration welfare", count: 10 },
      { subject: "Environment", query: "agriculture ecology soil conservation organic farming horticulture", count: 10 },
      { subject: "Geography", query: "Sikkim geography agriculture zones climate soil types", count: 5 },
      { subject: "History", query: "rural development history Sikkim history social reform", count: 5 },
    ],
  },
  "senior-information-assistant": {
    name: "Senior Information Assistant Examination",
    description: "SPSC Senior Information Assistant — General English & GK + Media, Communication, and Information Services.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary comprehension essay writing journalism", count: 25 },
      { subject: "General Knowledge", query: "current affairs India Sikkim media mass communication information technology", count: 25 },
      { subject: "Indian Polity", query: "press freedom media regulations RTI act information policy governance", count: 15 },
      { subject: "History", query: "Indian history Sikkim history media history journalism development", count: 10 },
      { subject: "Science", query: "information technology digital media communication technology", count: 10 },
      { subject: "Indian Economy", query: "media economy advertising digital media industry", count: 5 },
      { subject: "Geography", query: "India geography Sikkim geography", count: 5 },
      { subject: "Arithmetic and Logical Reasoning", query: "reasoning data interpretation general aptitude", count: 5 },
    ],
  },
  "sub-editor": {
    name: "Assistant Sub-Editor / Sub-Editor Examination",
    description: "SPSC Sub-Editor — General English & GK + Language proficiency and editorial skills.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary comprehension editing proofreading writing skills", count: 30 },
      { subject: "General Knowledge", query: "current affairs India Sikkim media journalism publishing", count: 20 },
      { subject: "Nepali Literature", query: "Nepali language literature grammar writing Sikkim languages", count: 15 },
      { subject: "Indian Polity", query: "press law media regulation freedom of speech journalism ethics", count: 10 },
      { subject: "History", query: "Indian history Sikkim history cultural history literature", count: 10 },
      { subject: "General English", query: "translation precis essay editorial writing news reporting", count: 10 },
      { subject: "Geography", query: "India geography Sikkim geography general knowledge", count: 5 },
    ],
  },
  "inspector-legal-metrology": {
    name: "Inspector Legal Metrology Examination",
    description: "SPSC Inspector Legal Metrology — General English & GK + Legal Metrology, Weights & Measures.",
    total_questions: 100,
    duration_minutes: 120,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "metrology weights measures measurement standards calibration instruments", count: 25 },
      { subject: "Indian Polity", query: "legal metrology act weights measures regulations consumer protection", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim consumer affairs trade standards", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "Arithmetic and Logical Reasoning", query: "mathematics measurement calculation unit conversion", count: 10 },
      { subject: "Indian Economy", query: "trade commerce consumer protection market regulation", count: 10 },
      { subject: "Science", query: "physics measurement SI units standards instrumentation", count: 5 },
    ],
  },
  "photographer": {
    name: "Photographer Examination",
    description: "SPSC Photographer — General English & GK + Photography, Visual Communication, and Media.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "photography camera optics lighting exposure composition digital imaging", count: 25 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 15 },
      { subject: "General Knowledge", query: "current affairs India Sikkim media visual arts culture", count: 15 },
      { subject: "Science", query: "digital photography editing software image processing photo journalism", count: 10 },
      { subject: "History", query: "history of photography art history visual communication media", count: 5 },
      { subject: "Science", query: "optics physics light color theory darkroom techniques", count: 5 },
      { subject: "Indian Polity", query: "media regulations press photography law copyright", count: 5 },
    ],
  },
  "script-writer": {
    name: "Script Writer Examination",
    description: "SPSC Script Writer — General English & GK + Creative Writing, Media Production, and Communication.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "General English", query: "English grammar vocabulary creative writing essay script writing narration", count: 30 },
      { subject: "General Knowledge", query: "current affairs India Sikkim media entertainment film television", count: 15 },
      { subject: "History", query: "history of media film television drama literature Sikkim culture", count: 10 },
      { subject: "Nepali Literature", query: "Nepali literature drama poetry writing Sikkim languages", count: 10 },
      { subject: "Indian Polity", query: "media regulation broadcasting censorship copyright intellectual property", count: 5 },
      { subject: "Science", query: "media production audio visual technology broadcasting", count: 5 },
      { subject: "Geography", query: "Sikkim geography culture tourism documentary", count: 5 },
    ],
  },
  "feed-mill-operator": {
    name: "Feed Mill Operator Examination",
    description: "SPSC Feed Mill Operator — General English & GK + Animal Nutrition, Feed Processing, and Mill Operations.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "animal nutrition feed processing feed mill operation machinery livestock feed", count: 25 },
      { subject: "Science", query: "animal husbandry poultry dairy cattle nutrition ingredients", count: 15 },
      { subject: "General Knowledge", query: "current affairs animal husbandry schemes India Sikkim", count: 15 },
      { subject: "General English", query: "English grammar vocabulary comprehension", count: 10 },
      { subject: "Science", query: "machinery operation maintenance quality control safety procedures", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "calculation measurement ratio proportion mixing", count: 5 },
    ],
  },
  "printing-stationery": {
    name: "Printing & Stationery Various Posts Examination",
    description: "SPSC Printing & Stationery — General English & GK + Printing Technology and Trade Knowledge.",
    total_questions: 80,
    duration_minutes: 90,
    negative_marking: true,
    negative_mark_value: 0.25,
    marks_per_question: 1,
    sections: [
      { subject: "Science", query: "printing technology press machines paper manufacturing graphic design", count: 20 },
      { subject: "General English", query: "English grammar vocabulary comprehension proofreading editing", count: 20 },
      { subject: "General Knowledge", query: "current affairs India Sikkim publishing printing industry", count: 15 },
      { subject: "Science", query: "design layout typography typesetting computer-aided design DTP", count: 10 },
      { subject: "Arithmetic and Logical Reasoning", query: "measurement calculation paper sizes arithmetic", count: 5 },
      { subject: "Indian Polity", query: "government press official gazette rules regulations", count: 5 },
      { subject: "Indian Economy", query: "printing industry publishing economy stationery supply", count: 5 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Build condensed pattern list for the Gemini system prompt
// ---------------------------------------------------------------------------

function buildCondensedPatternList(): string {
  return Object.entries(EXAM_PATTERNS)
    .map(
      ([id, p]) =>
        `- id: "${id}" | ${p.name} | ${p.total_questions}Q | ${p.duration_minutes}min | neg: ${p.negative_mark_value}`
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Utility functions (from mock-test/index.ts)
// ---------------------------------------------------------------------------

function pickBalancedQuestions(
  candidates: any[],
  targetCount: number,
  diffMix: { easy: number; medium: number; hard: number }
): any[] {
  const byDifficulty: Record<string, any[]> = { easy: [], medium: [], hard: [] };
  for (const q of candidates) {
    const d = (q.difficulty || "medium").toLowerCase();
    if (byDifficulty[d]) {
      byDifficulty[d].push(q);
    } else {
      byDifficulty.medium.push(q);
    }
  }

  for (const key of Object.keys(byDifficulty)) {
    byDifficulty[key] = shuffleArray(byDifficulty[key]);
  }

  const targetEasy = Math.round((targetCount * diffMix.easy) / 100);
  const targetHard = Math.round((targetCount * diffMix.hard) / 100);
  const targetMedium = targetCount - targetEasy - targetHard;

  const picked: any[] = [];
  picked.push(...byDifficulty.easy.slice(0, targetEasy));
  picked.push(...byDifficulty.medium.slice(0, targetMedium));
  picked.push(...byDifficulty.hard.slice(0, targetHard));

  if (picked.length < targetCount) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const remaining = candidates.filter((q) => !pickedIds.has(q.id));
    picked.push(...remaining.slice(0, targetCount - picked.length));
  }

  return shuffleArray(picked).slice(0, targetCount);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// System prompt for Gemini exam identification
// ---------------------------------------------------------------------------

function buildExamIdentificationSystemPrompt(): string {
  const condensedList = buildCondensedPatternList();

  return `You are an exam pattern identification assistant for PrepSPSC, a study platform for competitive exams.

Your job: Identify the exam the user wants to take a mock test for, based on their natural language description.

## Known SPSC Exam Patterns (Sikkim PSC)
${condensedList}

## Instructions

Analyze the user's message and respond with ONE of these JSON formats:

### 1. If the exam matches a known SPSC pattern:
\`\`\`json
{
  "type": "exam_match",
  "patternId": "<the id from the list above>",
  "message": "I found the <exam name> pattern! This is a <total_questions>-question exam lasting <duration> minutes with <describe key features>. Would you like me to generate a mock test with this pattern?"
}
\`\`\`

### 2. If it's a non-SPSC exam (UPSC, CAT, CDS, JEE, NEET, SSC, Banking, Railway, etc.):
Construct a realistic exam pattern from your knowledge of the exam.
\`\`\`json
{
  "type": "custom_exam",
  "pattern": {
    "name": "<Full exam name>",
    "description": "<Brief exam description>",
    "total_questions": <number>,
    "duration_minutes": <number>,
    "negative_marking": <true|false>,
    "negative_mark_value": <number>,
    "marks_per_question": <number>,
    "sections": [
      { "subject": "<Subject>", "query": "<search keywords for question generation>", "count": <number> }
    ]
  },
  "message": "I've created a pattern for <exam name>. This is a <total_questions>-question test lasting <duration> minutes. The sections cover: <list sections>. Would you like me to generate a mock test with this pattern?"
}
\`\`\`

### 3. If the request is unclear or you need more information:
\`\`\`json
{
  "type": "clarification",
  "message": "<Your question to the user — be helpful, suggest exam names they might mean>"
}
\`\`\`

## Rules
- Be conversational and friendly in your "message" field
- For SPSC exams, ALWAYS use the exact patternId from the list — never make up SPSC patterns
- For non-SPSC exams, construct realistic patterns based on actual exam syllabi
- If the user mentions "Sikkim" or "SPSC", look in the known patterns first
- The "message" should be a natural response the user will see — keep it concise but informative
- Return ONLY valid JSON, no markdown wrapping, no extra text`;
}

// ---------------------------------------------------------------------------
// Phase 1: Exam identification via Gemini chat
// ---------------------------------------------------------------------------

async function handleExamIdentification(
  messages: { role: "user" | "assistant"; content: string }[],
  genAI: GoogleGenerativeAI,
  send: (event: StreamEvent) => void
): Promise<void> {
  const model = genAI.getGenerativeModel({ model: CHAT_MODEL });

  const systemPrompt = buildExamIdentificationSystemPrompt();

  // Build chat history for Gemini (convert to Gemini format)
  const geminiHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const lastUserMessage = messages[messages.length - 1]?.content || "";

  const chat = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemPrompt }] },
      {
        role: "model",
        parts: [
          {
            text: '{"type": "clarification", "message": "Hello! I can help you generate a mock test for any competitive exam. Which exam are you preparing for? I support all 64 SPSC exams, as well as UPSC, SSC, Banking, JEE, NEET, and more."}',
          },
        ],
      },
      ...geminiHistory,
    ],
  });

  // Stream the response
  const streamResult = await chat.sendMessageStream(lastUserMessage);

  let fullText = "";
  for await (const chunk of streamResult.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      fullText += chunkText;
    }
  }

  // Parse the Gemini JSON response
  let parsed: any;
  try {
    const cleaned = fullText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback: treat the whole response as a clarification message
        parsed = { type: "clarification", message: fullText };
      }
    } else {
      parsed = { type: "clarification", message: fullText };
    }
  }

  // Stream the text message
  if (parsed.message) {
    send({ type: "text", content: parsed.message });
  }

  // Send the exam pattern event if identified
  if (parsed.type === "exam_match" && parsed.patternId) {
    const pattern = EXAM_PATTERNS[parsed.patternId];
    if (pattern) {
      send({
        type: "exam_pattern",
        pattern,
        source: "spsc",
        patternId: parsed.patternId,
      });
    } else {
      send({
        type: "text",
        content: `\n\nI couldn't find the pattern "${parsed.patternId}" in our database. Could you try describing the exam differently?`,
      });
    }
  } else if (parsed.type === "custom_exam" && parsed.pattern) {
    send({
      type: "exam_pattern",
      pattern: parsed.pattern,
      source: "ai",
    });
  }
  // For "clarification" type, only the text message is sent (already done above)
}

// ---------------------------------------------------------------------------
// Phase 2a: Generate test from PYQs (SPSC patterns)
// ---------------------------------------------------------------------------

async function generateFromPYQs(
  pattern: ExamPattern,
  patternId: string,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  genAI: GoogleGenerativeAI,
  send: (event: StreamEvent) => void
): Promise<void> {
  const startTime = Date.now();
  const diffMix = { easy: 30, medium: 50, hard: 20 };
  const yearMin = new Date().getFullYear() - 2;

  const embModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const allQuestions: Array<{
    subject: string;
    question: string;
    options: any[];
    correct_option_id: string;
    explanation: string | null;
    difficulty: string;
  }> = [];

  const allUsedIds: string[] = [];
  const sectionMeta: Array<{ subject: string; count: number }> = [];

  for (const section of pattern.sections) {
    send({
      type: "generating",
      progress: `Searching ${section.subject} questions (${section.count} needed)...`,
    });

    let embedding: number[];
    try {
      const result = await embModel.embedContent({
        content: { parts: [{ text: section.query }] },
        taskType: "RETRIEVAL_QUERY" as any,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      } as any);
      embedding = result.embedding.values;
    } catch (err) {
      console.error(
        `[mock-test-chat] Embedding failed for ${section.subject}:`,
        err
      );
      sectionMeta.push({ subject: section.subject, count: 0 });
      continue;
    }

    const fetchLimit = Math.min(section.count * 3, 60);
    const { data, error } = await supabase.rpc("search_pyq_semantic", {
      query_embedding: `[${embedding.join(",")}]`,
      p_subject: section.subject,
      p_exam_names: HARDCODED_EXAM_NAMES,
      p_match_threshold: 0.2,
      p_limit: fetchLimit,
      p_exclude_ids: allUsedIds,
      p_year_min: yearMin,
    });

    if (error || !data) {
      console.error(
        `[mock-test-chat] Search failed for ${section.subject}:`,
        error
      );
      sectionMeta.push({ subject: section.subject, count: 0 });
      continue;
    }

    const picked = pickBalancedQuestions(data, section.count, diffMix);

    for (const q of picked) {
      allUsedIds.push(q.id);
      allQuestions.push({
        subject: section.subject,
        question: q.question,
        options: q.options || [],
        correct_option_id: q.correct_option_id || "a",
        explanation: q.explanation || null,
        difficulty: q.difficulty || "medium",
      });
    }

    sectionMeta.push({ subject: section.subject, count: picked.length });

    send({
      type: "generating",
      progress: `Found ${picked.length}/${section.count} ${section.subject} questions.`,
    });
  }

  if (allQuestions.length === 0) {
    send({
      type: "error",
      error: "No questions found for this exam pattern. Please try a different exam.",
    });
    return;
  }

  send({
    type: "generating",
    progress: `Assembling test with ${allQuestions.length} questions...`,
  });

  const generationTimeMs = Date.now() - startTime;
  const totalQuestions = allQuestions.length;
  const totalMarks = totalQuestions * pattern.marks_per_question;

  // Insert test into DB
  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .insert({
      title: `${pattern.name} — AI Mock Test`,
      description: pattern.description,
      duration_minutes: pattern.duration_minutes,
      total_marks: totalMarks,
      passing_marks: Math.round(totalMarks * 0.4),
      test_type: "mcq",
      difficulty: "moderate",
      is_premium: false,
      is_active: true,
      created_by: userId,
      source: "ai_mock",
      mock_meta: {
        pattern: patternId,
        negative_marking: pattern.negative_marking,
        negative_mark_value: pattern.negative_mark_value,
        marks_per_question: pattern.marks_per_question,
        sections: sectionMeta,
        generation_time_ms: generationTimeMs,
        generated_via: "mock-test-chat",
      },
    })
    .select("id")
    .single();

  if (testError || !testRow) {
    console.error("[mock-test-chat] Failed to insert test:", testError);
    send({ type: "error", error: "Failed to create test in database." });
    return;
  }

  const testId = testRow.id;

  // Insert questions into DB
  const questionRows = allQuestions.map((q, idx) => ({
    test_id: testId,
    content: q.question,
    type: "mcq",
    options: q.options,
    correct_answer: q.correct_option_id,
    marks: pattern.marks_per_question,
    negative_marks: pattern.negative_mark_value,
    explanation: q.explanation,
    sort_order: idx + 1,
  }));

  const { error: questionsError } = await supabase
    .from("questions")
    .insert(questionRows);

  if (questionsError) {
    console.error("[mock-test-chat] Failed to insert questions:", questionsError);
    await supabase.from("tests").delete().eq("id", testId);
    send({ type: "error", error: "Failed to save test questions." });
    return;
  }

  console.log(
    `[mock-test-chat] Created PYQ test ${testId} with ${totalQuestions} questions in ${generationTimeMs}ms`
  );

  send({
    type: "test_ready",
    testId,
    totalQuestions,
    generationTimeMs,
  });
}

// ---------------------------------------------------------------------------
// Phase 2b: Generate test from AI (non-SPSC exams)
// ---------------------------------------------------------------------------

async function generateFromAI(
  pattern: ExamPattern,
  userId: string,
  supabase: ReturnType<typeof createClient>,
  genAI: GoogleGenerativeAI,
  send: (event: StreamEvent) => void
): Promise<void> {
  const startTime = Date.now();
  const model = genAI.getGenerativeModel({ model: CHAT_MODEL });

  const allQuestions: Array<{
    subject: string;
    question: string;
    options: { id: string; text: string }[];
    correct_option_id: string;
    explanation: string;
    difficulty: string;
  }> = [];

  const sectionMeta: Array<{ subject: string; count: number }> = [];

  for (const section of pattern.sections) {
    send({
      type: "generating",
      progress: `Generating ${section.count} ${section.subject} questions...`,
    });

    const prompt = `Generate exactly ${section.count} multiple choice questions (MCQs) for the "${section.subject}" section of the "${pattern.name}" exam.

Topic/Keywords: ${section.query}

Requirements:
- Each question must have exactly 4 options labeled a, b, c, d
- Provide the correct_option_id (a, b, c, or d)
- Provide a brief explanation for the correct answer
- Assign a difficulty level: "easy", "medium", or "hard"
- Mix difficulties: roughly 30% easy, 50% medium, 20% hard
- Questions should be exam-quality, testing real knowledge
- Do NOT repeat questions

Return a JSON array (no markdown wrapping):
[
  {
    "question": "...",
    "options": [
      { "id": "a", "text": "..." },
      { "id": "b", "text": "..." },
      { "id": "c", "text": "..." },
      { "id": "d", "text": "..." }
    ],
    "correct_option_id": "a",
    "explanation": "...",
    "difficulty": "medium"
  }
]

Return ONLY the JSON array, nothing else.`;

    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Parse the JSON array
      let questions: any[];
      try {
        const cleaned = responseText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        questions = JSON.parse(cleaned);
      } catch {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        } else {
          console.error(
            `[mock-test-chat] Failed to parse AI questions for ${section.subject}`
          );
          sectionMeta.push({ subject: section.subject, count: 0 });
          continue;
        }
      }

      if (!Array.isArray(questions)) {
        console.error(
          `[mock-test-chat] AI response not an array for ${section.subject}`
        );
        sectionMeta.push({ subject: section.subject, count: 0 });
        continue;
      }

      // Validate and add questions
      let addedCount = 0;
      for (const q of questions) {
        if (
          q.question &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.correct_option_id
        ) {
          allQuestions.push({
            subject: section.subject,
            question: q.question,
            options: q.options.map((o: any) => ({
              id: o.id || String.fromCharCode(97 + q.options.indexOf(o)),
              text: o.text || o,
            })),
            correct_option_id: q.correct_option_id,
            explanation: q.explanation || "",
            difficulty: q.difficulty || "medium",
          });
          addedCount++;
          if (addedCount >= section.count) break;
        }
      }

      sectionMeta.push({ subject: section.subject, count: addedCount });

      send({
        type: "generating",
        progress: `Generated ${addedCount}/${section.count} ${section.subject} questions.`,
      });
    } catch (err) {
      console.error(
        `[mock-test-chat] AI generation failed for ${section.subject}:`,
        err
      );
      sectionMeta.push({ subject: section.subject, count: 0 });

      send({
        type: "generating",
        progress: `Failed to generate ${section.subject} questions, skipping...`,
      });
    }
  }

  if (allQuestions.length === 0) {
    send({
      type: "error",
      error: "Failed to generate any questions. Please try again.",
    });
    return;
  }

  send({
    type: "generating",
    progress: `Assembling test with ${allQuestions.length} AI-generated questions...`,
  });

  const generationTimeMs = Date.now() - startTime;
  const totalQuestions = allQuestions.length;
  const totalMarks = totalQuestions * pattern.marks_per_question;

  // Insert test into DB
  const { data: testRow, error: testError } = await supabase
    .from("tests")
    .insert({
      title: `${pattern.name} — AI Mock Test`,
      description: pattern.description,
      duration_minutes: pattern.duration_minutes,
      total_marks: totalMarks,
      passing_marks: Math.round(totalMarks * 0.4),
      test_type: "mcq",
      difficulty: "moderate",
      is_premium: false,
      is_active: true,
      created_by: userId,
      source: "ai_mock",
      mock_meta: {
        pattern: "ai_generated",
        pattern_name: pattern.name,
        negative_marking: pattern.negative_marking,
        negative_mark_value: pattern.negative_mark_value,
        marks_per_question: pattern.marks_per_question,
        sections: sectionMeta,
        generation_time_ms: generationTimeMs,
        generated_via: "mock-test-chat",
        source_type: "ai",
      },
    })
    .select("id")
    .single();

  if (testError || !testRow) {
    console.error("[mock-test-chat] Failed to insert AI test:", testError);
    send({ type: "error", error: "Failed to create test in database." });
    return;
  }

  const testId = testRow.id;

  // Insert questions into DB
  const questionRows = allQuestions.map((q, idx) => ({
    test_id: testId,
    content: q.question,
    type: "mcq",
    options: q.options,
    correct_answer: q.correct_option_id,
    marks: pattern.marks_per_question,
    negative_marks: pattern.negative_mark_value,
    explanation: q.explanation,
    sort_order: idx + 1,
  }));

  const { error: questionsError } = await supabase
    .from("questions")
    .insert(questionRows);

  if (questionsError) {
    console.error(
      "[mock-test-chat] Failed to insert AI questions:",
      questionsError
    );
    await supabase.from("tests").delete().eq("id", testId);
    send({ type: "error", error: "Failed to save test questions." });
    return;
  }

  console.log(
    `[mock-test-chat] Created AI test ${testId} with ${totalQuestions} questions in ${generationTimeMs}ms`
  );

  send({
    type: "test_ready",
    testId,
    totalQuestions,
    generationTimeMs,
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured." }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate via JWT
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only accept POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: `Method ${req.method} not allowed.` }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    let body: MockTestChatRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request body." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required and must not be empty." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Create NDJSON streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: StreamEvent) => {
          controller.enqueue(
            encoder.encode(JSON.stringify(event) + "\n")
          );
        };

        try {
          if (body.action === "generate") {
            // -----------------------------------------------------------------
            // Phase 2: Test generation
            // -----------------------------------------------------------------

            let pattern: ExamPattern | undefined;
            let patternId: string | undefined;
            let source: "spsc" | "ai" = body.patternSource || "spsc";

            if (body.patternSource === "spsc" && body.patternId) {
              pattern = EXAM_PATTERNS[body.patternId];
              patternId = body.patternId;
              if (!pattern) {
                send({
                  type: "error",
                  error: `Unknown SPSC pattern: "${body.patternId}".`,
                });
                send({ type: "done" });
                controller.close();
                return;
              }
            } else if (body.confirmedPattern) {
              pattern = body.confirmedPattern;
              patternId = "custom";
              source = "ai";
            } else {
              send({
                type: "error",
                error: "No pattern specified for generation. Provide patternId (SPSC) or confirmedPattern (custom).",
              });
              send({ type: "done" });
              controller.close();
              return;
            }

            send({
              type: "generating",
              progress: `Starting ${pattern.name} mock test generation...`,
            });

            if (source === "spsc") {
              await generateFromPYQs(
                pattern,
                patternId!,
                user.id,
                supabase,
                genAI,
                send
              );
            } else {
              await generateFromAI(
                pattern,
                user.id,
                supabase,
                genAI,
                send
              );
            }
          } else {
            // -----------------------------------------------------------------
            // Phase 1: Exam identification (conversational)
            // -----------------------------------------------------------------
            await handleExamIdentification(body.messages, genAI, send);
          }

          send({ type: "done" });
        } catch (err) {
          console.error("[mock-test-chat] Stream error:", err);
          send({
            type: "error",
            error: err instanceof Error ? err.message : "An unexpected error occurred.",
          });
          send({ type: "done" });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[mock-test-chat] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
