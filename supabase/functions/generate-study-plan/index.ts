// Supabase Edge Function for generating study plans
// This runs with longer timeout (150s) than Vercel Hobby (10s)
// Returns immediately and processes in the background

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Syllabus definitions (fallback)
const EXAM_SYLLABI: Record<string, string> = {
  "sikkim-psc": `SIKKIM PSC SYLLABUS:
1. General Studies: History of India, History of Sikkim, Geography, Polity, Economy, Environment, Science & Technology, Current Affairs
2. Sikkim Specific: Sikkim History & Culture, Geography, Economy, Local Governance, Tourism`,
  "upsc-prelims": `UPSC PRELIMS SYLLABUS:
Paper I - General Studies: History, Geography, Polity, Economy, Environment, General Science
Paper II - CSAT: Comprehension, Logical reasoning, Decision making, Basic numeracy`,
};

const GEMINI_MODEL = Deno.env.get("GEMINI_BASIC_MODEL") ?? "gemini-3.1-flash-lite"; // cheap default (see src/lib/ai-models.ts)

// Attempt to repair truncated JSON
function repairTruncatedJSON(text: string): string {
  let repaired = text.trim();
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let lastChar = "";

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];
    if (char === '"' && lastChar !== "\\") inString = !inString;
    if (!inString) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      if (char === "[") bracketCount++;
      if (char === "]") bracketCount--;
    }
    lastChar = char;
  }

  if (inString) repaired += '"';
  repaired = repaired.replace(/,\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ": null");
  while (bracketCount > 0) { repaired += "]"; bracketCount--; }
  while (braceCount > 0) { repaired += "}"; braceCount--; }
  return repaired;
}

