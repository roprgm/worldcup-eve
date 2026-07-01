import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion shows the circular bracket via a bracket block.",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.completed();
    t.messageIncludes("```bracket");
    t.noFailedActions();
  },
});
