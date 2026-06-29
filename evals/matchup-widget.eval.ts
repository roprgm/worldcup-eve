import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A single named matchup is forecast and, when it's a real fixture, shown with the single-match widget — never the road-to-the-final widget.",
  async test(t) {
    await t.send("When is Argentina vs Cape Verde played?");

    t.completed();
    t.calledTool("get_match_forecast");
    // The road-to-the-final widget is for a whole route, not one opponent.
    t.notCalledTool("show_team_path");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer address the single Argentina vs Cape Verde match (when/where it's played or its odds), rather than listing a team's full path through several rounds?",
    );
  },
});
