# Production Debugging Steps for PrepSPSC

## Quick Reference: The 6-Phase Debug Cycle

```
REPORT → REPRODUCE → ROOT CAUSE → FIX → VERIFY → DEPLOY
   ↓         ↓           ↓         ↓       ↓         ↓
 ~2min     ~5min       ~10min    ~15min   ~5min    ~5min
```

**Total time target: ~40 minutes for most bugs**

---

## Phase 1: TRIAGE (First 2 minutes)

### User Bug Report Template

Share this template with users (in-app feedback form, Discord, WhatsApp group, etc.):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐛 BUG REPORT - PrepSPSC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 WHERE did it happen?
Page/Screen: [e.g., Dashboard, Test Arena, AI Study, Login]
URL (if web):

❓ WHAT happened?
Describe the problem:


📋 WHAT did you expect to happen?


🔄 STEPS to reproduce:
1.
2.
3.

📱 DEVICE INFO:
- Device: [Phone model / Computer]
- App or Browser: [PrepSPSC App / Chrome / Safari / etc.]
- Version (if known):

📸 SCREENSHOT/VIDEO:
[Attach screenshot or screen recording]

⏰ WHEN did this start?
- [ ] Just now (first time)
- [ ] After recent update
- [ ] Happens sometimes
- [ ] Always happens

👤 YOUR INFO (optional):
- Username/Email:
- Subscription: [Free / Pro]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Quick Severity Assessment

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| **P0 - Critical** | App unusable, auth broken, data loss | Immediate |
| **P1 - High** | Major feature broken (tests, AI, payments) | < 1 hour |
| **P2 - Medium** | Feature degraded but usable | < 4 hours |
| **P3 - Low** | Minor UI issues, cosmetic | Next release |

---

## Ways to Collect Bug Reports from Users

### Option 1: In-App Feedback Button (Recommended)

Add a floating feedback button that opens a form. Consider using:
- **Sentry** - Error tracking + user feedback
- **LogRocket** - Session replay + feedback
- **Custom form** - Simple modal with the template above

### Option 2: Google Form

Create a Google Form with these fields:
1. Page/Screen (dropdown)
2. What happened? (text)
3. Steps to reproduce (text)
4. Device type (dropdown: Android/iOS/Web)
5. Browser (if web) (dropdown)
6. Screenshot (file upload)
7. Email (optional)

**Pros:** Free, easy to set up, responses in spreadsheet
**Link:** Share via in-app "Report Bug" button

### Option 3: Discord/WhatsApp Bug Channel

Create a dedicated `#bug-reports` channel with:
- Pinned message with the template above
- Bot to auto-format reports (Discord)
- Quick response from team

### Option 4: GitHub Issues (For Tech-Savvy Users)

If you have a public repo or want structured tracking:
- Create issue templates
- Users can attach screenshots directly
- Track status with labels

### Option 5: Email Template

For support email (support@prepspsc.com):
- Auto-reply with the bug report template
- Ask users to fill it out and reply back

---

## Phase 2: REPRODUCE (Next 5 minutes)

### Start Claude Code Session

```bash
cd path/to/prepspsc
claude
```

### Tell Claude Code the Issue

Paste this format:

```
PRODUCTION BUG REPORT:
━━━━━━━━━━━━━━━━━━━━━━
Feature: [e.g., "Test Arena", "AI Study Tools", "Login"]
Error message: [exact error or "no error shown"]
Page/Route: [e.g., /dashboard, /test-arena]

Steps to reproduce:
1. [First step]
2. [Second step]
3. [Bug occurs]

Expected: [what should happen]
Actual: [what actually happened]

User info:
- Device: [from report]
- Browser/App: [from report]
- Account type: [Free/Pro]
- Affected users: [one/some/all]

Screenshot attached: [yes/no - describe if yes]

Help me debug this systematically.
━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 3: ROOT CAUSE ANALYSIS (Next 10 minutes)

### Check Common Issue Sources (in order)

**1. Environment/Config Issues**
```
Check if this could be an environment issue:
- Supabase connection (NEXT_PUBLIC_SUPABASE_URL)
- API keys expired or misconfigured
- CORS issues
- Rate limiting
```

**2. Recent Changes**
```
What changed recently? Check:
- git log --oneline -10
- Any recent deployments?
- Database schema changes?
```

**3. Data Issues**
```
Could this be bad data?
- User-specific data corruption
- Missing required fields
- Type mismatches from database.types.ts
```

**4. Third-Party Services**
```
Check external service status:
- Supabase status (status.supabase.com)
- Razorpay status (for payments)
- Google Gemini API status (for AI features)
```

### Deep Analysis with Claude Code

```
Trace the code path for [feature]:
1. Find the component/page that handles this
2. Follow the data flow
3. Identify where it could fail
4. Show me the error handling
```

### Document Findings

```
ROOT CAUSE ANALYSIS:
━━━━━━━━━━━━━━━━━━━━
Error occurs at: [file:line]
Because: [specific reason]
Upstream cause: [what triggered it]
Confidence: [high/medium/low]
━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 4: IMPLEMENT FIX (Next 15 minutes)

