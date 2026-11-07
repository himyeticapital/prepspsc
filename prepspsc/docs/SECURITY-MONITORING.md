# Security Monitoring & Incident Response Guide

This document explains how to monitor security vulnerabilities in PrepSPSC and what to do when one is found.

---

## 1. Security Dashboards

### GitGuardian (Secret Leak Detection)

**URL:** https://dashboard.gitguardian.com

**What it shows:**
- Secrets (API keys, passwords, tokens) found in your code or git history
- Severity: Critical / High / Medium / Low
- Location: exact file and line number

**Where to look:**
- Dashboard > **Incidents** tab > filter by Status: Open
- Each incident shows: secret type, file path, commit, author

**When it triggers:**
- Every `git push` to GitHub (via CI workflow)
- Every `git commit` locally (via pre-commit hook)
- Continuous monitoring of the repo (historical scan)

---

### Snyk (Dependency Vulnerabilities)

**URL:** https://app.snyk.io

**What it shows:**
- Vulnerable npm packages in your `package.json` / `package-lock.json`
- CVE ID, severity, affected versions, fix version
- Exploitability score and attack vector

**Where to look:**
- Dashboard > **Projects** > click your project
- Each vulnerability shows: package name, current version, fixed version, description

**When it triggers:**
- Every `git push` or PR to main (via CI workflow)
- Weekly email digest from Snyk (if enabled)

---

### GitHub Security Tab

**URL:** https://github.com/himyeticapital/prepspsc/security

**What it shows:**
- **Dependabot alerts**: CVEs in dependencies
- **Secret scanning alerts**: GitHub's built-in secret detection
- **Code scanning**: if CodeQL is enabled (optional)

---

### GitHub Actions (CI Results)

**URL:** https://github.com/himyeticapital/prepspsc/actions

**What it shows:**
- "Security Scans" workflow with two jobs:
  - **GitGuardian Secret Scan**: pass/fail
  - **Snyk Dependency Scan**: pass/fail (fails on high+ severity)

---

### Dependabot (Outdated Packages)

**URL:** https://github.com/himyeticapital/prepspsc/pulls?q=label%3Adependencies

**What it shows:**
- Monthly PRs to upgrade outdated or vulnerable packages
- Grouped by: Radix UI, Supabase, dev dependencies
- Changelog and compatibility notes included

---

## 2. Daily/Weekly Monitoring Checklist

### Daily (5 minutes)

| Check | How | Action if failed |
|-------|-----|-----------------|
| CI passing? | GitHub > Actions > latest run | Fix the failing job |
| Pre-commit working? | Commits succeed with "No secrets found" | Run `ggshield auth login` if broken |
| Gemini API cost normal? | Google AI Studio > Usage | See Section 3.6 if spike detected |
| Vercel function errors? | Vercel > Project > Logs > filter "error" | Investigate 500s on payment/AI routes |

### Weekly (15 minutes)

| Check | How | Action if issue found |
|-------|-----|----------------------|
| GitGuardian incidents | Dashboard > Incidents > Open | See Section 3.1 |
| Snyk vulnerabilities | app.snyk.io > Projects | See Section 3.2 |
| Dependabot PRs | GitHub > Pull Requests > `dependencies` label | Review and merge |
| GitHub Security tab | Repo > Security > Overview | Review alerts |
| RLS tests passing | Run `npm test` locally | Fix failing policies |
| User data access patterns | Run SQL query below | See Section 3.7 |
| Payment anomalies | Run SQL query below | See Section 3.8 |
| AI usage per user | Run SQL query below | See Section 3.6 |

**Weekly SQL Queries (run in Supabase SQL Editor):**

**Check for cross-user data access attempts (RLS blocks these, but logs help):**
```sql
-- Users with unusually high write activity (potential abuse)
SELECT user_id, COUNT(*) as writes, MAX(created_at) as last_write
FROM daily_study_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY writes DESC
LIMIT 10;
```

**Check payment anomalies:**
```sql
-- Failed or suspicious payment attempts in last 7 days
SELECT user_id, status, COUNT(*) as attempts,
       MIN(created_at) as first, MAX(created_at) as last
FROM payments
WHERE created_at > NOW() - INTERVAL '7 days'
  AND status != 'paid'
GROUP BY user_id, status
ORDER BY attempts DESC;

-- Users with multiple orders (potential replay/fraud)
SELECT user_id, COUNT(*) as order_count
FROM payments
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) > 3
ORDER BY order_count DESC;
```

