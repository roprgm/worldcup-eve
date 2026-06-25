import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  maxConcurrency: 5,
  timeoutMs: 120_000,
  judge: { model: "openai/gpt-4o-mini" },
});
