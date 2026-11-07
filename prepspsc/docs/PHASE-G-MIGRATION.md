# Phase G: Client-Side Supabase Migration to API Routes

## Overview

Currently, 24 files (5 stores, 17 components, 2 hooks) make **93+ direct Supabase calls** from the browser using the anon key. While RLS policies now protect against cross-user data manipulation, exposing database queries client-side still reveals table structure, column names, and query patterns to anyone inspecting the browser's network tab.

This document outlines how to migrate these calls to server-side API routes.

---

## Pros and Cons

### Pros of Migration

| Benefit | Detail |
|---------|--------|
| **Hidden DB schema** | Table names, column names, and query logic invisible to users |
| **Server-side validation** | Validate and sanitize all inputs before they reach the database |
| **Rate limiting per endpoint** | Fine-grained control over each operation |
| **Audit logging** | Log all mutations server-side for debugging and security |
| **Easier to add business logic** | Server-side checks (e.g., "can only create 5 goals") without RLS complexity |
| **Reduced bundle size** | Remove `@supabase/supabase-js` from client bundle (only needed server-side) |
| **Consistent error handling** | Standardized API responses vs raw PostgREST errors |
| **Future-proof** | Can swap Supabase for another DB without touching frontend |

### Cons of Migration

| Drawback | Detail |
|----------|--------|
| **Significant effort** | 93+ calls across 24 files = large refactor |
| **Added latency** | Extra hop: Client -> API Route -> Supabase (vs Client -> Supabase directly) |
| **More files to maintain** | ~15-20 new API route files |
| **Realtime complexity** | Supabase Realtime subscriptions can't go through API routes (must stay client-side) |
| **Risk of breaking changes** | Each migration point is a potential regression |
| **Development speed** | Supabase client SDK is faster to develop with than custom API routes |
| **Caching complexity** | Need to handle stale data, cache invalidation manually |

### Verdict

**Recommended approach:** Migrate in phases, prioritizing write operations first. Keep read-only SELECTs and Realtime subscriptions client-side (protected by RLS). This gives 80% of the security benefit with 30% of the effort.

---

## Current State: 24 Files with Client-Side DB Calls

### Stores (5 files, ~50 calls)

| File | Tables | Operations | Priority |
|------|--------|-----------|----------|
| `src/stores/gamification-store.ts` | profiles, achievements, user_achievements, study_goals, study_sessions, xp_transactions, test_attempts, daily_study_logs, revision_items | SELECT, INSERT, UPDATE, RPC | HIGH |
| `src/stores/study-ai-store.ts` | profiles, study_ai_goals, study_uploads, ai_generations, blurt_sessions, revision_items, study_ai_notifications | SELECT, INSERT, UPDATE, DELETE | HIGH |
| `src/stores/room-store.ts` | rooms, user_room_subscriptions, room_notifications, room_presence, profiles | SELECT, INSERT, UPDATE, DELETE, Realtime | MEDIUM |
| `src/stores/table-store.ts` | study_tables, table_members, profiles | SELECT, INSERT, DELETE, RPC, Realtime | MEDIUM |
| `src/stores/auth-store.ts` | profiles | SELECT, UPDATE | LOW |

### Components (17 files, ~40 calls)