**Check Gemini API misuse:**
```sql
-- Users hitting daily AI generation limits
SELECT id, email, study_ai_generations_today, study_ai_last_generation_date
FROM profiles
WHERE study_ai_generations_today > 5
ORDER BY study_ai_generations_today DESC;

-- AI generation volume per user in last 7 days
SELECT user_id, COUNT(*) as generations,
       SUM(CASE WHEN generation_type = 'flashcards' THEN 1 ELSE 0 END) as flashcards,
       SUM(CASE WHEN generation_type = 'notes' THEN 1 ELSE 0 END) as notes
FROM ai_generations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY generations DESC
LIMIT 20;
```

### Monthly (30 minutes)

| Check | How | Action |
|-------|-----|--------|
| Review Supabase RLS policies | Supabase > Authentication > Policies | Ensure no `USING (true)` on write policies |
| Check Supabase storage buckets | Supabase > Storage > bucket settings | Ensure all remain private |
| Review rate limit logs | Vercel/server logs for 429 responses | Investigate if one user hits limits repeatedly |
| Check Gemini API billing | Google AI Studio > Usage > Billing | Compare to expected cost |
| Review Upstash Redis usage | Upstash dashboard | Check rate limit key counts |
| Audit user signups | Supabase > Auth > Users | Look for bot accounts (similar emails, no activity) |
| Check Cashfree dashboard | merchant.cashfree.com > Transactions | Match with `payments` table |
| Rotate API keys | All services | Rotate keys every 3-6 months proactively |

---

## 3. Incident Response Procedures

### 3.1 Secret Leaked in Code

**Severity: CRITICAL — Act immediately**

**Step 1: Identify the secret type**
- API key (Gemini, Cashfree, Supabase service role)?
- Database password?
- Auth token?

**Step 2: Rotate the secret immediately**

| Secret Type | Where to Rotate |
|-------------|----------------|
| Supabase service role key | Supabase > Settings > API > Regenerate |
| Supabase anon key | Supabase > Settings > API > Regenerate |
| Google Gemini API key | Google AI Studio > API Keys > Regenerate |
| Cashfree credentials | Cashfree Dashboard > API Keys |
| Upstash Redis credentials | Upstash Console > Database > Reset |
| Turnstile secret key | Cloudflare Dashboard > Turnstile > Rotate |

**Step 3: Update the new secret**
- Update in Vercel: Project > Settings > Environment Variables
- Update in `.env.local` locally
- DO NOT commit the new secret to code

**Step 4: Remove from code**
- Delete the hardcoded secret from the file
- Commit the fix
- Push to trigger CI (should pass now)

**Step 5: Mark resolved**
- GitGuardian > Incident > Mark as "Resolved"
- Add a note explaining what was rotated

**Important:** Even if you delete a secret from code, it remains in git history forever. Rotation is the only real fix. Do NOT try to rewrite git history — just rotate the key.

---

### 3.2 Vulnerable Dependency Found

**Step 1: Assess severity**

| Severity | Action |
|----------|--------|
| Critical | Fix within 24 hours |
| High | Fix within 1 week |
| Medium | Fix within 1 month |
| Low | Fix when convenient |

**Step 2: Check if it's exploitable**
- Read the CVE description on Snyk
- Is the vulnerable code path actually used in your app?
- Example: a vulnerability in a test utility you don't use in production = low risk

**Step 3: Fix it**

Option A — Upgrade the package:
```bash
npm install package-name@latest
npm run build  # Verify nothing breaks
```

Option B — If the vulnerable package is a sub-dependency:
```bash
npm audit fix
```

Option C — If no fix exists yet:
- Check if the vulnerability is reachable in your code
- If not reachable, add to Snyk ignore with justification
- Monitor for a patched version

**Step 4: Verify**
```bash
npm audit  # Should show fewer/no vulnerabilities
npm run build  # App still builds
npm test  # Tests still pass
```

**Step 5: Deploy**
- Commit the `package.json` and `package-lock.json` changes
- Push to trigger CI
- Verify Snyk job passes

---

### 3.3 RLS Test Failure

**Step 1: Run tests locally**
```bash
npm test
```

