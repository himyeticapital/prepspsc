import { AI_MODELS } from "@/lib/ai-models";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

interface TopicInput {
  id: string;
  label: string;
  subject: string;
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  prompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: AI_MODELS.basic,
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Repair truncated JSON — close any open brackets/braces so JSON.parse can succeed
 * on a response that was cut off by the token limit.
 */
function repairJSON(text: string): string {
  let s = text.trim();

  // Remove trailing incomplete object/array entry (ends with comma)
  s = s.replace(/,\s*$/, "");

  // Count open brackets / braces
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let prev = "";
  for (const ch of s) {
    if (ch === '"' && prev !== "\\") inString = !inString;
    if (!inString) {
      if (ch === "{") braces++;
      if (ch === "}") braces--;
      if (ch === "[") brackets++;
      if (ch === "]") brackets--;
    }
    prev = ch;
  }

  // Close unclosed string first
  if (inString) s += '"';
  // Close unclosed arrays then objects
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }

  return s;
}

interface ParsedEdge { from: string; to: string; weight?: number }

function normalizeEdges(raw: any[]): ParsedEdge[] {
  return raw.map((e) => ({
    from: e.from,
    to: e.to,
    weight: typeof e.w === "number" ? Math.max(0, Math.min(1, e.w)) :
            typeof e.weight === "number" ? Math.max(0, Math.min(1, e.weight)) : undefined,
  }));
}

