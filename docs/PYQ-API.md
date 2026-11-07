# PrepSPSC PYQ API

A semantic search API + mock test generator for 7,400+ Previous Year Questions from Sikkim PSC (SPSC) competitive exams. Built on pgvector embeddings for intelligent, meaning-based question retrieval. Designed to also serve as an **AI question generation reference** — fetch real PYQs with rich metadata (topics, cognitive levels, difficulty) and use them as few-shot examples to generate fresh questions.

---

## What We Built

### The Problem

Sikkim PSC aspirants have no centralized, searchable question bank. PYQ papers exist as scattered PDFs across government websites — hard to search, impossible to query by topic, and useless for building study tools.

### The Solution

We built a complete pipeline:

1. **Scraped 327 PYQ PDFs** from the official SPSC Question Bank
2. **Extracted 7,400+ structured MCQs** using Gemini AI (question text, options, correct answer, subject, difficulty, exam year)
3. **Generated vector embeddings** for every question using `gemini-embedding-001` (768-dimensional)
4. **Stored everything in PostgreSQL** with pgvector for fast cosine similarity search
5. **Exposed it as a REST API** with API key auth, rate limiting, and usage tracking

The result: ask a natural language question like *"questions about Fundamental Rights"* and get back the most semantically relevant PYQs — not just keyword matches, but questions that are *about* the same concept.

---

## Why This Matters

### For AI Agents

AI agents building study tools, tutoring systems, or exam prep bots need access to real exam data — not generated questions. This API gives them:

- **Real exam questions** with verified answers and explanations
- **Semantic search** — agents can query by concept, not just keywords
- **Structured output** — clean JSON that LLMs can reason over directly
- **Rich metadata** — `topics[]`, `cognitive_level`, `difficulty`, `high_yield` per question
- **AI generation reference** — use real PYQs as few-shot examples to generate fresh questions
- **Time-sensitive filtering** — `year_min` parameter auto-excludes stale current affairs
- **Pagination** — `exclude_ids` parameter for "show me more" flows
- **Auto-discovery** — standard `.well-known/` files so agent platforms find the API automatically

Example agent workflow — **using API as reference for question generation:**
```
User: "Generate practice questions on Fundamental Rights"
Agent: [calls search_pyq_questions("Fundamental Rights", "Indian Polity", limit=5)]
Agent: → Gets 5 real PYQs with topics, cognitive_level, difficulty
Agent: → Uses those as few-shot examples + metadata to generate 20 new questions
Agent: "Here are 20 fresh practice questions based on real SPSC exam patterns..."
```

The agent uses **its own AI** to generate questions — your API just provides the reference data. This means zero Gemini cost for you.

### For App Developers

Developers building Sikkim exam prep apps get a ready-made question bank API:

- **No data collection needed** — 7,400+ questions already extracted and verified
- **27 subjects covered** — from Indian Polity to Botany to Nepali Literature
- **Exam metadata** — year, stage (Prelims/Mains), difficulty, high-yield flags
- **Topic & cognitive data** — `topics[]` array and `cognitive_level` (remember/understand/apply/analyze)
- **Time-sensitive filtering** — stale current affairs auto-excluded from mock tests
- **AI generation ready** — use questions as templates for your own AI question generator
- **OpenAPI spec** — auto-generate typed clients in any language
- **Generous free tier** — 1,000 requests/month for hobby projects

---

## API Reference

**Base URL:** `https://qqqditxzghqzodvauxth.supabase.co/functions/v1`

### Authentication

All requests require an API key in the Authorization header:

```
Authorization: Bearer sk_live_<32 hex chars>
```

Get a key from the PrepSPSC admin panel or contact support@prepspsc.com.

### Tiers

| Tier | Requests/Minute | Monthly Quota | Use Case |
|------|----------------|---------------|----------|
| Free | 10 | 1,000 | Personal agents, hobby projects |
| Paid | 60 | 50,000 | Study apps, small platforms |
| Enterprise | 500 | Unlimited | Large-scale integrations |

---

### POST /pyq-api — Semantic Search

Search questions using natural language. Returns results ranked by semantic similarity.

**Request:**