**Step 2: Identify which policy failed**
- Test output shows: table name, operation type, expected behavior
- Example: "User A should NOT be able to update User B's profile" — FAILED

**Step 3: Fix the RLS policy**
- Open Supabase > SQL Editor
- Check the policy on the affected table
- Fix the `USING` or `WITH CHECK` clause

**Step 4: Re-run tests**
```bash
npm test  # All 44 tests should pass
```

---

### 3.4 Rate Limit Abuse Detected

**Symptoms:**
- High number of 429 responses in server logs
- Unusual Gemini API cost spike
- Redis rate limit keys for a single user ID appearing frequently

**Step 1: Identify the user**
- Check Upstash Redis for the rate limit key: `rl:ai:{user_id}`
- Cross-reference with Supabase > Authentication > Users

**Step 2: Assess intent**
- Is it a legitimate power user hitting limits?
- Is it automated abuse (bot behavior)?

**Step 3: Respond**

| Situation | Action |
|-----------|--------|
| Legitimate user, needs more | Consider increasing their limit |
| Bot/abuse from single account | Ban the account in Supabase Auth |
| Multiple fake accounts | Add CAPTCHA to signup (already done) |
| Distributed attack | Add IP-based rate limiting (Vercel Edge) |

---

### 3.5 Payment Fraud Detected

**Symptoms:**
- Orders in `payments` table with mismatched user IDs
- Multiple failed verification attempts
- Unusual order creation patterns

**Step 1: Check the payments table**
```sql
SELECT * FROM payments
WHERE status != 'paid'
ORDER BY created_at DESC
LIMIT 50;
```

**Step 2: Check for abuse patterns**
```sql
SELECT user_id, COUNT(*) as order_count
FROM payments
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY order_count DESC;
```

**Step 3: Respond**
- Block the user account if confirmed fraud
- Report to Cashfree if payment system is being exploited
- Review server logs for the specific order IDs

---

### 3.6 Gemini API Misuse / Cost Spike

**Symptoms:**
- Google AI Studio shows unexpected cost increase
- `ai_generations` table shows abnormally high volume from one user
- Upstash Redis shows repeated `rl:ai:{user_id}` key hits (user hammering the limit)

**Step 1: Identify the source**
```sql
-- Top AI users in last 24 hours
SELECT user_id, COUNT(*) as calls, MIN(created_at) as first, MAX(created_at) as last
FROM ai_generations
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY calls DESC
LIMIT 10;
```

**Step 2: Check if it's within expected bounds**

| User Type | Normal Usage | Abuse Threshold |
|-----------|-------------|-----------------|
| Free user | 1 generation/day | >5 calls/day (bypassing limits) |
| Pro user | 10-50 calls/day | >200 calls/day |

**Step 3: Check the rate limiter is working**
```sql
-- Check if user's daily counter is being enforced
SELECT id, email, is_pro_member, study_ai_generations_today, study_ai_last_generation_date
FROM profiles
WHERE id = '<suspicious_user_id>';
```

**Step 4: Respond**

| Situation | Action |
|-----------|--------|
| Free user exceeding 1/day | Bug in daily limit logic — fix `generate/route.ts` |
| Pro user >200/day | Add a daily cap for Pro users (e.g., 200/day) |
| Rate limiter not blocking | Check Upstash Redis connection, verify `rate-limit.ts` |
| Multiple accounts from same person | Check signup IPs/patterns, strengthen CAPTCHA |
| API key exposed externally | Rotate `GOOGLE_GEMINI_API_KEY` immediately |

**Step 5: Temporary mitigation**
- If costs are spiking NOW, disable the Gemini API key temporarily in Google AI Studio
- This will return 500 errors to all users but stops the billing
- Re-enable after fixing the root cause

---

### 3.7 User Data Leak Detection

**Symptoms:**
- User reports seeing another user's data
- Unusual SELECT patterns in Supabase logs
- RLS tests failing on specific tables

**Step 1: Verify RLS is enforced**
```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- All should show rowsecurity = true
```

**Step 2: Check for overly permissive policies**
```sql
-- Find any remaining USING (true) policies (should be none)
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual::text LIKE '%true%';
```

**Step 3: Verify write-ownership policies exist**
```sql
-- Check write policies reference auth.uid()
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename, cmd;
-- All should reference auth.uid()
```

