export const PRODUCT_DEMO_FPS = 30;

export const PRODUCT_DEMO_DURATION_FRAMES = 1800;

export type ProductDemoScene = {
  id:
    | "intro"
    | "dashboard"
    | "planner"
    | "revision"
    | "tests"
    | "social"
    | "developers"
    | "close";
  startFrame: number;
  durationInFrames: number;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  imagePath: string;
  accent: string;
  statLabel: string;
  statValue: string;
  sceneLabel: string;
};

const durations = [180, 210, 240, 225, 255, 225, 225, 240];

const starts = durations.reduce<number[]>((acc, duration, index) => {
  const previous = index === 0 ? 0 : acc[index - 1] + durations[index - 1];
  acc.push(previous);
  return acc;
}, []);

export const productDemoScenes: ProductDemoScene[] = [
  {
    id: "intro",
    startFrame: starts[0],
    durationInFrames: durations[0],
    eyebrow: "PrepSPSC",
    title: "Serious exam prep, finally in one calm system.",
    body:
      "PrepSPSC brings the preparation loop together for Sikkim aspirants with AI guidance, measurable practice, and community accountability.",
    bullets: ["Study with AI", "Mock tests", "Study rooms"],
    imagePath: "/demo/01-landing-page.png",
    accent: "#62e6c7",
    statLabel: "Built for",
    statValue: "SPSC Aspirants",
    sceneLabel: "Positioning",
  },
  {
    id: "dashboard",
    startFrame: starts[1],
    durationInFrames: durations[1],
    eyebrow: "Daily Momentum",
    title: "The dashboard turns study effort into visible progress.",
    body:
      "XP, streaks, widgets, and weekly progress make consistency tangible the moment a learner logs in.",
    bullets: ["XP and levels", "Streaks and time", "Fast daily check-in"],
    imagePath: "/demo/02-dashboard.png",
    accent: "#4fd1ff",
    statLabel: "Signals",
    statValue: "Momentum + Habit",
    sceneLabel: "Home Surface",
  },
  {
    id: "planner",
    startFrame: starts[2],
    durationInFrames: durations[2],
    eyebrow: "AI Planner",
    title: "Turn a syllabus into the next study session in seconds.",
    body:
      "The planner organizes topics, sessions, and revision checkpoints so learners stop guessing what to do next.",
    bullets: ["Topic breakdown", "Smart session planning", "Built-in revision flow"],
    imagePath: "/demo/03-study-ai-planner.png",
    accent: "#8ab4ff",
    statLabel: "Outcome",
    statValue: "Clarity Over Chaos",
    sceneLabel: "Planning",
  },
  {
    id: "revision",
    startFrame: starts[3],
    durationInFrames: durations[3],
    eyebrow: "Active Revision",
    title: "AI turns static notes into active recall.",
    body:
      "Revision tools help transform content into summaries, blurting, quizzes, and study-ready material that supports retention.",
    bullets: ["Revision views", "Notebook support", "Faster feedback loops"],
    imagePath: "/demo/06-study-ai-revision.png",
    accent: "#ff8ed1",
    statLabel: "Focus",
    statValue: "Learn, Recall, Improve",
    sceneLabel: "Retention",
  },
  {
    id: "tests",
    startFrame: starts[4],
    durationInFrames: durations[4],
    eyebrow: "Tests Arena",
    title: "Practice against the pattern that actually matters.",
    body:
      "PrepSPSC combines PSC-focused mock tests, PYQ intelligence, and detailed feedback so learners can measure improvement, not just attempt questions.",
    bullets: ["Pattern-aware mocks", "PYQ-backed practice", "Performance visibility"],
    imagePath: "/demo/08-tests-arena.png",
    accent: "#ff9b7a",
    statLabel: "Depth",
    statValue: "7,442 PYQs",
    sceneLabel: "Assessment",
  },
  {
    id: "social",
    startFrame: starts[5],
    durationInFrames: durations[5],
    eyebrow: "Study Rooms",
    title: "Self-study feels lighter when accountability is built in.",
    body:
      "Study rooms and buddies create a quiet social layer that keeps preparation consistent without turning the product into noise.",
    bullets: ["Live rooms", "Buddy accountability", "Focused atmosphere"],
    imagePath: "/demo/09-study-rooms.png",
    accent: "#ffc46d",
    statLabel: "Feeling",
    statValue: "Less Alone, More Consistent",
    sceneLabel: "Community",
  },
  {
    id: "developers",
    startFrame: starts[6],
    durationInFrames: durations[6],
    eyebrow: "Developer API",
    title: "The product intelligence is also available as an API.",
    body:
      "A self-serve developer portal opens semantic PYQ search, mock tests, analytics, and API key management beyond the student app itself.",
    bullets: ["Self-serve keys", "Semantic search", "Mock test endpoints"],
    imagePath: "/demo/07-developers.png",
    accent: "#b89cff",
    statLabel: "Expansion",
    statValue: "Product + Platform",
    sceneLabel: "Differentiation",
  },
  {
    id: "close",
    startFrame: starts[7],
    durationInFrames: durations[7],
    eyebrow: "The Loop",
    title: "Plan. Revise. Test. Stay consistent.",
    body:
      "PrepSPSC gives aspirants a calmer, smarter way to prepare with one connected loop from planning to performance.",
    bullets: ["Premium pacing", "Grounded in real prep", "Built to keep going"],
    imagePath: "/demo/01-landing-page.png",
    accent: "#7cf1b8",
    statLabel: "Message",
    statValue: "One Connected Prep Loop",
    sceneLabel: "Closing",
  },
];

export const summarizeValueProps = () => [
  "One preparation loop from planning to PYQs to tests",
  "AI study tools that turn static material into active revision",
  "Gamified dashboards that make consistency and momentum visible",
  "Study rooms and buddies that add accountability without noise",
  "A developer API built on real PSC question intelligence",
];
