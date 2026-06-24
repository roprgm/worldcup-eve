import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

// A small, fixed catalog for the match-card widget.
//
// The agent never generates these specs. We build them deterministically from
// `get_match_results` output (see match-card.ts) — the "no-ai" json-render
// pattern — so the open model never has to emit valid UI. The catalog still
// earns its keep: it types the props so the registry and the spec builder stay
// in sync, and it leaves the door open for model-generated specs later via
// `catalog.prompt()`.
export const catalog = defineCatalog(schema, {
  components: {
    MatchList: {
      description: "Vertical list wrapper for one or more match cards.",
      props: z.object({}),
    },
    MatchCard: {
      description: "A single match: a status header above two team rows.",
      props: z.object({
        status: z.enum(["scheduled", "live", "final"]),
        statusLabel: z
          .string()
          .describe("Kickoff time, live clock, or final-status label."),
      }),
    },
    TeamRow: {
      description: "One team line inside a match card.",
      props: z.object({
        name: z.string(),
        abbreviation: z.string().optional(),
        score: z.string().optional(),
        winner: z.boolean().optional(),
      }),
    },
  },
  actions: {},
});