**Step 4: Run automated RLS tests**
```bash
npm test
# All 44 tests must pass
```

**Step 5: If a leak is confirmed**

| Scenario | Immediate Action |
|----------|-----------------|
| User A can read User B's private data | Fix the SELECT policy to add ownership check |
| User A can modify User B's data | Fix the INSERT/UPDATE/DELETE policy |
| Data exposed via public Storage URL | Make bucket private (already done) |
| Data exposed via API route | Add `auth.uid()` check in the route handler |
| Client-side Supabase call leaking data | RLS should still protect — but migrate to API route (Phase G) |

**Step 6: Notify affected users**
- If confirmed data was exposed, notify the affected users
- Document what was exposed, when, and what was fixed
- Consider mandatory password reset if auth data was involved

---

### 3.8 Payment Data Leak / Manipulation

**Symptoms:**
- User gains Pro status without a valid payment
- `payments` table shows orders with status "paid" but no matching Cashfree transaction
- Users on Pro that shouldn't be

**Step 1: Audit Pro memberships**
```sql
-- Find Pro users and their payment history
SELECT p.id, p.email, p.is_pro_member, p.pro_expires_at,
       COUNT(pay.id) as payment_count,
       MAX(pay.created_at) as last_payment
FROM profiles p
LEFT JOIN payments pay ON pay.user_id = p.id AND pay.status = 'paid'
WHERE p.is_pro_member = true
GROUP BY p.id, p.email, p.is_pro_member, p.pro_expires_at
ORDER BY last_payment DESC NULLS FIRST;
-- Any Pro user with 0 payments or NULL last_payment is suspicious
```

**Step 2: Cross-check with Cashfree**
```sql
-- Get order IDs to verify on Cashfree dashboard
SELECT order_id, user_id, amount, status, created_at
FROM payments
WHERE status = 'paid'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```
- Cross-reference each `order_id` on merchant.cashfree.com
- Verify the amounts match and orders are genuine

**Step 3: Check for forged payments**
```sql
-- Users who modified their own profile to Pro (bypassing payment)
-- This should be impossible with RLS, but check:
SELECT id, email, is_pro_member, updated_at
FROM profiles
WHERE is_pro_member = true
  AND id NOT IN (SELECT user_id FROM payments WHERE status = 'paid');
```

**Step 4: Respond**

| Scenario | Action |
|----------|--------|
| User has Pro but no payment record | Revoke Pro: `UPDATE profiles SET is_pro_member = false WHERE id = '<id>'` |
| Payment record exists but Cashfree has no matching order | Forged payment — revoke Pro, ban user |
| Cashfree webhook signature mismatch | Bug in verification — fix `verify-payment/route.ts` |
| Multiple accounts using same payment | Check `customer_id` in Cashfree, ban duplicates |

**Step 5: Strengthen protections**
- Verify the `verify-payment/route.ts` checks `customer_id` matches `auth.uid()`
- Ensure `is_pro_member` can only be set by the API route (not by client-side RLS)
- Consider adding a cron job that checks Pro users against `payments` table daily

---

### 3.9 Client-Side Browser Attack Testing

**Purpose:** Verify that a malicious user with browser DevTools cannot bypass security. Run these checks after any major code change.

---

#### Test 1: Direct Supabase Calls from Browser Console

A malicious user can open DevTools and try to call Supabase directly using the anon key (which is public). RLS must block them.

**How to test:**
1. Log in as User A
2. Open browser console (F12 > Console)
3. Try these attacks:

```javascript
// Get the Supabase client from the window (it's in your app bundle)
// Or create one manually:
const { createClient } = await import('https://esm.sh/@supabase/supabase-js');
const supabase = createClient(
  'YOUR_SUPABASE_URL',  // public, visible in network tab
  'YOUR_ANON_KEY'       // public, visible in network tab
);

// ATTACK 1: Try to read another user's study logs
const { data } = await supabase
  .from('daily_study_logs')
  .select('*')
  .eq('user_id', 'some-other-user-id');
// EXPECTED: data is empty [] (RLS blocks cross-user reads on personal tables)

// ATTACK 2: Try to insert XP for another user
const { error } = await supabase
  .from('xp_transactions')
  .insert({ user_id: 'other-user-id', amount: 9999, reason: 'hacked' });
// EXPECTED: error (RLS: user_id must match auth.uid())

// ATTACK 3: Try to make yourself Pro
const { error: proError } = await supabase
  .from('profiles')
  .update({ is_pro_member: true, pro_expires_at: '2030-01-01' })
  .eq('id', 'your-own-id');
// EXPECTED: succeeds on own profile BUT verify-payment route checks payment records
// The real protection is that Pro status is verified server-side

// ATTACK 4: Try to insert a fake payment
const { error: payError } = await supabase
  .from('payments')
  .insert({ user_id: 'your-id', status: 'paid', amount: 0, order_id: 'fake' });
// EXPECTED: insert succeeds (RLS allows own inserts) BUT:
// - verify-payment route checks Cashfree API directly
// - Pro status only set by server after Cashfree confirms

// ATTACK 5: Try to modify another user's profile
const { error: profileError } = await supabase
  .from('profiles')
  .update({ display_name: 'HACKED' })
  .eq('id', 'other-user-id');
// EXPECTED: error (RLS: id must match auth.uid())

// ATTACK 6: Try to delete another user's messages
const { error: msgError } = await supabase
  .from('messages')
  .delete()
  .eq('user_id', 'other-user-id');
// EXPECTED: error (RLS: user_id must match auth.uid())

// ATTACK 7: Try to read admin tables
const { data: tests } = await supabase
  .from('tests')
  .select('*');
// EXPECTED: returns data (SELECT is allowed for authenticated users)
// This is intentional — tests/questions are public content

// ATTACK 8: Try to create a fake test (admin-only)
const { error: testError } = await supabase
  .from('tests')
  .insert({ title: 'Fake Test', category_id: 1 });
// EXPECTED: error (no INSERT policy for regular users)
```

**Expected results — all attacks blocked:**

| Attack | Expected Result | Protected By |
|--------|----------------|--------------|
| Read other user's data | Empty array or error | RLS SELECT policy |
| Insert XP for other user | Error | RLS: `user_id = auth.uid()` |
| Self-promote to Pro | Update succeeds, but no effect | Server verifies Cashfree |
| Insert fake payment | Insert succeeds, but no effect | `verify-payment` checks Cashfree API |
| Modify other user's profile | Error | RLS: `id = auth.uid()` |
| Delete other user's messages | Error | RLS: `user_id = auth.uid()` |
| Create fake test | Error | No INSERT policy exists |
| Access Gemini API directly | Impossible | Key is server-side only |

---

#### Test 2: Network Tab Request Manipulation

A malicious user can intercept and modify API requests.

**How to test:**
1. Open DevTools > Network tab
2. Use the AI feature normally
3. Right-click the request > "Copy as cURL"
4. Modify the request and replay:

```bash
# Try calling AI endpoint without auth cookie
curl -X POST https://yourapp.vercel.app/api/study-ai/generate \
  -H "Content-Type: application/json" \
  -d '{"content":"test","type":"flashcards"}'
# EXPECTED: 401 Unauthorized

# Try calling with someone else's user context (impossible without their session)
# The session cookie is httpOnly — cannot be read/modified by JavaScript

# Try calling payment verify with a fake order
curl -X POST https://yourapp.vercel.app/api/cashfree/verify-payment \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-valid-cookie>" \
  -d '{"orderId":"fake-order-123"}'
# EXPECTED: 400 "Payment not confirmed" (Cashfree API rejects fake orders)
```

**What's protected:**

| Attack | Protection |
|--------|-----------|
| Remove auth cookie | API returns 401 |
| Forge auth cookie | Supabase JWT verification rejects invalid tokens |
| Replay old request | Rate limiter counts it, session may be expired |
| Modify request body | Zod validation rejects invalid schemas |
| Call AI endpoint rapidly | Rate limiter: 10/min per user |
| Tamper with payment amount | Amounts are hardcoded server-side |

---

#### Test 3: Client-Side State Manipulation

A malicious user can modify Zustand store values in memory.

**How to test:**
1. Open DevTools > Console
2. Try to manipulate React state:

```javascript
// Even if a user modifies the client-side store:
// e.g., setting is_pro_member = true in local state
// This only affects the UI temporarily — the server always re-checks:
// - AI endpoints check profile.is_pro_member from database
// - Payment routes check Cashfree directly
// - XP/achievements are validated server-side via RPC functions
```

