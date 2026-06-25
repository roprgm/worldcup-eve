import { defineEval } from "eve/evals";

export default defineEval({
  description: "A fixture/kickoff question loads the worldcup_schedule skill.",
  async test(t) {
    await t.send("When does match 50 kick off?");

    t.completed();
    t.loadedSkill("worldcup_schedule");
    t.noFailedActions();
    t.messageIncludes(/:\d\d|UTC|Jun/i);
  },
});
