import { defineAgent } from "eve";

export default defineAgent({
  // Base model optimized for perceived latency: a non-reasoning, fast tool-caller.
  // Llama 3.3 70B on the gateway is served by Groq (low TTFT, function calling),
  // so replies start immediately instead of waiting on a reasoning preamble.
  // Hard, multi-step questions are delegated to the `analyst` subagent, which
  // keeps a reasoning model for the cases where deliberation actually pays off.
  model: "meta/llama-3.3-70b",
  modelOptions: {
    providerOptions: {
      gateway: { order: ["groq"] },
    },
  },
});