**Why this doesn't matter:**
- Client state is display-only — all business logic runs server-side
- RLS enforces ownership regardless of what the client sends
- API routes re-validate auth and permissions on every request
- A refresh reloads true state from the database

---

#### Test 4: Storage URL Guessing

**How to test:**
```bash
# Try to access a storage file directly without auth
curl https://YOUR_SUPABASE_URL/storage/v1/object/public/study-ai-uploads/somefile.pdf
# EXPECTED: 400 or 404 (bucket is private, no public access)

# Try to access with a guessed file path
curl https://YOUR_SUPABASE_URL/storage/v1/object/study-ai-uploads/user-id/file.pdf
# EXPECTED: 401 (requires valid auth token)
```

**What's protected:**
- All buckets are private (toggled off in dashboard)
- Files are only accessible via signed URLs (time-limited, 1 hour)
- File paths use UUIDs (unpredictable)

---

#### Test 5: XSS (Cross-Site Scripting) Attempts

**How to test:**
1. Try entering script tags in any input field:

```
<script>alert('xss')</script>
<img src=x onerror=alert('xss')>
javascript:alert('xss')
```

2. Check if the input is rendered raw or escaped

**What's protected:**
- React escapes all rendered content by default
- `dangerouslySetInnerHTML` is not used (or used safely with sanitized content)
- User input goes through Zod validation before processing
- Gemini AI output is displayed as text/markdown, not raw HTML

---

#### Test 6: CSRF (Cross-Site Request Forgery)

**How to test:**
1. Create a malicious HTML page on a different domain:
```html
<form action="https://yourapp.vercel.app/api/cashfree/create-order" method="POST">
  <input name="planId" value="pro_monthly">
  <button>Click me!</button>
</form>
```
2. Open this page while logged into your app in another tab

**What's protected:**
- Supabase auth cookies are `SameSite=Lax` (not sent on cross-origin POSTs)
- Payment endpoints require Turnstile CAPTCHA token (attacker can't generate one)
- API routes verify the session server-side

---

#### Summary: What a Malicious Browser User CANNOT Do

| Action | Why It Fails |
|--------|-------------|
| Read other users' private data | RLS SELECT policies with ownership check |
| Modify other users' data | RLS INSERT/UPDATE/DELETE with `user_id = auth.uid()` |
| Call Gemini API directly | API key is server-side only, never in browser |
| Bypass rate limits | Rate limiter is server-side (Upstash Redis) |
| Fake a payment | Server verifies directly with Cashfree API |
| Get Pro without paying | `is_pro_member` only set after Cashfree confirmation |
| Access private storage files | Buckets are private, need signed URLs |
| Create admin content (tests/questions) | No INSERT/UPDATE policies for regular users |
| XSS other users | React escapes content, no raw HTML rendering |
| CSRF attacks | SameSite cookies + CAPTCHA on sensitive routes |
| Forge auth tokens | Supabase JWT verification with server secret |
| Manipulate client state for profit | Server re-validates everything on each request |

---

## 4. Emergency Contacts & Links

| Service | Dashboard | Action |
|---------|-----------|--------|
| Supabase | supabase.com/dashboard | Rotate keys, check RLS |
| Vercel | vercel.com/dashboard | Check logs, update env vars |
| GitGuardian | dashboard.gitguardian.com | Review incidents |
| Snyk | app.snyk.io | Review vulnerabilities |
| Cashfree | merchant.cashfree.com | Check orders, rotate keys |
| Google AI Studio | aistudio.google.com | Check API usage, rotate keys |
| Upstash | console.upstash.com | Check Redis usage |
| Cloudflare | dash.cloudflare.com | Check Turnstile, rotate keys |
| GitHub | github.com/himyeticapital/prepspsc/security | Security alerts |

---

## 5. Prevention Best Practices

1. **Never hardcode secrets** — always use environment variables
2. **Never commit `.env.local`** — it's in `.gitignore`
3. **Always run `npm test`** before deploying RLS changes
4. **Review Dependabot PRs** when they appear
5. **Keep the pre-commit hook active** — don't skip with `--no-verify`
6. **Use the service role key only in server-side API routes** — never in client code
7. **Check CI is green** before merging PRs to main
8. **Rotate keys periodically** (every 3-6 months) even without incidents