// Process the job (runs in background after response is sent)
async function processJob(jobId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Initialize Gemini
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_NOT_CONFIGURED");
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log(`[generate-study-plan] Processing job: ${jobId}`);

    // Fetch the job
    const { data: job, error: jobError } = await supabase
      .from("plan_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return;
    }

    // Mark job as processing
    await supabase
      .from("plan_generation_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId);

    const params = job.input_params;
    const { examType, customSyllabus, durationWeeks, hoursPerDay, studySlots = 1, focusAreas, startWithSubject, startDay = "Mon" } = params;

    // Build 7-day rotation starting from startDay
    const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const startIdx = ALL_DAYS.indexOf(startDay) !== -1 ? ALL_DAYS.indexOf(startDay) : 0;
    const weekDays = [...ALL_DAYS.slice(startIdx), ...ALL_DAYS.slice(0, startIdx)].join(", ");

    // Get syllabus content
    let syllabus = "";
    let microthemesInfo = "";
    let examSchemeInfo = "";
    let hasMicrothemes = false;
    let examName = examType.toUpperCase();

    // Helper to process microthemes
    const processMicrothemes = (microthemes: Array<{
      subject: string;
      topics: string[];
      importance: string;
      pyqFrequency: number;
    }>, name: string) => {
      hasMicrothemes = true;
      const sortedMicrothemes = [...microthemes].sort((a, b) => {
        const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const impDiff = (importanceOrder[a.importance] || 1) - (importanceOrder[b.importance] || 1);
        if (impDiff !== 0) return impDiff;
        return (b.pyqFrequency || 0) - (a.pyqFrequency || 0);
      });

      microthemesInfo = `\n\nPRIORITY GUIDE - HIGH YIELD TOPICS:\n`;
      const highImportance = sortedMicrothemes.filter(m => m.importance === "high");
      const mediumImportance = sortedMicrothemes.filter(m => m.importance === "medium");

      if (highImportance.length > 0) {
        microthemesInfo += `\nHIGH PRIORITY:`;
        highImportance.forEach(m => { microthemesInfo += `\n  - ${m.subject} (PYQ: ${m.pyqFrequency}x)`; });
      }
      if (mediumImportance.length > 0) {
        microthemesInfo += `\n\nMEDIUM PRIORITY:`;
        mediumImportance.forEach(m => { microthemesInfo += `\n  - ${m.subject} (PYQ: ${m.pyqFrequency}x)`; });
      }

      if (!syllabus) {
        syllabus = `${name} SYLLABUS:\n` +
          sortedMicrothemes.map(m => `- ${m.subject}: ${m.topics?.join(", ") || "General topics"}`).join("\n");
      }

      return sortedMicrothemes;
    };

    // Helper to process exam scheme
    const processExamScheme = (examScheme: unknown) => {
      if (examScheme && typeof examScheme === "object") {
        const scheme = examScheme as { papers?: Array<{ name: string; totalMarks: number }>; examFormat?: string };
        if (scheme.papers && scheme.papers.length > 0) {
          examSchemeInfo = `\n\nEXAM FORMAT:`;
          scheme.papers.forEach(paper => {
            examSchemeInfo += `\n- ${paper.name}: ${paper.totalMarks} marks`;
          });
        }
      }
    };

    if (examType === "custom") {
      syllabus = customSyllabus || "";
      examName = "Custom Syllabus";
    } else if (examType.startsWith("user:")) {
      // User's custom exam
      const userExamId = examType.replace("user:", "");
      console.log(`[generate-study-plan] Fetching user custom exam: ${userExamId}`);

      const { data: userExam } = await supabase
        .from("user_custom_exams")
        .select("syllabus_content, microthemes, name, exam_scheme")
        .eq("id", userExamId)
        .eq("user_id", job.user_id)
        .eq("is_active", true)
        .single();

      if (userExam) {
        examName = userExam.name || "Custom Exam";
        if (userExam.syllabus_content) {
          syllabus = userExam.syllabus_content;
        }
        if (userExam.microthemes && Array.isArray(userExam.microthemes) && userExam.microthemes.length > 0) {
          processMicrothemes(userExam.microthemes as Array<{
            subject: string;
            topics: string[];
            importance: string;
            pyqFrequency: number;
          }>, userExam.name || "Custom Exam");
        }
        processExamScheme(userExam.exam_scheme);
      } else {
        console.warn(`[generate-study-plan] User exam not found: ${userExamId}`);
        throw new Error("Custom exam not found or access denied");
      }
    } else {
      // Admin exam
      const { data: adminExam } = await supabase
        .from("admin_exams")
        .select("syllabus_content, microthemes, name, exam_scheme")
        .eq("slug", examType)
        .eq("is_active", true)
        .single();

      if (adminExam) {
        examName = adminExam.name || examType.toUpperCase();
        if (adminExam.syllabus_content) {
          syllabus = adminExam.syllabus_content;
        }
        if (adminExam.microthemes && Array.isArray(adminExam.microthemes) && adminExam.microthemes.length > 0) {
          processMicrothemes(adminExam.microthemes as Array<{
            subject: string;
            topics: string[];
            importance: string;
            pyqFrequency: number;
          }>, adminExam.name || examType.toUpperCase());
        }
        processExamScheme(adminExam.exam_scheme);
      }

      if (!syllabus && !hasMicrothemes) {
        syllabus = EXAM_SYLLABI[examType] || EXAM_SYLLABI["upsc-prelims"];
      }
    }

    // Build prompt
    const slotNames = ["Morning", "Afternoon", "Evening"];
    const hoursPerSlot = Math.floor(hoursPerDay / studySlots);
    const slotsInfo = studySlots > 1
      ? `\nSTUDY SLOTS: ${studySlots} slots per day (${slotNames.slice(0, studySlots).join(", ")}) - ${hoursPerSlot}h each`
      : "";

    const prompt = `You are an expert exam preparation strategist.

Create a detailed, week-by-week study plan:

EXAM TYPE: ${examName}
DURATION: ${durationWeeks} weeks
DAILY STUDY HOURS: ${hoursPerDay} hours${slotsInfo}
${focusAreas?.length > 0 ? `PRIORITY FOCUS AREAS: ${focusAreas.join(", ")}` : ""}
${startWithSubject ? `START WITH: ${startWithSubject} - Begin the study plan with this subject in Week 1, Day 1` : ""}

SYLLABUS:
${syllabus}${microthemesInfo}${examSchemeInfo}

OUTPUT FORMAT (STRICT JSON):
{
  "title": "Plan title (short)",
  "schedule": [
    {
      "week": 1,
      "focus": "Week focus",
      "goal": "Week goal",
      "topics": [
        {
          "day": 1,
          "dayName": "${startDay}",${studySlots > 1 ? `
          "slot": "Morning",` : ""}
          "subject": "Subject",
          "topics": ["Topic 1", "Topic 2"],
          "duration": "${hoursPerSlot}h"
        }
      ]
    }
  ],
  "resources": [
    {
      "type": "youtube",
      "title": "Topic - Subject",
      "url": "https://www.youtube.com/results?search_query=Subject+Topic",
      "subject": "Subject"
    }
  ]
}

RULES:
- Return ONLY valid JSON
- Keep topic names SHORT (max 3 words each)
- Max 3 topics per day-slot entry
- Week 1 starts on ${startDay}. Day order for each week: ${weekDays}
- Include 6-8 YouTube search URLs (not more)
- Be concise — do not add any explanation or commentary
${startWithSubject ? `- IMPORTANT: Start Week 1, Day 1 with "${startWithSubject}" as the first subject` : ""}`;

    console.log(`[generate-study-plan] Calling Gemini model: ${GEMINI_MODEL}`);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 16384,
      },
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`[generate-study-plan] Model responded, length: ${responseText.length}`);

    // Clean and parse JSON
    let cleanedText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const jsonStartIndex = cleanedText.indexOf("{");
    if (jsonStartIndex > 0) {
      cleanedText = cleanedText.slice(jsonStartIndex);
    }

    let planData;
    try {
      planData = JSON.parse(cleanedText);
    } catch {
      console.warn("[generate-study-plan] Initial parse failed, attempting repair...");
      const repairedText = repairTruncatedJSON(cleanedText);
      planData = JSON.parse(repairedText);
    }

    // Get microthemes for saving
    let planMicrothemes: unknown[] = [];
    if (examType === "custom") {
      // Custom syllabus - no microthemes
    } else if (examType.startsWith("user:")) {
      // User custom exam - fetch microthemes
      const userExamId = examType.replace("user:", "");
      const { data: userExamForMicrothemes } = await supabase
        .from("user_custom_exams")
        .select("microthemes")
        .eq("id", userExamId)
        .eq("user_id", job.user_id)
        .single();
      if (userExamForMicrothemes?.microthemes) {
        planMicrothemes = userExamForMicrothemes.microthemes;
      }
    } else {
      // Admin exam - fetch microthemes
      const { data: examForMicrothemes } = await supabase
        .from("admin_exams")
        .select("microthemes")
        .eq("slug", examType)
        .eq("is_active", true)
        .single();
      if (examForMicrothemes?.microthemes) {
        planMicrothemes = examForMicrothemes.microthemes;
      }
    }

    // Save plan to database
    const { data: savedPlan, error: insertError } = await supabase
      .from("study_plans")
      .insert({
        user_id: job.user_id,
        title: planData.title || `${examName} Study Plan`,
        exam_type: examType,
        duration_weeks: durationWeeks,
        hours_per_day: hoursPerDay,
        focus_areas: focusAreas || [],
        schedule: planData.schedule,
        resources: planData.resources || [],
        progress: 0,
        microthemes: planMicrothemes.length > 0 ? planMicrothemes : null,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save plan: ${insertError.message}`);
    }

    // Mark job as completed
    await supabase
      .from("plan_generation_jobs")
      .update({
        status: "completed",
        result_plan_id: savedPlan.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`[generate-study-plan] Job ${jobId} completed, plan ID: ${savedPlan.id}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-study-plan] Error:", errorMessage);

    // Mark job as failed
    await supabase
      .from("plan_generation_jobs")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(JSON.stringify({ error: "Missing jobId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the job exists before accepting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from("plan_generation_jobs")
      .select("id, status")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process the job fully - the caller (Vercel) will disconnect early
    // but Edge Function continues processing until completion
    console.log(`[generate-study-plan] Starting job: ${jobId}`);
    await processJob(jobId);

    console.log(`[generate-study-plan] Finished job: ${jobId}`);
    return new Response(
      JSON.stringify({ success: true, jobId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-study-plan] Error:", errorMessage);

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
