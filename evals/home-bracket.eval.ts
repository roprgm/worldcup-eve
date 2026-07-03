import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "The 'market's predicted bracket' home suggestion shows the circular bracket via show_bracket.",
  async test(t) {
    await t.send("Show me the market's predicted bracket");

    t.succeeded();
    // One show_bracket call summarizes the whole bracket for the spoken line;
    // the widget self-fetches the rest — never a fan-out of per-match calls.
    t.calledTool("show_bracket", { count: 1 });
    t.notCalledTool("odds");
    t.notCalledTool("matches");
  },
});
