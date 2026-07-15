import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5",
  reasoning: "low",
  build: {
    externalDependencies: ["@guanmingchiu/sqlparser-ts"],
  },
  modelOptions: {
    providerOptions: {
      anthropic: {
        thinkingBudget: 0.0001,
      },
    },
  },
  limits: {
    maxInputTokensPerSession: 100_000,
    maxOutputTokensPerSession: 20_000,
  },
});