| File | Tables | Operations | Priority |
|------|--------|-----------|----------|
| `src/components/room/chat-room.tsx` | messages, profiles, profile_frames | SELECT, INSERT, UPDATE, Realtime | HIGH |
| `src/components/widgets/chat-widget.tsx` | messages, profiles, profile_frames, room_presence | SELECT, INSERT, UPDATE | HIGH |
| `src/components/rooms/room-card.tsx` | rooms | UPDATE, DELETE | HIGH |
| `src/components/study-ai/content-uploader.tsx` | study_uploads (+ Storage) | INSERT, Storage upload | MEDIUM |
| `src/components/test/answer-upload.tsx` | (Storage only) | Storage upload | MEDIUM |
| `src/components/layout/otakufy-navbar.tsx` | profile_frames, room_notifications | SELECT, UPDATE, Realtime | LOW |
| `src/components/widgets/leaderboard-widget.tsx` | daily_study_logs, profiles | SELECT | LOW |
| `src/components/dashboard/leaderboard.tsx` | profile_frames | SELECT | LOW |
| `src/components/rooms/online-presence.tsx` | profile_frames | SELECT | LOW |
| `src/components/rooms/user-profile-modal.tsx` | profiles, test_attempts, daily_study_logs, profile_frames | SELECT | LOW |
| `src/components/widgets/tests-widget.tsx` | exam_categories, tests, questions | SELECT | LOW |
| `src/components/widgets/bookmarks-widget.tsx` | bookmarks, questions, tests, exam_categories | SELECT | LOW |
| `src/components/widgets/stats-widget.tsx` | daily_study_logs, profiles, test_attempts | SELECT | LOW |
| `src/components/test/leaderboard.tsx` | test_attempts, profiles | SELECT | LOW |
| `src/components/study-ai/revision/standalone-blurt-section.tsx` | study_ai_goals | SELECT | LOW |
| `src/components/providers/revision-checker-provider.tsx` | (auth only) | AUTH | SKIP |
| `src/components/admin/admin-sidebar.tsx` | (auth only) | AUTH | SKIP |

### Hooks (2 files, ~3 calls)

| File | Tables | Operations | Priority |
|------|--------|-----------|----------|
| `src/hooks/use-revision-checker.ts` | study_ai_goals | SELECT | LOW |
| `src/hooks/use-permissions.ts` | profiles, user_permissions | SELECT | LOW |

---

## Implementation Strategy

### Approach: "Writes First, Reads Later"

1. **Phase G1 (HIGH priority):** Migrate all INSERT, UPDATE, DELETE operations to API routes
2. **Phase G2 (MEDIUM priority):** Migrate complex SELECTs with business logic
3. **Phase G3 (LOW priority):** Migrate simple SELECTs (optional — RLS protects these)
4. **SKIP:** Realtime subscriptions and auth-only calls stay client-side

---

## Phase G1: Migrate Write Operations

### API Route Structure

```
src/app/api/
├── gamification/
│   ├── award-xp/route.ts          # XP transactions + profile update
│   ├── unlock-achievement/route.ts # Achievement unlock
│   ├── study-session/route.ts      # Record study session
│   ├── study-goal/route.ts         # CRUD study goals
│   └── streak-shield/route.ts      # Use streak shield
├── rooms/
│   ├── subscribe/route.ts          # Join/leave room subscription
│   ├── presence/route.ts           # Update presence status
│   ├── notifications/route.ts      # Mark read, clear notifications
│   └── manage/route.ts             # Rename/delete room (owner only)
├── messages/
│   └── route.ts                    # Send/delete messages
├── study-ai/
│   ├── goals/route.ts              # CRUD study AI goals
│   ├── uploads/route.ts            # Manage uploads metadata
│   ├── generations/route.ts        # Save/toggle generations
│   ├── blurt/route.ts              # Blurt session CRUD
│   ├── revision/route.ts           # Revision item updates
│   └── notifications/route.ts      # Mark read notifications
├── tables/
│   └── route.ts                    # Create/join/leave study tables
└── profile/
    └── route.ts                    # Update own profile
```

### Pattern for Each API Route

