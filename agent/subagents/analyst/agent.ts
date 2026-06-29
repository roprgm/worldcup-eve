import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Smarter reasoner for hard World Cup questions the base agent can't settle with one obvious tool: hypothetical or what-if scenarios, multi-step or chained knockout reasoning, and comparisons across several forecasts. Give it all the context it needs; it returns a clear, conversational answer.",
  // Reasoning model — used only on delegation, where deliberation pays off.
  model: "openai/gpt-oss-120b",
  modelOptions: {
    providerOptions: {
      gateway: { order: ["cerebras", "groq", "fireworks"] },
      openai: { reasoningEffort: "medium" },
    },
  },
});