```json
{
  "query": "Fundamental Rights Article 21",
  "subject": "Indian Polity",
  "limit": 5,
  "threshold": 0.3,
  "year_min": 2024,
  "exclude_ids": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Natural language search query (min 3 chars) |
| `subject` | string | Yes | Subject filter (use GET to list available subjects) |
| `limit` | integer | No | Max results, 1-20 (default: 8) |
| `threshold` | float | No | Min similarity score, 0-1 (default: 0.3) |
| `year_min` | integer | No | Exclude time-sensitive questions older than this year. Non-time-sensitive questions (polity, science) are never filtered. |
| `exclude_ids` | string[] | No | Question UUIDs to skip (for pagination) |

**Response:**

```json
{
  "questions": [
    {
      "id": "faf5053e-b94a-4b0a-b5c5-65a08bb539a8",
      "question": "Who among the following advices the government of India on legal matters?",
      "options": [
        {"id": "a", "text": "Speaker of the Lok Sabha"},
        {"id": "b", "text": "Governor of the Reserve Bank of India"},
        {"id": "c", "text": "President"},
        {"id": "d", "text": "Attorney General"}
      ],
      "correct_option_id": "d",
      "explanation": "Under Article 76, the Attorney General is the chief legal advisor...",
      "exam_name": "SPSC",
      "exam_year": 2025,
      "difficulty": "easy",
      "high_yield": true,
      "topics": ["Attorney General", "Article 76", "Constitutional Bodies"],
      "cognitive_level": "remember",
      "is_time_sensitive": false,
      "similarity": 0.87
    }
  ],
  "count": 5,
  "search_time_ms": 312
}
```

---

### GET /pyq-api — List Subjects

Returns all available subjects with question counts.

**Response:**

```json
{
  "subjects": [
    {"name": "General English", "count": 38},
    {"name": "Nepali Literature", "count": 21},
    {"name": "General Knowledge", "count": 13},
    {"name": "Geography", "count": 10},
    {"name": "Science", "count": 10},
    {"name": "History", "count": 5},
    {"name": "Indian Polity", "count": 4}
  ],
  "exam_names": ["SPSC"]
}
```

---

### Error Responses

All errors follow the same format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `MISSING_API_KEY` | 401 | No Authorization header |
| `INVALID_API_KEY` | 401 | Key not found |
| `KEY_SUSPENDED` | 403 | Key revoked or suspended |
| `KEY_EXPIRED` | 403 | Key past expiry date |
| `RATE_LIMITED` | 429 | Too many requests (check Retry-After header) |
| `QUOTA_EXCEEDED` | 429 | Monthly quota used up |
| `VALIDATION_ERROR` | 400 | Bad request body |
| `INTERNAL_ERROR` | 500 | Server error |

---

### POST /pyq-api/mock-test — Generate Mock Test

Generate a complete mock test following real SPSC exam patterns. One API call = one full test.

**Request:**

```json
{
  "pattern": "undersecretary-prelims",
  "difficulty_mix": { "easy": 30, "medium": 50, "hard": 20 },
  "year_min": 2024,
  "exclude_ids": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pattern` | string | Yes | Exam pattern (64 available). Use `GET /pyq-api/patterns` to see all. Examples: `undersecretary-prelims`, `gdmo`, `ldc-prelims`, `assistant-engineer-civil`, `staff-nurse`, `digital-analyst` |
| `difficulty_mix` | object | No | Custom difficulty % (default: 30/50/20 easy/medium/hard) |
| `year_min` | integer | No | Exclude time-sensitive questions older than this year. Defaults to `current_year - 2`. |
| `exclude_ids` | string[] | No | Skip questions from previous tests |

**Response:**

```json
{
  "test": {
    "name": "Under Secretary Preliminary Examination",
    "description": "SPSC Under Secretary Prelims — General Studies paper...",
    "pattern": "undersecretary-prelims",
    "total_questions": 95,
    "target_questions": 100,
    "duration_minutes": 120,
    "negative_marking": true,
    "negative_mark_value": 0.25,
    "marks_per_question": 1,
    "total_marks": 95
  },
  "sections": [
    {
      "subject": "Indian Polity",
      "target_count": 15,
      "actual_count": 15,
      "questions": [/* full question objects */]
    },
    {
      "subject": "History",
      "target_count": 15,
      "actual_count": 12,
      "questions": [/* ... */]
    }
  ],
  "generation_time_ms": 3369
}
```

### Available Exam Patterns (64 Total)

Use `GET /pyq-api/patterns` to get the full list with subject distribution details.

| Category | Pattern IDs | Count |
|----------|------------|-------|
| **Core / General** | `undersecretary-prelims`, `general-prelims`, `spsc-mains-gs1`, `spsc-mains-gs2`, `quick-practice-30` | 5 |
| **Civil Services** | `sscs-prelims`, `combined-mains-gs3`, `combined-mains-english` | 3 |
| **Police / Law** | `si-police-prelims`, `si-police-mains`, `si-excise`, `sub-jailer` | 4 |
| **Fire Service** | `sub-fire-officer` | 1 |
| **Engineering** | `junior-engineer-prelims`, `assistant-engineer-civil`, `assistant-engineer-electrical`, `assistant-engineer-mechanical`, `assistant-engineer-agriculture` | 5 |
| **Medical / Health** | `gdmo`, `veterinary-officer`, `dental-surgeon`, `specialist-sr-grade`, `staff-nurse`, `paramedical`, `health-educator`, `mphw`, `drug-inspector`, `food-safety-officer`, `pharmacist-ayush`, `yoga-instructor-ayush`, `scientific-officer-ayush`, `tutor-clinical-instructor` | 14 |
| **Administrative** | `ldc-prelims`, `accounts-clerk`, `stenographer`, `cooperative-inspector`, `statistical-inspector`, `revenue-inspector`, `revenue-surveyor`, `commercial-tax-inspector` | 8 |
| **Forestry / Fisheries** | `forest-ranger-prelims`, `fisheries-officer`, `assistant-director-fisheries`, `livestock-assistant` | 4 |
| **Education** | `lecturer-diet`, `iti-instructor`, `principal-iti`, `assistant-professor-sheda` | 4 |
| **Other Specialized** | `assistant-town-planner`, `assistant-architect`, `assistant-geologist`, `digital-analyst`, `assistant-programmer`, `assistant-director-it`, `lab-assistant`, `field-assistant`, `ado-wdo-hdo`, `senior-information-assistant`, `sub-editor`, `inspector-legal-metrology`, `photographer`, `script-writer`, `feed-mill-operator`, `printing-stationery` | 16 |

### GET /pyq-api/patterns — List Exam Patterns

Returns available exam patterns with subject distribution. Use the `id` as the `pattern` parameter in mock-test.

---

## User Flows

### Flow 1: AI Agent on Telegram (OpenClaw)

**User says:** "Generate me a mock test for Sikkim SPSC Undersecretary exam"

```
User (Telegram)
  │
  ▼
OpenClaw Agent
  │ 1. Parses intent: "mock test" + "SPSC" + "Undersecretary"
  │ 2. Discovers PrepSPSC API via /.well-known/agents.json
  │ 3. Reads tool definitions from /.well-known/mcp.json
  │
  ▼ Step 1: Agent calls GET /pyq-api/patterns
  │ → Finds "undersecretary-prelims" pattern
  │
  ▼ Step 2: Agent calls POST /pyq-api/mock-test
  │ → {"pattern": "undersecretary-prelims"}
  │ → Gets back 95 questions in 8 sections, with scoring rules
  │
  ▼ Step 3: Agent formats and presents the test
  │
  ▼ Returns to Telegram:

  📝 SPSC Undersecretary Mock Test
  100 Questions | 120 min | -0.25 per wrong answer

  Section A: Indian Polity (15 Qs)
  1. Who advises the Government of India on legal matters?
     a) Speaker of Lok Sabha  b) RBI Governor
     c) President  d) Attorney General

  2. Which Article guarantees Right to Life...
  ...

  Section B: History (15 Qs)
  ...

  Say "show answers" when done ✅