function parseEdgesFromText(text: string): ParsedEdge[] {
  // 1. Clean markdown fences
  let cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // 2. Try direct parse
  try {
    const p = JSON.parse(cleaned);
    return normalizeEdges(p.edges ?? []);
  } catch { /* fall through */ }

  // 3. Extract outermost JSON object, then try
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const p = JSON.parse(objMatch[0]);
      return normalizeEdges(p.edges ?? []);
    } catch { /* fall through */ }

    // 4. Repair truncated JSON then try again
    try {
      const repaired = repairJSON(objMatch[0]);
      const p = JSON.parse(repaired);
      return normalizeEdges(p.edges ?? []);
    } catch { /* fall through */ }
  }

  // 5. Last resort: extract edge pairs directly with regex (no weight in fallback)
  const edgeRegex = /"from"\s*:\s*"([^"]+)"\s*,\s*"to"\s*:\s*"([^"]+)"/g;
  const edges: ParsedEdge[] = [];
  let m: RegExpExecArray | null;
  while ((m = edgeRegex.exec(cleaned)) !== null) {
    edges.push({ from: m[1], to: m[2] });
  }
  if (edges.length > 0) return edges;

  console.error("[generate-knowledge-graph] All parse strategies failed. Response (300 chars):", cleaned.slice(0, 300));
  return [];
}

function buildSubjectPrompt(subjectTopics: TopicInput[]): string {
  const topicList = subjectTopics
    .map((t) => `${t.id} | ${t.label}`)
    .join("\n");
  const subject = subjectTopics[0].subject;

  return `You are an expert in ${subject} for Indian competitive exams (PSC/UPSC).

Below are all ${subject} topics. Each line: ID | Topic Name

${topicList}

Task: Map ALL prerequisite relationships between these topics. A prerequisite means topic A should be understood before topic B. Also include "w" (encompassing weight, 0.0-1.0) — how much practicing topic B implicitly reviews topic A.

Rules:
- Be EXHAUSTIVE: connect EVERY topic that has a logical dependency to another
- 1-4 prerequisites per topic is normal — most topics should have at least 1 edge
- Foundational topics (basics, introduction, overview) should be prerequisites for advanced topics
- Chronological topics should be linked in order (e.g. Ancient → Medieval → Modern)
- No circular dependencies
- Use only the exact IDs above
- w: 0.3 = weak overlap, 0.6 = moderate, 0.9 = strong overlap
- EVERY topic must appear in at least one edge (as "from" or "to")

Return ONLY valid JSON (no markdown):
{"edges":[{"from":"id","to":"id","w":0.6}]}`;
}

function buildCrossSubjectPrompt(subjectSamples: TopicInput[]): string {
  const topicList = subjectSamples
    .map((t) => `${t.id} | ${t.subject} | ${t.label}`)
    .join("\n");

  return `You are an expert in Indian PSC exam preparation across all subjects.

Below are key topics from multiple subjects:

${topicList}

Task: Find CROSS-SUBJECT prerequisite links. Example: understanding "Indian Economy → GDP" helps with "Indian Polity → Fiscal Policy". Include encompassing weight "w" (0.3-0.9).

Rules:
- Only cross-subject edges (different subjects)
- Focus on genuinely useful educational dependencies
- No circular dependencies
- Use only the exact IDs above

Return ONLY valid JSON (no markdown):
{"edges":[{"from":"id","to":"id","w":0.5}]}`;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, topics } = body as { planId: string; topics: TopicInput[] };

    if (!planId || !topics?.length) {
      return NextResponse.json({ error: "planId and topics required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[generate-knowledge-graph] GOOGLE_GEMINI_API_KEY not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // ── Group topics by subject ────────────────────────────────────
    const bySubject = new Map<string, TopicInput[]>();
    for (const t of topics) {
      if (!bySubject.has(t.subject)) bySubject.set(t.subject, []);
      bySubject.get(t.subject)!.push(t);
    }

    // ── Batch: one API call per subject (parallel) ─────────────────
    const subjectCalls = Array.from(bySubject.entries())
      .filter(([, list]) => list.length >= 2) // need at least 2 topics for edges
      .map(async ([subject, list]) => {
        try {
          const prompt = buildSubjectPrompt(list);
          const text = await generateWithFallback(genAI, prompt);
          const edges = parseEdgesFromText(text);
          return edges;
        } catch (err) {
          console.error(`[generate-knowledge-graph] ${subject} batch failed:`, err);
          return [] as ParsedEdge[];
        }
      });

    // ── Cross-subject call: sample top topics from each subject ────
    const crossSubjectTopics: TopicInput[] = [];
    for (const [, list] of bySubject) {
      // Take up to 5 from each subject for cross-subject linking
      crossSubjectTopics.push(...list.slice(0, 5));
    }
    const crossSubjectCall = crossSubjectTopics.length > 5
      ? (async () => {
          try {
            const prompt = buildCrossSubjectPrompt(crossSubjectTopics);
            const text = await generateWithFallback(genAI, prompt);
            return parseEdgesFromText(text);
          } catch (err) {
            console.error("[generate-knowledge-graph] cross-subject batch failed:", err);
            return [] as ParsedEdge[];
          }
        })()
      : Promise.resolve([] as ParsedEdge[]);

    // Run all in parallel
    const [subjectResults, crossResults] = await Promise.all([
      Promise.all(subjectCalls),
      crossSubjectCall,
    ]);

    // Merge all edges
    const allEdges: ParsedEdge[] = [...subjectResults.flat(), ...crossResults];

    if (allEdges.length === 0) {
      return NextResponse.json({ edges: [], count: 0 });
    }

    // Validate & dedupe
    const validIds = new Set(topics.map((t) => t.id));
    const edgeKey = (e: ParsedEdge) => `${e.from}→${e.to}`;
    const seen = new Set<string>();
    const validEdges = allEdges.filter((e) => {
      const key = edgeKey(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return validIds.has(e.from) && validIds.has(e.to) && e.from !== e.to;
    });

    // Remove cycles to ensure DAG
    const safeEdges = removeCycles(validEdges);

    console.log(`[generate-knowledge-graph] ${topics.length} topics → ${safeEdges.length} edges (${bySubject.size} subjects)`);
    return NextResponse.json({ edges: safeEdges, count: safeEdges.length });
  } catch (err) {
    console.error("[generate-knowledge-graph] Unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to generate knowledge graph" },
      { status: 500 }
    );
  }
}

/** Kahn's algorithm topological sort — removes back edges to ensure DAG */
function removeCycles(edges: ParsedEdge[]): ParsedEdge[] {
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDegree.set(n, 0);
    adj.set(n, []);
  }
  for (const e of edges) {
    adj.get(e.from)!.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [n, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(n);
  }

  const topoOrder = new Map<string, number>();
  let idx = 0;
  while (queue.length) {
    const node = queue.shift()!;
    topoOrder.set(node, idx++);
    for (const neighbor of adj.get(node) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return edges.filter((e) => {
    const fromIdx = topoOrder.get(e.from);
    const toIdx = topoOrder.get(e.to);
    return fromIdx !== undefined && toIdx !== undefined && fromIdx < toIdx;
  });
}
