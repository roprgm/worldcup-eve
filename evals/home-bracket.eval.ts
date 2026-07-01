import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion shows the circular bracket via a bracket block, with no tool calls (the widget self-fetches).",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.succeeded();
    t.messageIncludes("```bracket");
    // The bracket widget self-fetches, so the answer must not loop `outlook`
    // (or any tool) over the knockout slots to rebuild it by hand.
    t.usedNoTools();
    t.noFailedActions();
  },
});
