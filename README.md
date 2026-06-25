# World Cup Eve

An Eve agent for answering questions about the World Cup.

Built with [Eve](https://github.com/vercel/eve), [Next.js](https://nextjs.org), and [AI SDK](https://ai-sdk.dev).

## Highlights

- ⚡ Live match context: scores, standings, and match events exposed to the Eve agent as typed tools
- 🧠 Open model routing: `gpt-oss-120b` served through the Vercel AI Gateway with provider ordering
- 💬 Resumable chats: each conversation gets a `/chat/<id>` URL and restores from browser storage
- 🧩 Complete Eve setup: tools, an on-demand skill, dynamic instructions, evals, and a chat UI in one small app

## Requirements

- Node.js 24+
- Bun
- `AI_GATEWAY_API_KEY` or another provider credential supported by your model

## Development

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
bun run typecheck
bun run format:check
bun run build
```

## Eve

- `agent/agent.ts` configures the model and provider routing
- `agent/tools/*` exposes typed tools to the agent
- `agent/skills/*` contains an on-demand skill
- `agent/instructions/*` adds dynamic instructions
- `evals/*` contains Eve evals for the agent behavior

`next.config.ts` wraps Next with `withEve`, so the web app and Eve runtime deploy as one project.

## Evals

```bash
bunx eve eval --url http://localhost:3000
```

## License

MIT
