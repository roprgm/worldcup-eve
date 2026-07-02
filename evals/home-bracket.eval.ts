import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion shows the circular bracket via a bracket block.",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.succeeded();
    // The bracket widget self-fetches, so the answer must be immediate: one
    // spoken line plus the block, with no tool round-trips first.
    t.usedNoTools();
    t.messageIncludes("```bracket");
  },
});
