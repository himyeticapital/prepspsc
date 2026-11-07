# PrepSPSC - Sikkim PSC Exam Preparation

<p align="center">
  <img src="public/mascot.png" alt="PrepSPSC Mascot" width="120" />
</p>

<p align="center">
  A gamified, social study platform for Sikkim SPSC aspirants. Practice with mock tests, study with AI, track your progress, and connect with fellow aspirants in a beautiful, immersive environment.
</p>

<p align="center">
  <strong>Free for every student. Open source under AGPL-3.0.</strong><br/>
  Help keep the AI features free by <a href="https://github.com/sponsors/himyeticapital">sponsoring the Gemini API bill</a> ❤️
</p>

<p align="center">
  <a href="https://prepspsc.com">Live App</a> •
  <a href="#features">Features</a> •
  <a href="#developer-api">Developer API</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## What's New (February 2026)

### PYQ RAG Pipeline & External API
- **7,442 PYQs** ingested from 327 SPSC exam PDFs across 27 subjects
- **Semantic search** with pgvector (768-dim embeddings via `gemini-embedding-001`) + keyword hybrid matching
- **External REST API** with API key auth (`sk_live_*`), tiered rate limiting, and usage tracking
- **9 API endpoints**: search, mock tests, patterns, progress, analytics, leaderboard, bookmarks
- **Self-service developer portal** at `/developers` for instant API key generation

### Mock Test Engine
- **64 exam patterns** covering Civil Services, Police, Medical, Engineering, Education, IT, and more
- **Difficulty balancing** with custom easy/medium/hard percentages
- **Negative marking** metadata and scoring rules per exam pattern
- **`exclude_ids`** support for no-repeat questions across tests

### AI Agent Discovery & ClawHub
- **Agent protocol**: `.well-known/agents.json` for AI agent auto-discovery
- **MCP tools**: `.well-known/mcp.json` with 7 tool definitions
- **OpenAPI 3.1 spec** at `public/openapi.yaml`
- **Published on ClawHub** as `prepspsc-pyq@1.0.0` — install via `npx clawdhub install prepspsc-pyq`

### Previous Updates (January 2026)

#### AI Evaluation Improvements
- **Detailed AI Explanations**: 4-6 sentence comprehensive explanations with facts, dates, and context
- **Incorrect Options Analysis**: Explains why each wrong option is incorrect, not just the correct answer
- **User Choice Feedback**: Personalized feedback explaining why your specific choice was wrong
- **Recovery Mechanism**: Automatic retry for failed AI evaluations with manual retry button
- **Evaluation Timer**: Real-time timer showing how long AI analysis is taking

---

## Features

### Authentication & Onboarding
- Google OAuth, Email/Password, Phone OTP
- Custom avatar selection (25+ preset avatars)
- Personalized onboarding with bio and interests

### Gamified Dashboard
- **XP & Leveling System**: Earn XP for study sessions, test completion, and achievements
- **Streak Tracking**: Daily study streaks with automatic calculation and milestone rewards
- **Streak Shields** (Pro): Protect your streak when you miss a day
- **Activity Heatmap**: GitHub-style calendar showing your study consistency
- **Leaderboard**: Compete with fellow aspirants and climb the ranks
- **Achievement System**: Unlock badges for streaks, tests, study time, and more
- **Study Stats**: Track total study time, tests taken, and performance metrics
- **Draggable Widgets**: Customize your dashboard layout with drag-and-drop widgets

### Study with AI
AI-powered study tools to supercharge your learning:

- **Study Goals**: Create goals, upload materials (PDF, images, text), and generate study content
- **AI Content Generation**:
  - **Flashcards**: Spaced repetition cards with difficulty ratings
  - **Mind Maps**: Visual concept maps for better understanding
  - **Summaries**: Concise overviews of complex topics
  - **Quizzes**: Self-assessment questions with explanations
  - **Infographics**: Visual study aids
- **Blurting Technique**: Active recall practice with AI feedback
  - Type what you remember
  - Upload handwritten notes (OCR powered)
  - Get instant analysis of knowledge gaps
- **Spaced Repetition**: Smart scheduling for material review
- **Revision Reminders**: Never miss a review session
- **Anki Import**: Import existing Anki decks
- **Usage Tracking**: Monitor AI credits (Free: 5/day, Pro: Unlimited)

### Current Affairs Bot
Stay updated with latest news relevant to SPSC exams:

- **National News**: India updates from The Hindu
- **International News**: World news from BBC
- **Floating Widget**: Access news from anywhere in the app
- **Auto-refresh**: Fresh articles on every visit

### Focus Timer
Multiple timer modes for productive study sessions:

- **Pomodoro Timer**: Classic 25/5 work/break cycles
  - Customizable work duration (Pro: 15-90 mins)
  - Auto-start breaks option
  - Session counter with long break support
- **Stopwatch**: Track open-ended study sessions
- **Countdown Timer**: Set custom time limits
- **Session History**: Track all your study sessions
- **Database Sync**: Study time saved for stats and streaks

### Test Arena
- **MCQ Tests**: Multiple-choice questions with instant grading
- **Conventional Tests**: AI-powered evaluation using Google Gemini
- **Test Difficulty Levels**: Easy, Medium, Hard categorization
- **Test Categories**: Organized by subject (GK, Maths, Science, English, etc.)
- **Real-time Results**: Detailed breakdown with section-wise analysis
- **AI Explanations**: Comprehensive feedback for each question:
  - Why the correct answer is right (with facts and context)
  - Why each incorrect option is wrong
  - Personalized feedback if you answered incorrectly
- **Evaluation Timer**: See how long AI analysis is taking in real-time
- **Retry Failed AI**: Manual retry button for questions where AI analysis failed
- **Question Bank**: Admin-managed questions with bulk CSV import

### Study Rooms
- **Virtual Study Rooms**: Join themed study rooms with other aspirants
- **Room Categories**: General, Subject-specific, Exam-focused rooms
- **Study Tables**: Create or join smaller study tables within rooms
- **Real-time Chat**:
  - Room-wide chat and table-specific chat
  - Reply to messages
  - @mention users with auto-complete dropdown
  - Shift+Enter for new lines
  - Delete your own messages
- **Online Presence**: See who's currently studying in the room
- **Background Ambiance**: Choose from 24+ lofi study backgrounds

### Free for Everyone
Every feature that used to need Pro is unlocked for all students: 1.5x XP, AI study tools, custom timer durations, streak shields, premium tests and rooms, and Pro achievements.
- **One switch**: `src/lib/access.ts` (`NEXT_PUBLIC_ALL_FEATURES_FREE`, on unless set to `false`)
- **Abuse guards**: per-user daily caps on AI-heavy features in `src/lib/daily-cap.ts`

