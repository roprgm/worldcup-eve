import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'where does X play its knockout rounds' question answers with the fixed stadiums via show_team_path, never claiming they are TBD.",
  async test(t) {
    await t.send("¿Dónde juega Argentina los dieciseisavos y los octavos?");

    t.completed();
    t.calledTool("show_team_path");
    t.noFailedActions();
    t.judge.autoevals.closedQA(
      "Does the answer give a specific stadium for both knockout rounds asked about?",
    );
    t.judge.autoevals.closedQA(
      "Does the answer avoid claiming the knockout-stage stadiums are undecided, TBD, or not yet announced?",
    );
  },
});
