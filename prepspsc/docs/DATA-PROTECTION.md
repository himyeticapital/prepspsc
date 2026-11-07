# Data Protection & API Abuse Prevention

This document explains how user data, payment data, and the Gemini AI API are protected in PrepSPSC.

---

## 1. User Data Protection

### Authentication Layer

All protected routes require a valid Supabase session. The middleware at `src/middleware.ts` redirects unauthenticated users to `/login`.

```
Browser → Middleware (session check) → Page/API Route
```

### Row Level Security (RLS) — Database Layer

Every table has RLS enabled with two policy types:

| Policy Type | Rule | Purpose |
|-------------|------|---------|
| **SELECT** | `auth.uid() IS NOT NULL` | Any authenticated user can read (needed for leaderboards, rooms, chat) |
| **INSERT/UPDATE/DELETE** | `user_id = auth.uid()` | Users can only write their own rows |

**Tables with write-ownership enforcement:**

- `profiles` (UPDATE: `id = auth.uid()`)
- `daily_study_logs`, `study_sessions`, `study_goals`, `study_ai_goals`, `study_uploads`, `ai_generations`, `revision_items`, `blurt_sessions`, `test_attempts`, `bookmarks`, `payments`, `xp_transactions`, `user_achievements`, `study_ai_notifications`, `room_notifications` (all writes: `user_id = auth.uid()`)
- `messages`, `user_room_subscriptions`, `room_presence`, `table_members` (all writes: `user_id = auth.uid()`)
- `study_tables` (all writes: `created_by = auth.uid()`)
- `rooms` (all writes: `owner_id = auth.uid()`)

**Admin-only tables (no write policies for regular users):**

- `tests`, `questions`, `exam_categories`, `achievements`, `profile_frames`, `room_categories`, `test_sections`

### What This Prevents

| Attack | Blocked By |
|--------|-----------|
| Unauthenticated access to any data | Middleware + RLS SELECT policy |
| User A modifies User B's profile | RLS: `id = auth.uid()` on UPDATE |
| User A inserts XP for User B | RLS: `user_id = auth.uid()` on INSERT |
| User A deletes User B's messages | RLS: `user_id = auth.uid()` on DELETE |
| User A creates a fake test/question | No INSERT policy exists for regular users |
| User A modifies achievement definitions | No UPDATE policy exists for regular users |

### Automated Verification

44 RLS tests run via `npm test` covering:
- Personal data isolation (16 tests)
- Collaboration ownership (18 tests)
- Admin table lockdown (10 tests)

---

## 2. Payment Data Protection

### Payment Flow

```
1. User clicks "Upgrade"
2. POST /api/cashfree/create-order (creates Cashfree order)
3. User completes payment on Cashfree UI
4. POST /api/cashfree/verify-payment (server verifies with Cashfree)
5. Profile updated to Pro
```

### Protection Layers

#### Layer 1: Authentication

Both endpoints require `supabase.auth.getUser()` — unauthenticated requests get 401.

**File:** `src/app/api/cashfree/create-order/route.ts:23-29`

#### Layer 2: Rate Limiting

3 requests per minute per user. Prevents order spam.

**File:** `src/lib/rate-limit.ts:21-25` (prefix: `rl:payment`)

#### Layer 3: CAPTCHA (Cloudflare Turnstile)

Order creation requires a valid Turnstile token, verified server-side using the secret key (never exposed to browser).

**File:** `src/app/api/cashfree/create-order/route.ts:76-86`

#### Layer 4: Duplicate Prevention

Already-Pro users cannot create new orders unless their membership expires within 7 days.

```typescript
if (profile?.is_pro_member) {
  const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 7) {
    return NextResponse.json({ error: "You are already a Pro member" }, { status: 400 });
  }
}
```

#### Layer 5: Hardcoded Plan Amounts

Payment amounts come from a server-side plan list — users cannot specify arbitrary amounts.

```typescript
if (!PLANS[planId as keyof typeof PLANS]) {
  return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
}
```

#### Layer 6: Server-to-Server Verification

Payment status is confirmed directly with Cashfree API using server credentials. The client cannot fake a payment.

```typescript
const cfResponse = await fetch(`${baseUrl}/pg/orders/${orderId}`, {
  headers: {
    "x-client-id": clientId,       // Server-only env var
    "x-client-secret": clientSecret, // Server-only env var
  },
});

if (cfData.order_status !== "PAID") {
  return NextResponse.json({ error: "Payment not confirmed" }, { status: 400 });
}
```

**File:** `src/app/api/cashfree/verify-payment/route.ts:56-73`

#### Layer 7: Order Ownership Check

Even if an attacker knows a valid order ID, they cannot claim it for their account.

```typescript
if (cfData.customer_details?.customer_id !== user.id) {
  return NextResponse.json({ error: "Order does not belong to this user" }, { status: 403 });
}
```

**File:** `src/app/api/cashfree/verify-payment/route.ts:75-81`

#### Layer 8: Immutable Audit Trail

Every order is recorded in the `payments` table at creation time with status "created", then updated to "paid" after verification. The RLS policy prevents users from modifying their own payment records (INSERT only, no UPDATE/DELETE for regular users via client).

### Attack Scenarios