```

**User says:** "show answers" →

```
  ✅ Answer Key + Explanations

  Section A: Indian Polity — Score: 12/15
  1. ✅ d) Attorney General (Article 76)
  2. ❌ You: c) | Correct: b) Article 21
     → Article 21 guarantees Right to Life and Personal Liberty...

  Your Score: 72/95 (75.8%)
  After negative marking: 72 - (23 × 0.25) = 66.25/95
```

**User says:** "Generate another test, but harder" →

```
Agent calls POST /pyq-api/mock-test with:
{
  "pattern": "undersecretary-prelims",
  "difficulty_mix": { "easy": 10, "medium": 40, "hard": 50 },
  "exclude_ids": [<all question IDs from previous test>]
}
→ Gets a fresh, harder test with no repeated questions
```

### Flow 2: App Developer Building an SPSC Exam App

**Day 1: Discovery & Setup**

```bash
# Developer finds the API
curl https://prepspsc.com/.well-known/agents.json
# → Sees: "PrepSPSC PYQ API", 7400+ questions, semantic search + mock tests

# Gets the OpenAPI spec
curl https://prepspsc.com/openapi.yaml
# → Full API definition — auto-generate typed clients

# Gets a free API key
npx tsx scripts/manage-api-keys.ts generate --email dev@example.com --name "SikkimPrep App" --tier free
# → sk_live_abc123...
```

**Day 2: Build the App**

```typescript
const API = "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api";
const KEY = process.env.PYQ_API_KEY;
const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// 1. Show available subjects on home screen
const subjects = await fetch(API, { headers }).then(r => r.json());

