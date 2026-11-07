# CLAUDE.md

## ALWAYS ACTIVE RULES

1. **ALWAYS use systematic-debugging for any bug/error**
   - Never change code without understanding WHY it's broken
   - Reproduce → Root Cause → Hypotheses → Fix
   - No random guessing or trial-and-error

2. **ALWAYS use test-driven-development for new features**
   - RED → GREEN → REFACTOR
   - Write test first, see it fail, then write code

---

## Project Overview

**PrepSPSC** — a gamified, social study platform for competitive exam preparation (Sikkim PSC, UPSC, State PSCs, JEE, NEET). Built with Next.js 16, TypeScript, React 19, Supabase, and Google Gemini AI.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.3 (App Router) |
| Language | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS v4, Radix UI, Shadcn/UI |
| State | Zustand 5 |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| AI | Google Gemini (`@google/generative-ai@0.21.0`) |
| Payments | Razorpay |
| Mobile | Capacitor 8 |
| Charts | Recharts, D3, Markmap |

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint

# Supabase Edge Functions
npx supabase functions deploy <function-name> --project-ref <your-project-ref>

# PYQ API (uses --no-verify-jwt because it handles auth via API keys)
npx supabase functions deploy pyq-api --project-ref <your-project-ref> --no-verify-jwt
npx supabase functions deploy mock-test --project-ref <your-project-ref>

# PYQ Ingestion
npx tsx scripts/ingest-pyqs.ts --pdf ./papers/file.pdf --verify
npx tsx scripts/backfill-pyq-embeddings.ts
```

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── (auth)/          # Auth routes (login, signup)
│   ├── (main)/          # Protected app routes
│   │   └── tests/       # Mock test UI
│   ├── admin/           # Admin dashboard (API key management)
│   ├── developers/      # Self-service developer portal (API key generation)
│   └── api/             # API routes
├── components/
│   ├── ui/              # Shadcn/UI primitives
│   ├── study-ai/        # AI study tools (planner, guided-learning)
│   ├── tests/           # Mock test components (test-card, etc.)
│   ├── gamification/    # XP, streaks, achievements
│   └── ...
├── stores/              # Zustand stores
├── hooks/               # Custom React hooks
├── lib/
│   ├── supabase/        # Supabase clients
│   ├── gemini.ts        # Gemini AI config
│   └── utils.ts         # Utilities (cn, etc.)
└── types/               # TypeScript types

public/
├── .well-known/
│   ├── agents.json      # AI agent discovery (agent protocol)
│   └── mcp.json         # MCP tool discovery
└── openapi.yaml         # OpenAPI 3.1 spec for PYQ API

docs/
└── PYQ-API.md           # Full API documentation (v5.0)

supabase/
└── functions/           # Supabase Edge Functions
    ├── generate-topic-content/   # PYQ, Quiz, Summary generation
    ├── guided-learning/          # AI tutoring chat
    ├── pyq-api/                  # External PYQ API (key auth, rate limiting)
    └── mock-test/                # Mock test generation (64 exam patterns)

scripts/
├── ingest-pyqs.ts               # PDF → PYQ ingestion pipeline
└── backfill-pyq-embeddings.ts   # Embedding backfill for pgvector
```

## Key Architecture Patterns

### Supabase Edge Functions (Important!)
Edge Functions bypass Vercel's 10s timeout for AI generation.

**Internal functions** (generate-topic-content, guided-learning) require:
- `Authorization: Bearer <jwt_token>` header
- `apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>` header

**External API** (pyq-api) uses custom API key auth (`sk_live_*`), deployed with `--no-verify-jwt`.

```typescript
// Correct way to call Edge Functions
const response = await fetch(EDGE_FUNCTION_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  },
  body: JSON.stringify({ ... }),
});
```

### AI Model Configuration
- **Model**: `gemini-3-flash-preview` (preferred)
- **SDK Version**: `@google/generative-ai@0.21.0`
- **Note**: `responseMimeType: "application/json"` is NOT supported in SDK 0.21.0

### State Management
- Zustand stores in `src/stores/`
- Each feature has its own store
- Use `createClient()` from `@/lib/supabase/client` (client-side)

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# AI
GOOGLE_GEMINI_API_KEY=<gemini_api_key>  # For Edge Functions