### Aesthetic Design ("Otakufy" Theme)
- **Glassmorphic UI**: Heavy backdrop blur with semi-transparent overlays
- **Dark Mode by Default**: Professional dark theme with teal (#2dd4bf) and orange (#f97316) accents
- **Lofi Mode**: Cozy warm-toned theme with amber colors and grain texture
- **Custom Mascot**: Cute bear/shiba mascot with teal glow animations
- **Dynamic Backgrounds**: 24+ atmospheric study backgrounds with smooth transitions
- **Smooth Animations**: Framer Motion for delightful micro-interactions
- **Responsive Design**: Optimized for desktop, tablet, and mobile

### PYQ Question Bank & Mock Tests
- **7,442 real PYQs** from 327 Sikkim SPSC exam papers
- **27 subjects** including Indian Polity, History, Geography, Science, GK, and more
- **Semantic search** using natural language queries with AI-powered vector similarity
- **64 exam patterns** for mock test generation (Undersecretary, SI Police, GDMO, Junior Engineer, etc.)
- **Difficulty balancing** with custom easy/medium/hard mix
- **Rich metadata** per question: topics, cognitive level, time-sensitivity, high-yield tags
- **Progress tracking**: Record answers, view analytics, compete on leaderboards

### Developer API
- **Self-service portal** at [prepspsc.com/developers](https://prepspsc.com/developers)
- **Free tier**: 10 requests/min, 1,000 calls/month — no credit card required
- **API key auth** (`sk_live_*`) with hashed storage and tiered rate limiting
- **9 REST endpoints**: search, mock tests, patterns, progress, analytics, leaderboard, bookmarks
- **AI agent compatible**: Published as `prepspsc-pyq@1.0.0` on [ClawHub](https://clawhub.ai)
- **Full docs**: [PYQ-API.md](docs/PYQ-API.md) | [OpenAPI spec](public/openapi.yaml)

### Admin Panel
- **User Management**: View and manage all users
- **Test Management**: Create, edit, and delete tests with difficulty levels
- **Question Bank**: Add/edit questions with CSV import support
- **API Key Management**: View, revoke, and monitor developer API keys with per-key usage stats
- **Analytics Dashboard**: User activity, test performance, and engagement metrics
- **Moderation Tools**: Chat monitoring and user management

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 16 (App Router), TypeScript, React 19 |
| **Styling** | Tailwind CSS v4, Shadcn/UI, Framer Motion |
| **Backend** | Supabase (Auth, PostgreSQL, Realtime, Storage, Edge Functions) |
| **Vector Search** | pgvector (768-dim, HNSW cosine index) with `gemini-embedding-001` |
| **State** | Zustand (with persistence) |
| **AI** | Google Gemini 3 Flash Preview (content generation, OCR, evaluation, embeddings) |
| **Payments** | Razorpay |
| **Security** | Zod validation, Upstash Redis rate limiting (fail-closed), Cloudflare Turnstile CAPTCHA, Supabase RLS (44 write-ownership policies) |
| **Email** | Resend |
| **Charts** | Recharts, react-activity-calendar |
| **RSS** | rss-parser (Current Affairs) |
| **Mobile** | Capacitor (iOS/Android) |
| **Security Scanning** | GitGuardian (secret detection), Snyk (dependency vulnerabilities) |
| **CI/CD** | GitHub Actions (security scans), CodeRabbit (PR reviews), Dependabot (dependency updates), Husky (pre-commit hooks) |
| **Deployment** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Google AI Studio API key (for AI features)
- Cashfree account (for payments)
- Upstash Redis account (for rate limiting)
- Cloudflare Turnstile account (for CAPTCHA)
- Resend account (for transactional emails)

### 1. Clone the repository

```bash
git clone https://github.com/himyeticapital/prepspsc.git
cd prepspsc
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations from `supabase/migrations/`
3. Enable authentication providers:
   - Email (Settings > Auth > Email)
   - Google OAuth (Settings > Auth > Providers > Google)
   - Phone/SMS (optional)
4. Copy your project URL and anon key from Settings > API

### 3. Set up Google Gemini

1. Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Enable Gemini API in your Google Cloud project

### 4. Set up Cashfree

1. Create an account at [cashfree.com](https://www.cashfree.com)
2. Get your App ID and Secret Key from Dashboard > Developers > API Keys
3. Use sandbox credentials for development

### 5. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Payments (Cashfree)
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_ENV=sandbox
NEXT_PUBLIC_CASHFREE_ENV=sandbox

# Email
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=PrepSPSC <noreply@yourdomain.com>

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# CAPTCHA (Cloudflare Turnstile)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
TURNSTILE_SECRET_KEY=your_turnstile_secret_key

# Cron Jobs
CRON_SECRET=generate_a_random_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

All environment variables are validated at build time using Zod (`src/lib/env.ts`). Missing or invalid variables will throw immediately.

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                 # Authentication routes
│   │   ├── login/
│   │   ├── signup/
│   │   ├── callback/
│   │   └── onboarding/
│   ├── (main)/                 # Main app routes
│   │   ├── dashboard/          # User dashboard
│   │   ├── study-ai/           # Study with AI module
│   │   │   ├── goals/[goalId]/ # Goal details & blurting
│   │   │   ├── revision/       # Revision scheduler
│   │   │   └── view/           # Material viewers
│   │   ├── tests/              # Test listing
│   │   ├── test/[id]/          # Test taking interface
│   │   ├── results/[attemptId]/ # Test results with AI feedback
│   │   ├── room/[id]/          # Study room
│   │   ├── rooms/              # Room listing
│   │   └── profile/            # User profile
│   ├── admin/                  # Admin panel (users, tests, API keys)
│   ├── developers/             # Self-service developer portal
│   └── api/                    # API routes
│       ├── developer-signup/   # API key generation
│       ├── study-ai/           # AI generation endpoints
│       ├── cashfree/           # Payment (create-order, verify-payment)
│       ├── cron/               # Scheduled jobs (renewal reminders)
│       ├── news/               # Current affairs API
│       ├── sync-study-time/    # Timer sync
│       ├── evaluate-test/      # Test evaluation with AI
│       └── retry-ai-feedback/  # Manual retry for failed AI analysis
├── components/
│   ├── ui/                     # Shadcn UI components
│   ├── study-ai/               # Study AI components
│   ├── tests/                  # Mock test components
│   ├── news/                   # Current Affairs Bot
│   ├── dashboard/              # Dashboard widgets
│   ├── gamification/           # XP, achievements
│   └── layout/                 # Navigation, background
├── lib/
│   ├── supabase/               # Supabase clients
│   ├── env.ts                  # Zod env validation (build-time)
│   ├── rate-limit.ts           # Upstash Redis rate limiting
│   ├── validations.ts          # Zod schemas for API inputs
│   ├── turnstile.ts            # Cloudflare Turnstile verification
│   ├── gemini.ts               # Google Gemini with retry & queue
│   ├── rss.ts                  # RSS feed parser
│   └── xp.ts                   # XP calculations
├── stores/                     # Zustand stores
│   ├── timer-store.ts
│   ├── study-ai-store.ts
│   ├── news-store.ts
│   └── ...
└── types/
    ├── database.types.ts
    └── study-ai.types.ts

public/
├── .well-known/
│   ├── agents.json             # AI agent discovery (agent protocol)
│   ├── mcp.json                # MCP tool discovery (7 tools)
│   └── ai-plugin.json          # AI plugin manifest
└── openapi.yaml                # OpenAPI 3.1 spec for PYQ API

docs/
└── PYQ-API.md                  # Full API documentation (v5.0)

supabase/
└── functions/
    ├── generate-topic-content/ # PYQ, Quiz, Summary generation
    ├── guided-learning/        # AI tutoring chat
    ├── pyq-api/                # External PYQ API (key auth, rate limiting)
    └── mock-test/              # Mock test generation (64 exam patterns)

clawhub-skill/
└── prepspsc-pyq/
    └── SKILL.md                # ClawHub/OpenClaw skill definition

scripts/
├── ingest-pyqs.ts              # PDF → PYQ ingestion pipeline
└── backfill-pyq-embeddings.ts  # Embedding backfill for pgvector
```

---

## AI Evaluation System

### How It Works

1. **Test Submission**: User completes test, score is calculated immediately
2. **Batch Processing**: Questions are processed in batches of 10 for efficiency
3. **AI Feedback Generation**: Each batch gets comprehensive AI analysis
4. **Recovery Mechanism**: Failed batches are automatically retried after 30 seconds
5. **Manual Retry**: Users can retry individual questions from results page

### Rate Limiting Configuration

```typescript
// Balanced for paid Gemini tier
MIN_REQUEST_INTERVAL = 3000  // 3s between requests (~20 RPM)
MAX_CONCURRENT_REQUESTS = 1  // Sequential processing
BATCH_SIZE = 10              // Questions per batch
RETRY_BATCH_SIZE = 5         // Smaller batches for recovery
RECOVERY_DELAY = 30000       // 30s wait before retry
```

### Feedback Structure

```typescript
interface MCQFeedback {
  isCorrect: boolean;
  explanation: string;                    // 4-6 sentence comprehensive explanation
  incorrectOptionsExplanation?: {         // Why each wrong option is wrong
    a?: string;
    b?: string;
    c?: string;
    d?: string;
  };
  userChoiceExplanation?: string;         // Why user's specific choice was wrong
  aiUnavailable?: boolean;                // True if AI analysis failed
}
```

---

## Design System

### Color Palette

**Dark Theme** (Default):
| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#2dd4bf` | Teal accents, buttons |
| Accent | `#f97316` | Orange highlights |
| Pro Accent | `#f59e0b` | Amber for Pro features |
| Background | `#09090b` | Main background |
| Card | `#18181b` | Card backgrounds |
| Border | `rgba(255,255,255,0.1)` | Subtle borders |

**Lofi Theme**:
| Color | Hex | Usage |
|-------|-----|-------|
| Primary | `#e8b86d` | Warm amber accents |
| Accent | `#d4956a` | Soft orange |
| Background | `#1a1612` | Cozy dark |

### Glass Classes

```css
.glass-card      /* Standard glass card */
.widget-glass    /* Dashboard widgets (heavy blur) */
.otakufy-glass   /* Overlay glass */
```

---

## Security

This project follows a **Backend-First security model** with defense-in-depth. See [SECURITY.md](SECURITY.md) for the full security rules and compliance status.

### Key Security Measures

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Supabase Auth with middleware-protected routes |
| **Database (RLS)** | Row Level Security on all tables — SELECT requires `auth.uid() IS NOT NULL`, write operations enforce ownership (`user_id = auth.uid()`) |
| **Write Ownership** | 44 RLS policies across 22 tables ensuring users can only INSERT/UPDATE/DELETE their own data |
| **Input Validation** | Zod schemas on all API route inputs |
| **Rate Limiting** | Upstash Redis per-user rate limits on all mutation endpoints (fail-closed when Redis unavailable) |
| **CAPTCHA** | Cloudflare Turnstile on auth forms |
| **Storage** | Private buckets, UUID filenames, signed URLs (1hr expiry) |
| **Payments** | Cashfree webhook signature verification (HMAC-SHA256), order ownership checks |
| **Env Validation** | Build-time Zod validation of all environment variables |
| **Cron Jobs** | Mandatory `CRON_SECRET` bearer token on all cron endpoints |
| **Security Headers** | CSP, HSTS, X-Frame-Options via `next.config.ts` |
| **Secret Scanning** | GitGuardian pre-commit hooks (local) + GitHub Actions CI scan on push/PR |
| **Dependency Scanning** | Snyk vulnerability scanning (high+ severity) on push/PR |
| **Pre-commit Hooks** | Husky + ggshield prevents secrets from ever entering git history |

### RLS Policy Summary

All user-facing tables enforce ownership-based write policies:

- **Personal data** (profiles, study logs, bookmarks, test attempts, etc.) — only the owning user can write
- **Collaboration tables** (messages, room presence, table members) — users can only manage their own entries
- **Creator-owned resources** (rooms, study tables) — only the creator can update/delete
- **Append-only tables** (XP transactions, achievements) — insert-only, no update/delete
- **Immutable records** (payments) — insert/update only, no delete
- **Admin-only tables** (tests, questions, categories) — no write policies for regular users; managed via service_role

---

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Mobile App (Capacitor)

```bash
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio
```

---

## Documentation

### Technical Docs
- [Security Rules & Compliance](SECURITY.md)
- [Security Monitoring & Incident Response](docs/SECURITY-MONITORING.md)
- [Data Protection & Privacy](docs/DATA-PROTECTION.md)
- [Phase G: Client-Side Migration Plan](docs/PHASE-G-MIGRATION.md)

### Feature Docs
- [PYQ API Documentation](docs/PYQ-API.md) - Full v5.0 API reference
- [Study AI Module](docs/STUDY_WITH_AI_MODULE.md)

### API & Integration
- [OpenAPI 3.1 Spec](public/openapi.yaml)
- [Agent Protocol](public/.well-known/agents.json)
- [MCP Tools](public/.well-known/mcp.json)

---

## API Routes

### PYQ Developer API (External — API key auth)

Base URL: `https://qqqditxzghqzodvauxth.supabase.co/functions/v1/pyq-api`

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

Full documentation: [docs/PYQ-API.md](docs/PYQ-API.md)

### Internal API Routes (Next.js)

#### Test Evaluation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/evaluate-test` | POST | Submit test for AI evaluation |
| `/api/retry-ai-feedback` | POST | Retry failed AI analysis for a question |

#### Study AI
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/study-ai/generate` | POST | Generate study content (flashcards, mindmaps, etc.) |
| `/api/study-ai/blurt` | POST | Evaluate blurt response |

#### Developer
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/developer-signup` | POST | Generate API key for developer portal |

#### Payments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cashfree/create-order` | POST | Create payment order |
| `/api/cashfree/verify-payment` | POST | Verify payment webhook |

---

## Contributing

Contributions are welcome: new features, bug fixes, exam content and docs. Read [CONTRIBUTING.md](CONTRIBUTING.md) to set up your own Supabase project and open a pull request. Report security issues privately as described in [SECURITY.md](SECURITY.md).

## Support the project

PrepSPSC's AI features run on Google Gemini. Sponsorships go toward that bill so the platform stays free for students: [github.com/sponsors/himyeticapital](https://github.com/sponsors/himyeticapital).

---

## License

[GNU Affero General Public License v3.0](LICENSE). You may use, modify and share PrepSPSC. If you run a modified version as a public service, you must publish your source code under the same license.

---

## Acknowledgments

- Built with love in Sikkim
- Powered by Supabase, Next.js, Google Gemini, and Razorpay
- PYQ API published on [ClawHub](https://clawhub.ai) as `prepspsc-pyq@1.0.0`
- Secured with GitGuardian, Snyk, Upstash Redis, Cloudflare Turnstile, and Zod
- UI inspired by modern glassmorphic design trends

---

<p align="center">
  <strong>Made with ❤️ for Sikkim PSC aspirants</strong>
</p>
