# Vercel Coding Agent Setup

This repo now includes the app-side packages for:

- `@vercel/analytics`
- `@vercel/speed-insights`

## App telemetry

`src/app/layout.tsx` renders Vercel Web Analytics and Speed Insights by default outside tests.

Optional env flags:

- `NEXT_PUBLIC_VERCEL_TELEMETRY=false` disables both
- `NEXT_PUBLIC_VERCEL_ANALYTICS=false` disables only Web Analytics
- `NEXT_PUBLIC_VERCEL_SPEED_INSIGHTS=false` disables only Speed Insights

## Codex + Vercel AI Gateway

The Codex CLI can be routed through Vercel AI Gateway with a profile in `~/.codex/config.toml`.

Required shell env:

```bash
export AI_GATEWAY_API_KEY="your-vercel-ai-gateway-key"
```

Useful commands:

```bash
codex --profile vercel
codex --profile vercel-claude
codex mcp list
```

## Vercel skill + MCP

Install the Vercel AI SDK skill package for Codex:

```bash
npx skills add vercel/ai --skill ai-sdk
```

Add the hosted Vercel MCP server:

```bash
codex mcp add vercel --url https://mcp.vercel.com
```