# Payments
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
```

## Key Conventions

- **Path alias:** `@/*` maps to `./src/*`
- **Icons:** Use `lucide-react`
- **Notifications:** Use `sonner` toast
- **Animations:** Use `framer-motion`
- **Theme:** Dark mode default (`#09090b`)

## Current Known Issues

See [TODO.md](./TODO.md) for active issues and planned features.

---

## Debugging Protocol

When debugging issues, follow this systematic approach:

1. **OBSERVE** — Exact error message, stack trace, when it fails vs works
2. **ROOT CAUSE** — Trace backwards from error, find where actual ≠ expected
3. **HYPOTHESES** — List 2-4 possible causes ranked by likelihood
4. **TEST** — Verify each hypothesis one at a time
5. **FIX** — Apply minimal fix for confirmed cause
6. **VERIFY** — Confirm fix works, no regressions

### Anti-Patterns (NEVER DO)
- Change random things hoping it works
- Fix symptoms instead of root cause
- Multiple changes at once
- Assume you know the problem without evidence

---

## Feature-Specific Notes

### PYQ RAG Pipeline & External API (v5.0)
- **7,442 PYQs** from 327 SPSC PDFs, 27 subjects, 100% embedding coverage
- **pgvector** with `vector(768)` columns + HNSW cosine index
- **Embedding model:** `gemini-embedding-001` (768 dims, NOT text-embedding-004)
- **Edge Function:** `supabase/functions/pyq-api/index.ts` — external API with key auth + rate limiting
- **Mock Tests:** `supabase/functions/mock-test/index.ts` — 64 exam patterns with difficulty balancing
- **Auth:** API keys (`sk_live_*`), hashed in DB, rate-limited per tier (free/paid/enterprise)
- **Deploy:** `npx supabase functions deploy pyq-api --project-ref <your-project-ref> --no-verify-jwt`
- **Docs:** `docs/PYQ-API.md`, OpenAPI at `public/openapi.yaml`
- **Ingestion:** `npx tsx scripts/ingest-pyqs.ts --pdf ./papers/file.pdf --verify`
- **Backfill:** `npx tsx scripts/backfill-pyq-embeddings.ts`

### PYQ API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pyq-api` | GET | List subjects with question counts |
| `/pyq-api` | POST | Semantic search (vector + keyword hybrid) |
| `/pyq-api/mock-test` | POST | Generate mock test (64 exam patterns) |
| `/pyq-api/patterns` | GET | List exam patterns with subject distribution |
| `/pyq-api/progress` | POST/GET | Record/retrieve user answer history |
| `/pyq-api/analytics` | GET | Performance analytics by subject/difficulty |
| `/pyq-api/leaderboard` | GET | Rankings by correct answers/accuracy |
| `/pyq-api/bookmarks` | POST/GET/DELETE | Manage bookmarked questions |

### AI Agent Discovery & ClawHub
- **Agent protocol:** `public/.well-known/agents.json`
- **MCP tools:** `public/.well-known/mcp.json` (7 tools defined)
- **OpenAPI:** `public/openapi.yaml` (v5.0)
- **ClawHub:** Published as `prepspsc-pyq@1.0.0` on ClawHub registry
- **Skill definition:** `clawhub-skill/prepspsc-pyq/SKILL.md`

### Developer Portal
- **Path:** `src/app/developers/page.tsx`
- **Features:** Self-service API key generation, usage stats, code examples
- **Admin:** `src/app/admin/` — key management, per-key usage, revocation

### Study Planner / Topic Study Panel
- **File:** `src/components/study-ai/planner/topic-study-panel.tsx`
- **Edge Function:** `generate-topic-content` for PYQ/Quiz/Summary
- **PYQ Page:** Data passed via `sessionStorage.setItem("planner-pyq-data", ...)`

### Guided Learning Chat
- **File:** `src/components/study-ai/guided-learning/guided-learning-chat.tsx`
- **Edge Function:** `guided-learning`
- **Streaming:** Currently disabled (`stream: false`)

### Edge Function: generate-topic-content
- **Path:** `supabase/functions/generate-topic-content/index.ts`
- **Model:** `gemini-3-flash-preview`
- **Features:** JSON repair for truncated responses, multi-exam support
