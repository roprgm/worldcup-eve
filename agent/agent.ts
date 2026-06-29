import { defineAgent } from "eve";

export default defineAgent({
  // Base model optimized for perceived latency: a non-reasoning, fast tool-caller.
  // Grok 4 Fast (non-reasoning) is tuned for agentic tool-calling loops, so replies
  // start immediately instead of waiting on a reasoning preamble.
  // Hard, multi-step questions are delegated to the `analyst` subagent, which keeps
  // a reasoning model for the cases where deliberation actually pays off.
  model: "xai/grok-4-fast-non-reasoning",
  // Grok 4 Fast has a 2M-token window; set it verbatim so the build doesn't depend
  // on the AI Gateway model catalog resolving this id at compile time.
  modelContextWindowTokens: 2_000_000,
});
