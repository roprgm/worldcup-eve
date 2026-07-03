# arena

WorldCup Arena — a bench where different AI models predict the knockout bracket,
and we score them against reality as the tournament unfolds.

A bracket is just a set of winners. Rather than ask a model for that shape all at
once, we turn it into a chain of single-match **"A or B" questions**: walk the
knockout graph from the Round of 32 inward, and every undecided match whose two
teams are known becomes one question. Each answer advances a team, which resolves
the matchups of later rounds — so by the final the whole bracket is filled from
nothing but binary picks. Matches that already have a real result are used as-is
(never asked); a match with an unresolved side is skipped.

## Pieces

- `board.ts` — the live board a prediction is laid over: the R32 slot occupants
  and the knockout matches already won, derived from the `results` feed. Shared
  with the `/bracket` builder.
- `bracket.ts` — `predictBracket(board, decide)` walks the bracket and asks
  `decide` one match at a time. Provider-agnostic: the decider is any
  `(matchup) => { pick }`.
- `score.ts` — `scoreRun(picks, results)`: a correct pick is worth its round's
  weight, doubling each round (R32 = 1 … final = 16). Only decided matches count.
- `storage.ts` / `types.ts` — one Vercel Blob per run plus a small index blob;
  each run stores its picks, timing/token metadata and the full conversation.
- `run.ts` — the bench script (`bun run arena`).

## Running the bench

Runs locally to populate `/arena`; it is never triggered automatically. Needs
`AI_GATEWAY_API_KEY` (models route through the Vercel AI Gateway) and a blob
store (`BLOB_READ_WRITE_TOKEN`, or a linked `BLOB_STORE_ID`).

```bash
bun run arena                                    # the default line-up
bun run arena anthropic/claude-sonnet-5 openai/gpt-5
```

Each model gets a fresh conversation: a system prompt, then one question per
undecided match. The predicted bracket, execution time, token usage and the
whole transcript are written to blob storage, and the run shows up on `/arena`.
