# Contributing to PrepSPSC

Thanks for helping Sikkim PSC aspirants. PrepSPSC is free for every student, and the code is open so anyone can improve it.

## Ways to help

- **Build a feature or fix a bug.** Look for issues labelled `good first issue` or `help wanted`, or open an issue to propose an idea first.
- **Improve exam content.** Better PYQ tagging, syllabus data and explanations help every student.
- **Improve the docs.** Setup steps, screenshots, translations.
- **Sponsor the AI bill.** PrepSPSC's AI features run on Google Gemini, and every sponsorship goes toward that bill. Use the **Sponsor** button on the repo page.

## Run it locally

You need Node.js 18+, a free [Supabase](https://supabase.com) project and a free [Google AI Studio](https://aistudio.google.com/apikey) API key.

1. Fork the repo and clone your fork.
2. `npm install`
3. Copy `.env.example` to `.env.local`. Fill in your own Supabase URL and keys and your Gemini key. Upstash, Turnstile, Resend and Cashfree are optional for most work, so leave their placeholders unless your change touches them.
4. Set up the database in your Supabase project. See *Set up Supabase* in the [README](README.md#2-set-up-supabase).
5. Deploy the edge functions you need: `npx supabase functions deploy <name> --project-ref <your-project-ref>`
6. `npm run dev`, then open http://localhost:3000.

Never use the production PrepSPSC project or anyone else's keys. Your fork talks only to your own Supabase project.

## Making a change

1. Create a branch: `git checkout -b feature/short-name`.
2. Write a test first for new behaviour (`tests/`, run with `npm test`), then the code. See [CLAUDE.md](CLAUDE.md) for conventions.
3. Run `npm run lint` and `npx tsc --noEmit` before you push.
4. Open a pull request against `main`. Say what changed and why, and add screenshots for UI changes.

A maintainer reviews every pull request before it is merged and deployed to prepspsc.com.

## Ground rules

- **No secrets in commits.** Keys live in `.env.local` (git-ignored) or Vercel/Supabase settings.
- **No real user data.** Don't commit emails, names, phone numbers, database dumps or screenshots showing other people's accounts. Use made-up test data.
- **AI cost matters.** Students use PrepSPSC for free, so keep prompts lean, respect the per-user daily caps in `src/lib/daily-cap.ts`, and avoid extra Gemini calls.
- **Be kind.** Help newcomers and keep discussion about the work.

## Security issues

Please don't open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md) to report it privately.

## License

PrepSPSC is licensed under the [GNU AGPL-3.0](LICENSE). By contributing, you agree your contribution is released under the same license.
