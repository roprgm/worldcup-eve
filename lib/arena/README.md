# arena

WorldCup Arena — a bench where different AI models predict the knockout bracket,
and we score them against reality as the tournament unfolds.

A bracket is just a set of winners. Rather than ask a model for that shape all at
once, we turn it into a chain of single-match **"A or B" questions**: walk the
knockout graph from the Round of 32 inward, and every match becomes one question.
Each answer advances a team, which resolves the matchups of the later rounds — so
by the final the whole bracket is filled from nothing but binary picks.

The matchups are built purely from the model's **own** picks, and the model is
never told which games have actually been played — a "past" tie looks exactly
like a future one. So it commits to a complete, self-consistent forecast (every
round, played or not), which keeps the comparison fair and avoids leaking real
results into the prompt. Each answer also carries a short written reason (and the
provider's native reasoning tokens, when returned), stored with the pick.

## Pieces

- `board.ts` — the live board a prediction is laid over: the R32 slot occupants
  and the knockout matches already won, derived from the `results` feed. Shared
  with the `/bracket` builder.
- `bracket.ts` — `predictBracket(board, decide)` walks the bracket and asks
  `decide` one match at a time. Provider-agnostic: the decider is any
  `(matchup) => { pick, reasoning? }`.
- `score.ts` — `scoreRun(picks, results)`: a correct pick is worth its round's
  weight, doubling each round (R32 = 1 … final = 16). Only decided matches count.
  `rankRuns` orders the whole field (shared by the leaderboard and the pager).
- `db.ts` / `storage.ts` / `types.ts` — one Neon (Postgres) table, `arena_runs`,
  with the whole run in a `jsonb` column; the list is a query (the summary each
  row needs is projected in SQL, so the conversation is never fetched). The table
  is created on demand — no migration step. `modelSlug` gives the readable run id
  (`openai/gpt-5` → `gpt-5`), and `saveRun` upserts, so re-running a model updates
  its row in place.
- `run.ts` — the bench script (`bun run arena`).

## Running the bench

Runs locally to populate `/arena`; it is never triggered automatically. Needs
`AI_GATEWAY_API_KEY` (models route through the Vercel AI Gateway) and `DATABASE_URL`
(the Neon connection string) — `vercel env pull` provides both.

```bash
bun run arena                                    # the default line-up
bun run arena anthropic/claude-sonnet-5 openai/gpt-5
```

Each model gets a fresh conversation: a system prompt, then one question per
knockout match. The predicted bracket, execution time, token usage and the
whole transcript are written to Neon, and the run shows up on `/arena`.