### Apply the Fix

```
I've identified the root cause. Let's fix it:
- File: [path]
- Issue: [what's wrong]
- Fix: [what needs to change]

Apply the minimal fix needed.
```

### Fix Principles

- **Minimal change** - Don't refactor during emergencies
- **One thing at a time** - Single focused fix
- **Don't break other things** - Consider side effects
- **Add defensive code** - Prevent similar issues

---

## Phase 5: VERIFY (Next 5 minutes)

### Local Verification

```bash
npm run build  # Ensure it builds
npm run lint   # No new errors
npm run dev    # Test locally
```

### Manual Testing Checklist

```
VERIFICATION:
☐ Original bug fixed
☐ Related features work
☐ No console errors
☐ No TypeScript errors
☐ Build succeeds
☐ Tested on same device/browser as user
```

### Double-Check with Claude

```
Review the fix I just made:
1. Does it address the root cause?
2. Any edge cases missed?
3. Any potential regressions?
```

---

## Phase 6: DEPLOY (Final 5 minutes)

### Commit with Clear Message

```bash
git add [specific-files]
git commit -m "fix: [brief description]

Root cause: [what was wrong]
Fix: [what was changed]
Reported by: [user if known]"
```

### Deploy

Follow your deployment process.

### Confirm with User

- Notify the user who reported
- Ask them to verify the fix
- Monitor for similar reports

---

## Quick Debug Commands by Feature

### Auth/Login Issues
```
Debug auth issue - check:
- src/lib/supabase/client.ts
- src/middleware.ts
- src/app/(auth)/ routes
```

### AI Features Not Working
```
Debug AI issue - check:
- src/lib/gemini.ts
- src/app/api/study-ai/
- User's AI credit limits
```

### Payment Issues
```
Debug payment issue - check:
- src/app/api/razorpay/
- RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
- Webhook handling
```

### Database/Data Issues
```
Debug data issue - check:
- src/types/database.types.ts
- Supabase dashboard
- RLS policies
```

### UI/Component Issues
```
Debug UI issue - check:
- Specific component in src/components/
- Zustand store in src/stores/
- Hydration mismatches (SSR vs client)
```

---

## Emergency Rollback

If the fix introduces more problems:

```bash
# Revert the last commit
git revert HEAD

# Or reset to before your changes (CAREFUL - loses uncommitted work)
git reset --hard HEAD~1

# Redeploy previous version
```

---

## Post-Incident Checklist

After the fire is out:

- [ ] **Document** - What happened, why, how fixed
- [ ] **Respond to user** - Thank them for reporting
- [ ] **Add validation** - Prevent similar issues
- [ ] **Consider tests** - Add coverage for this case
- [ ] **Update FAQ** - If users might face this again

---

## Summary: Debug Flow with Claude Code

```
1. User reports bug (template)
        ↓
2. Start Claude: "PRODUCTION BUG: [paste report]"
        ↓
3. Claude explores & traces code
        ↓
4. Ask: "What's the root cause?"
        ↓
5. Claude identifies issue
        ↓
6. Say: "Fix it with minimal changes"
        ↓
7. Run: npm run build && npm run dev
        ↓
8. Manual verification
        ↓
9. Commit & deploy
        ↓
10. Confirm with user
```
