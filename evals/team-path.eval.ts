import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'road to the final' question shows the team's projected path via the team tool.",
  async test(t) {
    await t.send("Show me Argentina's path to the final");

    t.completed();
    t.calledTool("team");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer describe possible opponents on the way to the final?",
    );
    t.judge.autoevals.closedQA(
      "Does the answer avoid claiming the knockout-stage stadiums are undecided, TBD, or not yet announced?",
    );
  },
});