// 2. Topic-wise practice
const polityQs = await fetch(API, {
  method: "POST", headers,
  body: JSON.stringify({ query: "Fundamental Rights", subject: "Indian Polity", limit: 10 })
}).then(r => r.json());

// 3. One-click mock test
const mockTest = await fetch(`${API}/mock-test`, {
  method: "POST", headers,
  body: JSON.stringify({ pattern: "undersecretary-prelims" })
}).then(r => r.json());

// mockTest.test → scoring rules, duration, negative marking
// mockTest.sections → questions grouped by subject
// App handles: timer, answer tracking, score calculation
```

**What the App Looks Like:**

```
┌─────────────────────────────────────────┐
│  🎓 SikkimPrep — SPSC Exam Prep         │
├─────────────────────────────────────────┤
│                                         │
│  📝 Mock Tests                          │
│  ┌────────────────────────────────────┐ │
│  │ Under Secretary Prelims            │ │
│  │ 100 Qs · 120 min · -0.25 marking  │ │
│  │ [Start Test →]                     │ │
│  ├────────────────────────────────────┤ │
│  │ SI Police Prelims                  │ │
│  │ 100 Qs · 120 min · -0.25 marking  │ │
│  │ [Start Test →]                     │ │
│  ├────────────────────────────────────┤ │
│  │ General Prelims                    │ │
│  │ 80 Qs · 90 min · -0.25 marking    │ │
│  │ [Start Test →]                     │ │
│  └────────────────────────────────────┘ │
│                                         │
│  📚 Subject-wise Practice               │
│  [Indian Polity] [History] [GK] [Sci]   │
│                                         │
│  🔍 Search: "Article 370"              │
│                                         │
│  📊 Your Progress                       │
│  Tests taken: 5 | Avg score: 72%       │
│  Strongest: Polity | Weakest: Economy   │
└─────────────────────────────────────────┘
```

**Developer's scoring logic (client-side):**

```typescript
function calculateScore(answers: Record<string, string>, test: MockTestResponse) {
  let correct = 0, wrong = 0, unanswered = 0;

  for (const section of test.sections) {
    for (const q of section.questions) {
      const userAnswer = answers[q.id];
      if (!userAnswer) { unanswered++; continue; }
      if (userAnswer === q.correct_option_id) correct++;
      else wrong++;
    }
  }

  const rawScore = correct * test.test.marks_per_question;
  const penalty = wrong * test.test.negative_mark_value;
  const finalScore = rawScore - penalty;

  return { correct, wrong, unanswered, rawScore, penalty, finalScore, total: test.test.total_marks };
}
// → { correct: 72, wrong: 18, unanswered: 5, rawScore: 72, penalty: 4.5, finalScore: 67.5, total: 95 }
```

---

## Integration Guides

### Claude Tool Use

Define the API as a tool in your Claude integration:

```json
{
  "name": "search_pyq_questions",
  "description": "Search 7,400+ previous year questions from Sikkim PSC exams using semantic similarity. Returns MCQs with answers, explanations, topics, and cognitive levels. Use as reference for AI question generation.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language search (e.g., 'photosynthesis', 'Article 370', 'Sikkim history')"
      },
      "subject": {
        "type": "string",
        "description": "Subject to filter by (e.g., 'Indian Polity', 'Science', 'History')"
      },
      "limit": {
        "type": "integer",
        "default": 5
      },
      "year_min": {
        "type": "integer",
        "description": "Exclude time-sensitive questions older than this year (e.g., 2024)"
      }
    },
    "required": ["query", "subject"]
  }
}
```

Your Claude agent makes a POST request to the API and gets questions with rich metadata (`topics`, `cognitive_level`, `difficulty`) — either to show directly or to use as reference for generating fresh questions.

### OpenAI GPT Actions

1. Go to GPT Builder → Actions → Import from URL
2. Enter: `https://prepspsc.com/openapi.yaml`
3. Set auth type to "API Key" with Bearer scheme
4. The GPT auto-generates search and list tools

