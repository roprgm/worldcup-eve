// Print a fresh prediction snapshot as JSON. Run directly, never imported:
//
//   bun run predictions/cli.ts          # pretty-printed
//   bun run predictions/cli.ts --min    # one line, for piping into an API

import { buildPredictions } from "./index";

console.log(
  JSON.stringify(
    await buildPredictions(),
    null,
    process.argv.includes("--min") ? 0 : 2,
  ),
);
