import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A team's 'next / upcoming match' question is anchored to now, not answered with finished fixtures presented as upcoming.",
  async test(t) {
    await t.send("¿Cuándo juega Argentina?");

    t.completed();
    t.calledTool("matches");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer avoid presenting an already-played match as if it were still upcoming? (If Argentina's group stage is over, it should point to the knockout path rather than list finished group games as future fixtures.)",
    );
  },
});
