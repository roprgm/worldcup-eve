import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion calls the bracket tool once and shows the circular bracket via a bracket block.",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.succeeded();
    t.calledTool("bracket");
    t.messageIncludes("```bracket");
    // One `bracket` call is enough — never loop `outlook` over the knockout
    // slots (73–104) to rebuild the field by hand.
    t.notCalledTool("outlook");
    t.maxToolCalls(1);
    t.noFailedActions();
  },
});
