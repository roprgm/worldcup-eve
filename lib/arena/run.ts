// The WorldCup Arena bench. Asks each model to fill in the knockout bracket as a
// sequence of single-match "A or B" questions — Round of 32 inward to the final,
// each question resolved from the picks already made — then stores the predicted
// bracket, timing/token metadata and the full conversation to Vercel Blob.
//
// Run it locally (never imported), passing model ids or using the defaults:
//
//   bun run arena                                   # the default line-up
//   bun run arena anthropic/claude-sonnet-5 openai/gpt-5
//
// Needs AI_GATEWAY_API_KEY (models route through the Vercel AI Gateway) and a
// blob store (BLOB_READ_WRITE_TOKEN or a linked BLOB_STORE_ID) to persist runs.

import { generateText, type ModelMessage } from "ai";

import { buildResults } from "@/lib/results";
import { type Round, teamById } from "@/lib/tournament";
import { type Board, buildBoard, type TeamCode } from "./board";
import { type AskedQuestion, type Matchup, predictBracket } from "./bracket";
import { saveRun } from "./storage";
import type { ArenaRun, RunUsage } from "./types";

// Default line-up — every id is overridable from the command line. Kept small so
// a plain `bun run arena` is cheap; add more with args or edit this list.
const DEFAULT_MODELS = [
  "anthropic/claude-sonnet-5",
  "openai/gpt-5",
  "google/gemini-2.5-pro",
  "xai/grok-4",
];

// Friendlier names for the runs list; anything unlisted falls back to its id.
const MODEL_LABELS: Record<string, string> = {
  "anthropic/claude-sonnet-5": "Claude Sonnet 5",
  "anthropic/claude-opus-4.8": "Claude Opus 4.8",
  "openai/gpt-5": "GPT-5",
  "openai/gpt-5-mini": "GPT-5 mini",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "xai/grok-4": "Grok 4",
};

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  TP: "Third place",
  FINAL: "Final",
};

const SYSTEM_PROMPT = [
  "You are competing in the WorldCup Arena: predict the 2026 FIFA World Cup knockout bracket.",
  "You will be asked a sequence of single-match questions, one per knockout match, starting with the Round of 32 and moving inward to the final. Each later question already reflects the winners you picked in the earlier rounds.",
  "Knockout matches cannot end in a draw — a level score is settled in extra time or on penalties, so always name exactly one winner.",
  "Answer each question with only the winning team's 3-letter FIFA code (for example: BRA). Do not add any explanation.",
].join("\n");

const teamLabel = (code: TeamCode) =>
  `${code} (${teamById[code]?.name ?? code})`;

/** Which of the two contenders the reply names, or null if it names both or
 *  neither. Matches whole codes only, case-insensitively. */
function parsePick(
  reply: string,
  home: TeamCode,
  away: TeamCode,
): TeamCode | null {
  const up = reply.toUpperCase();
  const named = (code: TeamCode) => new RegExp(`\\b${code}\\b`).test(up);
  const h = named(home);
  const a = named(away);
  if (h && !a) return home;
  if (a && !h) return away;
  return null;
}

function addUsage(
  total: RunUsage,
  u: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  },
) {
  total.inputTokens += u.inputTokens ?? 0;
  total.outputTokens += u.outputTokens ?? 0;
  total.totalTokens +=
    u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/** Run one model over the board, keeping a single growing conversation so each
 *  answer sees the picks that led to the current matchup. */
async function runModel(model: string, board: Board): Promise<void> {
  const label = MODEL_LABELS[model] ?? model;
  const conversation: ModelMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];
  const usage: RunUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const started = Date.now();
  let error: string | undefined;

  const question = (m: Matchup, insist = false) =>
    `Match #${m.match} · ${ROUND_LABEL[m.round]}: ${teamLabel(m.home)} vs ${teamLabel(m.away)}. Who wins and advances?` +
    (insist
      ? ` Reply with ONLY ${m.home} or ${m.away}.`
      : ` Reply with just the winner's code (${m.home} or ${m.away}).`);

  const decide = async (m: Matchup) => {
    let raw = "";
    // One retry with a firmer instruction if the first reply is ambiguous.
    for (let attempt = 0; attempt < 2; attempt++) {
      conversation.push({ role: "user", content: question(m, attempt > 0) });
      const res = await generateText({
        model,
        messages: conversation,
        allowSystemInMessages: true, // the system prompt heads the stored transcript
      });
      raw = res.text.trim();
      conversation.push({ role: "assistant", content: raw });
      addUsage(usage, res.usage);
      const pick = parsePick(raw, m.home, m.away);
      if (pick) return { pick, raw };
    }
    // Fall back to the home side; the raw reply is stored so it's auditable.
    return { pick: m.home, raw };
  };

  let picks: Record<number, TeamCode> = {};
  let questions: AskedQuestion[] = [];
  process.stdout.write(`\n▶ ${label} (${model})\n`);
  try {
    const out = await predictBracket(board, decide);
    picks = out.picks;
    questions = out.questions;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${error}`);
  }

  // A model that failed before answering anything isn't worth a bracket entry.
  if (error && questions.length === 0) return;

  const run: ArenaRun = {
    id: newId(),
    model,
    label,
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    usage,
    board,
    picks,
    questions,
    champion: picks[104] ?? board.winners[104],
    conversation,
    error,
  };

  const saved = await saveRun(run);
  const champ = run.champion ? teamLabel(run.champion) : "—";
  console.log(
    `  ${saved ? "saved" : "NOT saved (blob storage unavailable)"} · ` +
      `${questions.length} picks · champion ${champ} · ` +
      `${usage.totalTokens.toLocaleString()} tokens · ${(run.durationMs / 1000).toFixed(1)}s`,
  );
}

const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_MODELS;

const results = await buildResults();
const board = buildBoard(results);
const openSlots = Object.keys(board.slots).length;
if (openSlots === 0) {
  console.error(
    "No Round-of-32 slots are settled yet — nothing to predict. Run once the group stage has produced the knockout matchups.",
  );
  process.exit(1);
}
console.log(
  `WorldCup Arena · ${models.length} model(s) · board has ${openSlots} known R32 slots, ${Object.keys(board.winners).length} decided knockout matches`,
);

for (const model of models) {
  await runModel(model, board);
}