### LangChain / Python

```python
import requests

API_KEY = "sk_live_your_key_here"
BASE_URL = "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api"

def search_pyq(query: str, subject: str, limit: int = 5):
    response = requests.post(
        BASE_URL,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "query": query,
            "subject": subject,
            "limit": limit
        }
    )
    response.raise_for_status()
    return response.json()

# Example
results = search_pyq("Indian Constitution amendments", "Indian Polity")
for q in results["questions"]:
    print(f"[{q['exam_year']}] {q['question']}")
    print(f"  Answer: {q['correct_option_id']}) {q['explanation']}")
```

### TypeScript / Next.js

```typescript
const PYQ_API = "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api";

async function searchPYQ(query: string, subject: string, limit = 5) {
  const res = await fetch(PYQ_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.PYQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, subject, limit }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error.message);
  }

  return res.json();
}

// "Load More" pattern using exclude_ids
async function loadMore(query: string, subject: string, seenIds: string[]) {
  return searchPYQ(query, subject, 5);
  // Pass exclude_ids in the body to skip already-shown questions
}
```

### Auto-Generate Typed Clients

From the OpenAPI spec:

```bash
# Python client
pip install openapi-python-client
openapi-python-client generate --url https://prepspsc.com/openapi.yaml

# TypeScript client
npx orval --input https://prepspsc.com/openapi.yaml --output ./src/api/pyq

# Any language
npx @openapitools/openapi-generator-cli generate \
  -i https://prepspsc.com/openapi.yaml \
  -g <language> \
  -o ./pyq-client
```

---

## Using the API as an AI Question Generation Reference

The API is designed so that **external AI agents and app builders can use real PYQs as a reference to generate fresh questions** — without consuming your Gemini tokens.

### How It Works

```
┌──────────────────────────────────────────────────────────┐
│  External AI Agent / App Builder                          │
│                                                           │
│  1. GET /pyq-api/patterns → exam structure                │
│  2. POST /pyq-api → fetch real PYQs as few-shot examples  │
│  3. Extract: topics, cognitive_level, difficulty, format   │
│  4. Use THEIR OWN AI to generate new questions             │
│  5. Match the MCQ format: question + 4 options + answer    │
│                                                           │
│  Cost to you: 1 embedding call per search query            │
│  Cost to them: their own AI tokens for generation          │
└──────────────────────────────────────────────────────────┘
```

### Key Fields for Generation

Each question returned by the API includes metadata that helps calibrate AI-generated questions:

| Field | Type | Description | Use for Generation |
|-------|------|-------------|-------------------|
| `topics` | string[] | Specific topics covered (e.g., `["Article 21", "Right to Life"]`) | Target what to ask about |
| `cognitive_level` | string | `remember`, `understand`, `apply`, `analyze` | Match thinking depth |
| `difficulty` | string | `easy`, `medium`, `hard` | Calibrate question difficulty |
| `high_yield` | boolean | Whether topic is frequently tested | Prioritize important topics |
| `is_time_sensitive` | boolean | Whether content may become outdated | Avoid stale current affairs |
| `question_type` | string | MCQ format with 4 options | Match question format |

