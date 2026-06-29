import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A question about a single named matchup stays on that one fixture and never falls back to the road-to-the-final widget.",
  async test(t) {
    await t.send("When is Argentina vs Cape Verde played?");

    t.completed();
    // The road-to-the-final widget is for a whole route, not one opponent.
    t.notCalledTool("show_team_path");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the single Argentina vs Cape Verde match (when/where it's played or its odds), rather than listing a team's full path through several rounds?",
    );
  },
});
