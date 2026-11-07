/**
 * Knowledge Graph — Math Academy–inspired learning system for PrepSPSC
 *
 * Four layers:
 * 1. Graph builder — converts study plan schedule into a DAG of topic nodes
 * 2. Student model — overlays Leitner box data to compute mastery per node
 * 3. Topic status engine — topologically computes ready/locked/mastered status
 * 4. Task selection — scores "ready" nodes and returns optimal next tasks
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;                          // "indian-polity-preamble"
  label: string;                       // "Preamble"
  subject: string;                     // "Indian Polity"
  importance: "high" | "medium" | "low";
  pyqFrequency: number;
  week: number;
  day: number;
  status: "mastered" | "in-progress" | "ready" | "locked";
  masteryLevel: number;                // 0–5 (Leitner box)
  isOverdue: boolean;
  prerequisites: string[];             // IDs of prerequisite nodes
  // D3 simulation coords (mutated by simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface KnowledgeEdge {
  source: string | KnowledgeNode;
  target: string | KnowledgeNode;
  weight: number; // Encompassing weight 0–1
}

export interface RawEdge {
  from: string;
  to: string;
  weight?: number; // Encompassing weight 0–1 (Math Academy–style)
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  generatedAt: string;
}

// Leitner / topic review shape (matches DB columns)
export interface TopicReviewRecord {
  id: number;
  plan_id: string;
  week_number: number;
  day_number: number;
  subject: string;
  topics: string[];
  leitner_box: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  review_count: number;
  is_active: boolean;
}

// Minimal StudyPlan shape we need (avoids importing the full circular type)
export interface StudyPlanForGraph {
  id: string;
  examType: string;
  createdAt: string;
  schedule: Array<{
    week: number;
    focus: string;
    topics: Array<{
      day: number;
      dayName: string;
      subject: string;
      topics: string[];
      completed?: boolean;
    }>;
  }>;
  microthemes?: Array<{
    subject: string;
    topics: string[];
    subtopics: string[];
    pyqFrequency: number;
    importance: "high" | "medium" | "low";
  }>;
}

// ─── Subject Color Palette ────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, string> = {
  // PSC Core subjects
  "Indian Polity": "#2DD4BF",
  "Indian History": "#A855F7",
  "History": "#A855F7",
  "Geography": "#F97316",
  "Indian Geography": "#F97316",
  "Indian Economy": "#22D3EE",
  "Economy": "#22D3EE",
  "Science & Technology": "#FBBF24",
  "Science": "#FBBF24",
  "Environment": "#22C55E",
  "Ecology": "#22C55E",
  "Current Affairs": "#EC4899",
  "Sikkim GK": "#60A5FA",
  "Sikkim History": "#818CF8",
  "Arithmetic": "#F43F5E",
  "Maths": "#F43F5E",
  "Quantitative Aptitude": "#F43F5E",
  "General English": "#C084FC",
  "English": "#C084FC",
  "Reasoning": "#FB923C",
  "General Knowledge": "#34D399",
  // Engineering
  "Mechanics of Material": "#F97316",
  "Structural Analysis": "#F97316",
  "Fluid Mechanics": "#22D3EE",
  "Geotechnical Engineering": "#FBBF24",
  "Transportation Engineering": "#A855F7",
  "Environmental Engineering": "#22C55E",
  // Default fallback handled in getSubjectColor
};

export function getSubjectColor(subject: string): string {
  if (SUBJECT_COLORS[subject]) return SUBJECT_COLORS[subject];
  // Partial match
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (subject.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(subject.toLowerCase())) {
      return color;
    }
  }
  // Deterministic color from subject string hash
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = ["#2DD4BF", "#A855F7", "#F97316", "#22D3EE", "#FBBF24", "#22C55E", "#EC4899", "#60A5FA"];
  return palette[Math.abs(hash) % palette.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function makeNodeId(subject: string, topic: string): string {
  return `${slugify(subject)}--${slugify(topic)}`;
}

const LS_KEY = (planId: string) => `kg-edges-${planId}`;

export function saveGraphEdges(planId: string, edges: RawEdge[]): void {
  try {
    localStorage.setItem(
      LS_KEY(planId),
      JSON.stringify({ edges, generatedAt: new Date().toISOString() })
    );
  } catch {
    // localStorage may be unavailable (SSR guard)
  }
}

export function loadGraphEdges(planId: string): { edges: RawEdge[]; generatedAt: string } | null {
  try {
    const raw = localStorage.getItem(LS_KEY(planId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearGraphEdges(planId: string): void {
  try {
    localStorage.removeItem(LS_KEY(planId));
  } catch {
    // noop
  }
}

// ─── 1. Graph Builder ─────────────────────────────────────────────────────────

/**
 * Converts a StudyPlan into a KnowledgeGraphData by:
 * - Flattening schedule into unique topic nodes
 * - Loading cached prerequisite edges from localStorage
 * - Running the student model to compute node statuses
 */
