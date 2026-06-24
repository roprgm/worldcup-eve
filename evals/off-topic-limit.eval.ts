import { defineEval } from "eve/evals";

export default defineEval({
  description: "Redirect unrelated requests without calling tools.",
  async test(t) {
    await t.send(
      "Necesito que me ayudes a escribir un contrato de alquiler muy detallado.",
    );

    t.completed();
    t.usedNoTools();
  },
});
