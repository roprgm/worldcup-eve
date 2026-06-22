# World Cup Agent

A tiny example agent built with [**eve**](https://github.com/vercel/eve).
It answers questions about the 2026 FIFA World Cup.

## Run it

Prerequisites: **Node 24+** and a model credential. The default model is `openai/gpt-5-nano`,
so set `OPENAI_API_KEY` (or route through the Vercel AI Gateway with `AI_GATEWAY_API_KEY`).
Change the model in `agent/agent.ts` to use a different provider.

```bash
npm install
npm run dev
```

`npm run dev` opens an interactive terminal UI. Try:

- "When does match 1 kick off?"
- "What were the results on June 19, 2026?"
- "What happened in match 29?"

## Test it

```bash
npm run typecheck   # tsc --noEmit
npx eve eval        # run the evals against a local dev server
```

## Learn more

The full eve documentation ships inside the package at `node_modules/eve/docs/` — start with
`getting-started.mdx` and `introduction.mdx`.
