import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'matches today' question uses the match-card widget instead of the text-only results tool.",
  async test(t) {
    await t.send("Which matches are playing today?");

    t.completed();
    t.calledTool("show_matches", { input: { scope: "today" } });
    t.notCalledTool("get_match_results");
    t.noFailedActions();
    t.messageIncludes(/schedule|match|today/i);
  },
});
