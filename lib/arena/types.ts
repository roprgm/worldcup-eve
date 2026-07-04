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

/** A run as the /arena page consumes it: everything except the heavy
 *  conversation, which only the (future) debug view needs. The whole field is
 *  loaded once so the list and the detail carousel run entirely client-side. */
export type ArenaRunView = Omit<ArenaRun, "conversation">;
