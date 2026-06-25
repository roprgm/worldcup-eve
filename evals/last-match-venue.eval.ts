import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A past-match venue question loads the worldcup_venues skill and names a stadium.",
  async test(t) {
    await t.send("Where did Argentina play their last match?");

    t.completed();
    t.loadedSkill("worldcup_venues");
    t.noFailedActions();
    t.messageIncludes(/Stadium/i);
  },
});
