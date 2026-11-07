# CLAUDE.md

## Project Overview

PrepSPSC — a gamified, social study platform for Sikkim PSC exam preparation. Built with Next.js 16, TypeScript, React 19, Supabase, and Google Gemini AI.

## Tech Stack

- **Framework:** Next.js 16.1.3 (App Router, static export for mobile)
- **Language:** TypeScript 5 (strict mode)
- **UI:** React 19, Tailwind CSS v4, Radix UI, Shadcn/UI (New York style)
- **State:** Zustand 5
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **AI:** Google Gemini (`@google/generative-ai`)
- **Payments:** Razorpay
- **Mobile:** Capacitor 8
- **Charts:** Recharts, D3, Markmap

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build (static export)
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── (auth)/          # Auth routes (login, signup)
│   ├── (main)/          # Protected app routes
│   ├── admin/           # Admin dashboard
│   ├── api/             # API routes (study-ai, evaluate-test, razorpay, news)
│   ├── layout.tsx       # Root layout
│   └── globals.css      # Global styles + Tailwind
├── components/          # React components
│   ├── ui/              # Shadcn/UI primitives (28+ components)
│   ├── admin/           # Admin components
│   ├── dashboard/       # Dashboard sections
│   ├── gamification/    # XP, streaks, achievements, leaderboard
│   ├── study-ai/        # AI study tools
│   ├── test/            # Test arena components
│   ├── room/            # Virtual study rooms
│   ├── timer/           # Pomodoro/timer components
│   └── widgets/         # Dashboard widgets
├── stores/              # Zustand stores
├── hooks/               # Custom React hooks
├── lib/                 # Utilities
│   ├── supabase/        # Supabase client (client.ts, server.ts, middleware.ts)
│   ├── gemini.ts        # Gemini AI config
│   ├── achievements.ts  # Achievement definitions
│   ├── xp.ts            # XP system logic
│   └── utils.ts         # General utilities (cn, etc.)
├── types/               # TypeScript types
│   └── database.types.ts # Auto-generated Supabase types
└── middleware.ts        # Auth middleware
```

## Key Conventions

- **Path alias:** `@/*` maps to `./src/*`
- **Styling:** Tailwind CSS v4 with glassmorphism design patterns. Use `cn()` from `@/lib/utils` for class merging.
- **Components:** Shadcn/UI components live in `src/components/ui/`. Use Radix primitives + CVA for variants.
- **State management:** Zustand stores in `src/stores/`. Each feature has its own store.
- **Supabase:** Use `createClient()` from `@/lib/supabase/client` (client-side) or `@/lib/supabase/server` (server-side).
- **Icons:** Use `lucide-react` for all icons.
- **Notifications:** Use `sonner` toast for user feedback.
- **Animations:** Use `framer-motion` for transitions and animations.
- **Theme:** Dark/light mode via `next-themes`. Design defaults to dark theme (`#09090b`).

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase connection
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase admin access
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Payment processing
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Client-side Razorpay
- `NEXT_PUBLIC_APP_URL` — App base URL

## Important Notes

- React StrictMode is disabled in `next.config.ts` (Supabase compatibility).
- Static export is enabled (`output: 'export'`) for Capacitor mobile builds.
- No test framework is currently configured.
- Database types are auto-generated in `src/types/database.types.ts` — do not edit manually.
- The app uses route groups: `(auth)` for public auth pages, `(main)` for protected pages.
- AI credits: Free users get 5/day, Pro users get unlimited.
- XP system: Pro users get 1.5x XP multiplier.

## Debugging Protocol

When debugging issues, follow this systematic approach:

1. **Root Cause** — Read and understand the relevant code first. Identify what's actually broken.
2. **Hypotheses** — Form 2-3 likely causes based on evidence, not guesswork.
3. **Test** — Verify each hypothesis systematically with minimal changes.
4. **Fix** — Apply the minimal fix for the confirmed cause.
5. **Document** — Explain what broke and why the fix works.

No random trial-and-error. Understand before you fix.