| Attack | Result |
|--------|--------|
| Create fake payment confirmation | Rejected — server checks Cashfree API directly |
| Claim someone else's order ID | Rejected — customer_id must match auth user |
| Spam order creation | Rate limited (3/min) + CAPTCHA blocks bots |
| Modify payment amount | Impossible — amounts from hardcoded plan list |
| Replay a paid order | Already marked "paid" — no duplicate processing |
| Bypass payment entirely | Pro status only set after server-verified payment |
| Create orders while already Pro | Rejected unless within 7-day renewal window |

---

## 3. Gemini API Abuse Prevention

### Why This Matters

The Gemini API key is billed per request. A malicious user hammering AI endpoints could generate significant costs. The key itself is stored as a server-side environment variable and never exposed to the browser.

### AI Endpoints

| Endpoint | Purpose | Gemini Calls |
|----------|---------|-------------|
| `/api/study-ai/generate` | Generate study materials | 1 per request |
| `/api/study-ai/blurt-analyze` | Analyze recall attempts | 1 per request |
| `/api/study-ai/parse-content` | Extract text from PDF/image/YouTube | 1-2 per request |

### Protection Chain

#### 1. Authentication Required

All AI endpoints verify the user session. Anonymous requests are rejected.

#### 2. Rate Limiting (10 requests/minute)

All three endpoints share the same rate limit pool (`rl:ai`). A user cannot exceed 10 AI calls per minute across all AI features combined.

**Files:**
- `src/app/api/study-ai/generate/route.ts:158`
- `src/app/api/study-ai/blurt-analyze/route.ts:30-32`
- `src/app/api/study-ai/parse-content/route.ts:24-25`

#### 3. Daily Credit System (Free Users)

Free users are limited to **1 AI generation per calendar day**. This is enforced server-side using database counters:

```typescript
const generationsToday = isNewDay ? 0 : (profile?.study_ai_generations_today || 0);

if (!isPro && generationsToday >= 1) {
  return NextResponse.json({
    error: "Daily generation limit reached",
    code: "DAILY_LIMIT",
  }, { status: 429 });
}
```

The counter is stored in `profiles.study_ai_generations_today` and reset when `profiles.study_ai_last_generation_date` differs from today's date.

**File:** `src/app/api/study-ai/generate/route.ts:189-215`

#### 4. Input Size Limits

Content is truncated before being sent to Gemini:

| Endpoint | Max Input |
|----------|-----------|
| `/api/study-ai/generate` | 15,000 characters |
| `/api/study-ai/blurt-analyze` | 10,000 characters (source content) |
| `/api/study-ai/parse-content` | File size limited by Next.js body parser |

Zod validation enforces 10-50,000 character range on generate inputs.

**File:** `src/lib/validations.ts:19`

#### 5. Fail-Closed Rate Limiter

If Redis (Upstash) is unavailable, requests are **denied** (503), not allowed through.

```typescript
} catch (error) {
  console.error("Rate limit check failed:", error);
  return new NextResponse(
    JSON.stringify({ error: "Service temporarily unavailable" }),
    { status: 503 }
  );
}
```

**File:** `src/lib/rate-limit.ts:84-91`

#### 6. Server-Side API Key

The Gemini API key (`GOOGLE_GEMINI_API_KEY`) is only accessible in server-side API routes. It never appears in client-side bundles or browser network requests.

### Cost Analysis

| User Type | Max Calls/Day | Est. Cost/Day |
|-----------|--------------|---------------|
| Free user | 1 (generation) + 10/min (blurt/parse) | ~$0.003 (practical: 1-5 calls) |
| Pro user | 10/min * 60 * 24 = 14,400 (theoretical max) | ~$29 (theoretical max) |
| Realistic Pro user | 50-100 calls/day | ~$0.10-0.20 |

### Remaining Considerations

| Scenario | Current Protection | Additional Option |
|----------|-------------------|-------------------|
| Pro user hammering AI all day | Rate limited to 10/min | Add daily cap (e.g., 200/day for Pro) |
| Multiple free accounts | 1 generation/day each | Turnstile CAPTCHA on signup prevents bot accounts |
| Large file uploads to parse-content | Next.js body size limit | Add explicit file size check (e.g., 10MB max) |

### Summary: What Stops a Malicious User

```
Malicious request
  → Must be authenticated (401 if not)
  → Must pass rate limit (429 if exceeded, 503 if Redis down)
  → Must have daily credits remaining (429 if free user exceeded)
  → Input truncated to prevent cost explosion
  → API key never exposed (can't call Gemini directly)
  → All protections are server-side (can't be bypassed from browser)
```

---

## Quick Reference: All Security Layers

| Layer | User Data | Payments | AI/Gemini |
|-------|-----------|----------|-----------|
| Authentication | Middleware + `getUser()` | `getUser()` | `getUser()` |
| Rate Limiting | Via API routes | 3/min | 10/min (shared pool) |
| RLS (Database) | Write-ownership on all tables | INSERT only | N/A |
| Input Validation | Zod schemas | Plan ID validation | Zod + char limits |
| CAPTCHA | Signup only | Order creation | N/A |
| Server Verification | N/A | Cashfree API check | N/A |
| Ownership Check | `user_id = auth.uid()` | `customer_id = user.id` | N/A |
| Daily Limits | N/A | N/A | 1/day (free), unlimited (Pro) |
| Fail-Closed | N/A | N/A | Redis down = 503 |
| Audit Trail | N/A | `payments` table | `ai_generations` table |
