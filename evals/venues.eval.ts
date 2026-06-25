import { defineEval } from "eve/evals";

export default defineEval({
  description: "A stadium/venue question loads the worldcup_venues skill.",
  async test(t) {
    await t.send("Where is match 50 played?");

    t.completed();
    t.loadedSkill("worldcup_venues");
  },
});