export function buildGraphFromPlan(
  plan: StudyPlanForGraph,
  topicReviews: TopicReviewRecord[],
): KnowledgeGraphData {
  const nodeMap = new Map<string, KnowledgeNode>();

  // Microtheme lookup for importance + pyqFrequency
  const microthemeBySubject = new Map<string, { importance: "high" | "medium" | "low"; pyqFrequency: number }>();
  for (const mt of plan.microthemes ?? []) {
    microthemeBySubject.set(mt.subject, { importance: mt.importance, pyqFrequency: mt.pyqFrequency });
  }

  // Extract unique nodes from schedule
  for (const week of plan.schedule) {
    for (const daily of week.topics) {
      const meta = microthemeBySubject.get(daily.subject);
      for (const topicLabel of daily.topics) {
        const id = makeNodeId(daily.subject, topicLabel);
        if (!nodeMap.has(id)) {
          nodeMap.set(id, {
            id,
            label: topicLabel,
            subject: daily.subject,
            importance: meta?.importance ?? "medium",
            pyqFrequency: meta?.pyqFrequency ?? 5,
            week: week.week,
            day: daily.day,
            status: "locked",
            masteryLevel: 0,
            isOverdue: false,
            prerequisites: [],
          });
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());

  // Load cached prerequisite edges
  const cached = loadGraphEdges(plan.id);
  const rawEdges: RawEdge[] = cached?.edges ?? [];

  // Build edges list (filter to valid node IDs)
  const validIds = new Set(nodes.map((n) => n.id));
  const edges: KnowledgeEdge[] = rawEdges
    .filter((e) => validIds.has(e.from) && validIds.has(e.to))
    .map((e) => ({ source: e.from, target: e.to, weight: e.weight ?? 0.5 }));

  // Attach prerequisites list to each node (needed for status computation)
  for (const edge of rawEdges) {
    const targetNode = nodeMap.get(edge.to);
    if (targetNode && validIds.has(edge.from)) {
      if (!targetNode.prerequisites.includes(edge.from)) {
        targetNode.prerequisites.push(edge.from);
      }
    }
  }

  // Run student model
  const currentWeek = getCurrentWeek(plan);
  computeNodeStatuses(nodes, topicReviews, currentWeek);

  return { nodes, edges, generatedAt: cached?.generatedAt ?? new Date().toISOString() };
}

// ─── 2. Student Model ─────────────────────────────────────────────────────────

/**
 * Overlays Leitner box review data onto nodes and computes statuses.
 * Mutates nodes in-place (status, masteryLevel, isOverdue).
 */
function computeNodeStatuses(
  nodes: KnowledgeNode[],
  reviews: TopicReviewRecord[],
  currentWeek: number,
): void {
  const now = Date.now();

  // Build review lookup: nodeId → best leitner_box + overdue status
  const reviewMap = new Map<string, { leitner: number; overdue: boolean }>();

  for (const review of reviews) {
    for (const topicLabel of review.topics) {
      const id = makeNodeId(review.subject, topicLabel);
      const existing = reviewMap.get(id);
      const overdue = review.next_review_at
        ? new Date(review.next_review_at).getTime() < now
        : false;
      if (!existing || review.leitner_box > existing.leitner) {
        reviewMap.set(id, { leitner: review.leitner_box, overdue });
      }
    }
  }

  // Build mastery set (leitner_box >= 3 = mastered)
  const masteredIds = new Set<string>();
  for (const [id, data] of reviewMap.entries()) {
    if (data.leitner >= 3) masteredIds.add(id);
  }

  // Topological status pass — iterate until stable
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Initial pass: set mastery levels
  for (const node of nodes) {
    const review = reviewMap.get(node.id);
    node.masteryLevel = review?.leitner ?? 0;
    node.isOverdue = review?.overdue ?? false;
  }

  // Iterative status computation (handles multi-hop prerequisite chains)
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 20) {
    changed = false;
    iterations++;

    for (const node of nodes) {
      let newStatus: KnowledgeNode["status"];

      if (masteredIds.has(node.id)) {
        newStatus = "mastered";
      } else if (node.week <= currentWeek) {
        // In current or past week — mark as in-progress (student should be working on this)
        newStatus = "in-progress";
      } else if (node.prerequisites.length === 0) {
        // No prerequisites → always ready
        newStatus = "ready";
      } else {
        // All prerequisites mastered → ready
        const allPrereqsMastered = node.prerequisites.every((pid) => {
          const prereq = nodeMap.get(pid);
          return prereq?.status === "mastered";
        });
        newStatus = allPrereqsMastered ? "ready" : "locked";
      }

      if (newStatus !== node.status) {
        node.status = newStatus;
        changed = true;
      }
    }
  }
}

function getCurrentWeek(plan: StudyPlanForGraph): number {
  const daysSinceStart = Math.floor(
    (Date.now() - new Date(plan.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(1, Math.floor(daysSinceStart / 7) + 1);
}

// ─── 3. Task Selection (with Repetition Compression) ──────────────────────────

export interface TaskRecommendation {
  node: KnowledgeNode;
  score: number;
  reasons: string[];
}

/**
 * Math Academy–style task selection with repetition compression.
 *
 * Two modes running in parallel:
 * A) **New topic selection** — scores "ready" nodes by importance, PYQs, unlock potential
 * B) **Review compression** — among overdue nodes, picks the most advanced topic whose
 *    encompassing weights "knock out" the most prerequisite reviews (domino toppling)
 *
 * Returns top 3 recommendations (mix of new + review).
 */
export function selectNextTask(
  nodes: KnowledgeNode[],
  edges?: KnowledgeEdge[],
): TaskRecommendation[] {
  const importanceWeight: Record<KnowledgeNode["importance"], number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  // Build weight lookup: edge target → Map(prereq → weight)
  const weightMap = new Map<string, Map<string, number>>();
  for (const edge of edges ?? []) {
    const srcId = typeof edge.source === "string" ? edge.source : edge.source.id;
    const tgtId = typeof edge.target === "string" ? edge.target : edge.target.id;
    if (!weightMap.has(tgtId)) weightMap.set(tgtId, new Map());
    weightMap.get(tgtId)!.set(srcId, edge.weight ?? 0.5);
  }

  // ── A) New topic + general scoring ─────────────────────────────
  const candidates = nodes.filter(
    (n) => n.status === "ready" || n.status === "in-progress" || n.isOverdue
  );

  const overdueIds = new Set(nodes.filter((n) => n.isOverdue).map((n) => n.id));

  const results: TaskRecommendation[] = candidates.map((node) => {
    const reasons: string[] = [];

    const iw = importanceWeight[node.importance];
    const freqScore = node.pyqFrequency / 10;
    const overdueBonus = node.isOverdue ? 5 : 0;

    // Count locked nodes this node directly unblocks
    const unlockPotential = nodes.filter(
      (n) => n.status === "locked" && n.prerequisites.includes(node.id)
    ).length;

    // ── B) Repetition compression bonus ──────────────────────────
    // If this node has encompassing weights to overdue prerequisites,
    // practicing it implicitly reviews them — add a compression bonus.
    let compressionBonus = 0;
    let compressedCount = 0;
    const nodeWeights = weightMap.get(node.id);
    if (nodeWeights) {
      for (const [prereqId, w] of nodeWeights) {
        if (overdueIds.has(prereqId) && w >= 0.4) {
          // This advanced topic covers an overdue prerequisite
          compressionBonus += w * 3;
          compressedCount++;
        }
      }
    }

    const score = iw * freqScore + unlockPotential * 1.5 + overdueBonus + compressionBonus;

    if (node.isOverdue) reasons.push("Review overdue");
    if (compressedCount > 0) reasons.push(`Reviews ${compressedCount} prerequisite${compressedCount > 1 ? "s" : ""}`);
    if (node.pyqFrequency >= 15) reasons.push(`${node.pyqFrequency} PYQ questions`);
    if (unlockPotential > 0) reasons.push(`Unlocks ${unlockPotential} topic${unlockPotential > 1 ? "s" : ""}`);
    if (node.importance === "high" && !node.isOverdue && compressedCount === 0) reasons.push("High importance");
    if (reasons.length === 0) reasons.push("Next in schedule");

    return { node, score, reasons };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}
