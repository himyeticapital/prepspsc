# Security & Architecture Rules

## Reporting a vulnerability

Please report security issues privately. Use GitHub's **Report a vulnerability** button on the repository's Security tab, or email support@prepspsc.com. Do not open a public issue. We aim to reply within 7 days.


This project enforces a **STRICT "Backend-First" security model**.
All contributors and AI tools MUST follow these constraints.

---

## 1. Architecture: Backend-Only Data Access

- **NEVER** write business logic in Client Components.
- **NEVER** use `supabase-js` client-side methods (`.select`, `.insert`, `.update`, `.delete`) directly in the frontend.
- **ALWAYS** use Next.js API Routes or Server Actions for ALL data access (Read & Write).
- The Frontend is a View Layer only. It speaks to APIs, not the Database.

**Compliance:** VIOLATION — 80+ client-side Supabase calls in stores/components (deferred fix).

---

## 2. Database & RLS — The "Zero Policy" Rule

- **RLS IS MANDATORY:** Enable Row Level Security on every table.
- **NO POLICIES ALLOWED:** Do NOT create permissive RLS policies (`USING (true)`).
  - Enabling RLS without policies acts as a "Deny All" firewall.
  - The `anon` key (Client) should have ZERO direct data access.
- **SERVICE ROLE ONLY:** All data interaction must occur via the `service_role` key inside API Routes.

**Compliance:** PARTIAL — Several tables still have `USING (true)` policies.

---

## 3. Storage Security: Private Bucket Protocol

- **NO PUBLIC BUCKETS:** Never set `public: true` for storage buckets.
- **UUID FILENAMES:** Always rename files to `crypto.randomUUID()` before uploading.
- **SIGNED URLS:** Always use `createSignedUrl` for retrieving files. Never expose direct paths.

**Compliance:** FIXED — Using UUID filenames and signed URLs.

---

## 4. Payments & Webhooks: Verify the Signature

- **NEVER** trust `req.body` directly in webhook handlers.
- **ALWAYS** use the provider's SDK to verify cryptographic signatures.
- If verification fails, return `400` immediately.

**Compliance:** FIXED — Cashfree signature verification implemented.

---

## 5. Environment Variables: Strict Hygiene

- **NEVER** hardcode secrets in source code.
- If you see a secret in the code, replace it with `process.env.VAR_NAME`.
- **VALIDATION:** Environment variables are validated using Zod at build time.

**Compliance:** FIXED — Build-time Zod validation in `src/lib/env.ts`.

---

## 6. Input Validation & Rate Limiting

- **TRUST NO ONE:** Validate ALL inputs in API Routes using Zod.
- **RATE LIMITS:** All mutation endpoints have Upstash Redis rate limiting, especially auth and payment routes.

**Compliance:** DONE — All API routes have Zod validation and rate limiting.

---

## 7. RPC Lockdown

- **REVOKE PUBLIC ACCESS:** When creating a Postgres function:
  - ALWAYS run: `REVOKE EXECUTE ON FUNCTION function_name FROM public;`
  - ALWAYS run: `REVOKE EXECUTE ON FUNCTION function_name FROM anon;`
  - Grant access only to `authenticated` or `service_role`.

**Compliance:** COMPLIANT — All 15 functions grant only to `authenticated`.

---

## Compliance Check

Before generating code, ask: **"Is this code asking the Frontend to talk to the Database?"**

If YES → REJECT IT. Write a Backend API Route instead.

---

## Known Violations (Deferred)

The following files contain client-side Supabase calls that should be migrated to API routes:

| File | Calls |
|------|-------|
| `src/stores/gamification-store.ts` | 25+ |
| `src/stores/study-ai-store.ts` | 20+ |
| `src/stores/room-store.ts` | 18+ |
| `src/stores/table-store.ts` | 5 |
| `src/stores/auth-store.ts` | 3 |
| `src/components/rooms/room-card.tsx` | 2 |
| `src/components/widgets/leaderboard-widget.tsx` | 3 |
| `src/hooks/use-revision-checker.ts` | 1 |
| `src/hooks/use-permissions.ts` | 2 |

These should be incrementally migrated to server-side API routes.
