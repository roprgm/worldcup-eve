# World Cup Eve App

A tiny [**eve**](https://github.com/vercel/eve) agent and Next.js chat app for questions about
the 2026 FIFA World Cup. The UI and the Eve routes share one origin, so the chat calls `/eve/v1/*`
directly.

## Run it

You need **Node 24+**, **Bun**, and a model credential. The default model is `openai/gpt-5-nano`,
so set `OPENAI_API_KEY` (or `AI_GATEWAY_API_KEY` for the Vercel AI Gateway). Change the model in
`agent/agent.ts` to use another provider.

```bash
bun install
bun run dev
```

Open `http://localhost:3000` and try:

- "When does match 1 kick off?"
- "What were the results on June 19, 2026?"
- "What happened in match 29?"

## Test it

```bash
bun run typecheck
bunx eve eval --url http://localhost:3000
```

## Build and deploy

`next.config.ts` wraps Next with `withEve`, so Vercel deploys the web app and Eve runtime as one
project.

```bash
bun run build
```

## Learn more

The full Eve docs ship in `node_modules/eve/docs/` — start with `getting-started.mdx`.
