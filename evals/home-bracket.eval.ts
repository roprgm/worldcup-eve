import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion shows the circular bracket via a bracket block.",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.succeeded();
    // One outlook call summarizes the whole bracket for the spoken line; the
    // widget self-fetches the rest — never a fan-out of per-match calls.
    t.calledTool("outlook", { count: 1 });
    t.notCalledTool("odds");
    t.notCalledTool("matches");
    t.messageIncludes("```bracket");
  },
});
