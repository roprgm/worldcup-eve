// The stored shape of an arena run and its index entry.

import type { ModelMessage } from "ai";
import type { Board, TeamCode } from "./board";
import type { AskedQuestion } from "./bracket";

export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** One WorldCup Arena run: a model's predicted bracket plus the metadata and
 *  full transcript captured while producing it. Stored as one row in Neon. */
export interface ArenaRun {
  id: string;
  model: string; // AI Gateway model id, e.g. "anthropic/claude-sonnet-5"
  label: string; // display name
  createdAt: string; // ISO timestamp
  durationMs: number;
  usage: RunUsage;
  /** The board the run predicted over (R32 occupants + results known at run time). */
  board: Board;
  /** Predicted winners for the matches the run was asked about (match → team). */
  picks: Record<number, TeamCode>;
  /** The "A or B" questions asked, in order, with the model's pick. */
  questions: AskedQuestion[];
  champion?: TeamCode;
  /** The full model conversation, for debugging later. */
  conversation: ModelMessage[];
  /** Set when the run failed partway; the partial data above is still stored. */
  error?: string;
}

/** The per-run entry the list page needs to rank and score every run without
 *  fetching each full run: projected out of the stored run in SQL (see
 *  storage.ts). Carries the picks (a handful of match → team entries) since
 *  scoring is recomputed live against the latest results, but omits the heavy
 *  conversation. */
export interface ArenaRunSummary {
  id: string;
  model: string;
  label: string;
  createdAt: string;
  durationMs: number;
  usage: RunUsage;
  picks: Record<number, TeamCode>;
  champion?: TeamCode;
  questionCount: number;
  error?: string;
}