### Example: Agent Generating Fresh Questions

```python
import requests
from openai import OpenAI  # or any LLM

# Step 1: Fetch reference questions from PrepSPSC API
ref_questions = requests.post(
    "https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"query": "Fundamental Rights", "subject": "Indian Polity", "limit": 5}
).json()

# Step 2: Build a prompt using real PYQs as examples
examples = "\n".join([
    f"Q: {q['question']}\nTopics: {q['topics']}\nDifficulty: {q['difficulty']}\n"
    f"Cognitive Level: {q['cognitive_level']}\nOptions: {q['options']}\nAnswer: {q['correct_option_id']}"
    for q in ref_questions["questions"]
])

# Step 3: Generate new questions using YOUR AI (your tokens, not PrepSPSC's)
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": f"""Generate 10 new MCQ questions about Indian Polity - Fundamental Rights.
Use these real SPSC exam questions as a reference for format, difficulty, and style:

{examples}

Requirements:
- Match the difficulty distribution: 3 easy, 5 medium, 2 hard
- Include cognitive levels: mix of remember, understand, and apply
- Each question must have exactly 4 options (a, b, c, d)
- Include a brief explanation for each correct answer
- Output as JSON array"""
    }]
)
```

### Question Format Standard

When generating questions, match this format:

```json
{
  "question": "The full question text",
  "options": [
    {"id": "a", "text": "Option A"},
    {"id": "b", "text": "Option B"},
    {"id": "c", "text": "Option C"},
    {"id": "d", "text": "Option D"}
  ],
  "correct_option_id": "b",
  "explanation": "Why option B is correct...",
  "difficulty": "medium",
  "cognitive_level": "understand",
  "topics": ["Topic 1", "Topic 2"]
}
```

### Time-Sensitive Question Filtering

Questions about current affairs, awards, appointments, and other time-bound content are tagged as `is_time_sensitive: true`. The API auto-filters these:

- **Mock tests** (`/pyq-api/mock-test`): defaults to `year_min = current_year - 2` (e.g., 2024+ in 2026)
- **Search** (`/pyq-api`): no default filtering — pass `year_min` explicitly if needed
- **1,022 questions** are tagged as time-sensitive (General Knowledge, Current Affairs, etc.)
- **Non-time-sensitive** questions (Indian Polity, History, Science) are **never** filtered by year

---

## Agent Discovery

The API is auto-discoverable at standard `.well-known` paths:

| File | Protocol | Purpose |
|------|----------|---------|
| `/.well-known/ai-plugin.json` | OpenAI Plugin | GPT Actions, OpenClaw, AutoGPT |
| `/.well-known/agents.json` | Agent Registry | OpenClaw, agent crawlers |
| `/.well-known/mcp.json` | Claude MCP | Claude Desktop, MCP-based agents |
| `/openapi.yaml` | OpenAPI 3.1 | Universal — codegen, Postman, all agent frameworks |

Agents that crawl your domain will automatically find the API, understand its capabilities, and generate tool definitions — no manual configuration needed.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    External Consumer                     │
│         (AI Agent / Study App / Developer)               │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /pyq-api
                       │ Authorization: Bearer sk_live_...
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Supabase Edge Function: pyq-api             │
│                                                          │
│  1. Validate API key (SHA-256 hash → external_api_keys)  │
│  2. Check rate limit (Upstash Redis sliding window)      │
│  3. Check monthly quota (api_key_quotas)                 │
│  4. Generate query embedding (Gemini embedding-001)      │
│  5. Vector search (pgvector cosine similarity)           │
│  6. Log usage (fire-and-forget)                          │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌─────────┐ ┌──────────┐
   │  Supabase  │ │ Upstash │ │  Gemini  │
   │ PostgreSQL │ │  Redis  │ │ Embed API│
   │ + pgvector │ │  (RPM)  │ │  (768d)  │
   └────────────┘ └─────────┘ └──────────┘