```typescript
// src/app/api/gamification/award-xp/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createRateLimiter, checkRateLimit } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter("rl:xp", { limit: 20, window: 60 });

const schema = z.object({
  amount: z.number().int().min(1).max(1000),
  reason: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  const rl = await checkRateLimit(rateLimiter, user.id);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // Validate input
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Execute with ownership enforcement
  const { error } = await supabase.from("xp_transactions").insert({
    user_id: user.id, // Always use server-side user ID
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

### Pattern for Client-Side Call

```typescript
// In store: replace direct Supabase call with fetch
async awardXP(amount: number, reason: string) {
  const response = await fetch("/api/gamification/award-xp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, reason }),
  });

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error);
  }

  return response.json();
}
```

---

## Phase G2: Migrate Complex SELECTs

These are SELECTs that join multiple tables or contain business logic:

| Current Call | New API Route | Reason |
|-------------|--------------|--------|
| Leaderboard (study_logs + profiles) | `/api/leaderboard` | Complex aggregation |
| User stats (multiple tables) | `/api/profile/stats` | Multi-table join |
| Gamification init (10+ queries) | `/api/gamification/init` | Batch multiple queries |
| Study AI init (7+ queries) | `/api/study-ai/init` | Batch multiple queries |

---

## Phase G3: Simple SELECTs (Optional)

These are protected by RLS and expose minimal schema info. Migration is optional:

- `profile_frames` SELECT
- `exam_categories` SELECT
- `achievements` SELECT (read-only admin table)
- `bookmarks` SELECT (own data only via RLS)

---

## What CANNOT Be Migrated

### Realtime Subscriptions (Must Stay Client-Side)

| Location | Subscription |
|----------|-------------|
| `room-store.ts` | `room_notifications`, `room_presence` changes |
| `table-store.ts` | `study_tables`, `table_members` changes |
| `chat-room.tsx` | `messages` inserts/updates |
| `otakufy-navbar.tsx` | `room_notifications` changes |

**Why:** Supabase Realtime uses WebSocket connections that must originate from the browser. These subscriptions are read-only listeners and are protected by RLS (users can only subscribe to channels they have access to).

### Auth Operations (Must Stay Client-Side)

- `supabase.auth.getUser()` — needed for session management
- `supabase.auth.signOut()` — client-side auth flow
- `supabase.auth.onAuthStateChange()` — session listeners

---

## Migration Order (Recommended)

### Sprint 1: Critical Writes (Highest Security Impact)
1. `gamification-store.ts` — XP, achievements, sessions (prevents XP manipulation)
2. `room-card.tsx` — Room delete/rename (prevents unauthorized room changes)
3. `messages` in chat-room/chat-widget — Message send/delete

### Sprint 2: Study AI Writes
4. `study-ai-store.ts` — Goals, uploads, generations, blurt sessions
5. `content-uploader.tsx` — Storage uploads with metadata

### Sprint 3: Collaboration Writes
6. `room-store.ts` — Subscriptions, presence, notifications
7. `table-store.ts` — Table create/join/leave

### Sprint 4: Reads (Optional)
8. Complex multi-table SELECTs → batch API routes
9. Simple SELECTs → optional, lowest priority

---

## Estimated Scope

| Phase | New API Routes | Files Modified | New Files |
|-------|---------------|----------------|-----------|
| G1 | 12-15 routes | 8 stores/components | 12-15 |
| G2 | 4-5 routes | 6 components | 4-5 |
| G3 | 3-4 routes | 8 components | 3-4 |
| **Total** | **~22 routes** | **~22 files** | **~22 files** |

---

## Testing Strategy

After each migration:
1. Verify the feature still works in the UI
2. Check browser Network tab — no direct Supabase calls for migrated operations
3. Verify rate limiting works (hit endpoint rapidly)
4. Test with invalid/malicious input (wrong user_id, extreme values)
5. Run existing RLS tests (`npm test`) to ensure no regressions

---

## Decision: When to Start Phase G

**Start Phase G when:**
- You have time for a focused refactoring effort
- You want to hide DB schema from browser inspection
- You need per-endpoint rate limiting on writes
- You're preparing for a security audit

**Phase G is NOT urgent because:**
- RLS write policies (Phase H) already prevent cross-user data manipulation
- The Gemini API key is server-side only (not exposed)
- Payment verification is already server-side
- SELECT queries expose table/column names but not sensitive data
