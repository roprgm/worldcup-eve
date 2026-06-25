import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  maxConcurrency: 1,
  timeoutMs: 120_000,
  // Judge model for `t.judge.*` assertions (LLM-graded), routed via the gateway.
  judge: { model: "openai/gpt-4o-mini" },
});