```

### Data Pipeline

```
327 SPSC PYQ PDFs
       │
       ▼ Gemini 3 Flash (PDF extraction)
       │
  7,400+ structured MCQs
       │
       ▼ Gemini Embedding-001 (768 dims)
       │
  pgvector HNSW index (cosine distance)
       │
       ▼ search_pyq_semantic() SQL function
       │
  Ranked results by semantic similarity
```

---

## Data Coverage

| Metric | Value |
|--------|-------|
| Total Questions | 7,442 |
| Embedding Coverage | 100% |
| Time-Sensitive Tagged | 1,022 |
| Unique Subjects | 27 |
| Source PDFs | 327 |
| Exam Source | Sikkim PSC (SPSC) |
| Vector Dimensions | 768 |
| Similarity Index | HNSW (cosine) |
| Exam Patterns | 64 |
| API Version | 5.0.0 |

### Top Subjects

| Subject | Questions |
|---------|-----------|
| Current Affairs | 165 |
| Agriculture | 119 |
| Botany | 100 |
| Computer Science | 91 |
| Business Management | 62 |
| Civil Engineering | 52 |
| Animal Husbandry | 50 |
| Anthropology | 50 |
| Chemistry | 50 |
| Accountancy | 46 |

---

## Admin Management

### CLI (for developers)

```bash
# Generate a key
npx tsx scripts/manage-api-keys.ts generate \
  --email dev@example.com --name "My App" --tier free

# List all keys
npx tsx scripts/manage-api-keys.ts list

# View usage stats
npx tsx scripts/manage-api-keys.ts stats --prefix sk_live_abcd1234

# Revoke a key
npx tsx scripts/manage-api-keys.ts revoke --prefix sk_live_abcd1234
```

### Admin Dashboard

Visit `/admin/api-keys` (admin role required) to:
- View all API keys with status, tier, and usage
- Generate new keys (shown once, then only the prefix is stored)
- Revoke keys
- View per-key usage stats and monthly breakdown

---

## What's Built vs What's Next

### Built (v5.0)

| Feature | Status |
|---------|--------|
| Semantic search (POST /pyq-api) | Done |
| Mock test generation (POST /pyq-api/mock-test) | Done |
| Difficulty-balanced question selection | Done |
| Exam paper patterns (Undersecretary, SI Police, General) | Done |
| Negative marking metadata | Done |
| Scoring rules in response (marks_per_question, negative_mark_value) | Done |
| `exclude_ids` for no-repeat across tests | Done |
| Custom difficulty mix (easy/medium/hard %) | Done |
| Agent auto-discovery (.well-known/) | Done |
| API key auth + rate limiting + usage tracking | Done |
| Admin dashboard for key management | Done |
| Rich metadata: `topics[]`, `cognitive_level`, `is_time_sensitive` | Done (v3.0) |
| Time-sensitive question tagging (1,022 questions auto-tagged) | Done (v3.0) |
| `year_min` filtering for stale current affairs | Done (v3.0) |
| AI question generation reference (discovery files + docs) | Done (v3.0) |
| Progress tracking (POST/GET /pyq-api/progress) | Done (v4.0) |
| Performance analytics (GET /pyq-api/analytics) | Done (v4.0) |
| Leaderboard API (GET /pyq-api/leaderboard) | Done (v4.0) |
| Bookmarks (POST/GET/DELETE /pyq-api/bookmarks) | Done (v4.0) |
| Self-service developer key portal (/developers) | Done (v4.0) |
| **64 exam patterns (Civil Services, Police, Medical, Engineering, Education, IT, and 50+ more)** | **Done (v5.0)** |
| **Specialist paper support (GDMO, Dental Surgeon, Veterinary, Pharmacist, etc.)** | **Done (v5.0)** |

### Future Roadmap

- **More exam sources** — UPSC, SSC, state PSCs beyond Sikkim
- **Timer endpoint** — server-side timer with WebSocket for real-time countdown
- **Webhook notifications** — alert key owners on quota thresholds
- **Batch search** — multiple queries in a single request
- **Answer explanation generation** — on-demand AI explanations for questions missing them
