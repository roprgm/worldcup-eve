import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const eveEntry = join(root, ".output", "server", "index.mjs");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const evePort = process.env.EVE_NEXT_PRODUCTION_PORT ?? "4274";
const nextArgs = process.argv.slice(2).filter((arg, index) => {
  return !(index === 0 && arg === "--");
});

if (!existsSync(eveEntry)) {
  console.error(
    "Missing .output/server/index.mjs. Run `bun run build:agent` first.",
  );
  process.exit(1);
}

let shuttingDown = false;
const children = [];

function stopChildren(skip) {
  for (const child of children) {
    if (child !== skip && !child.killed) {
      child.kill("SIGTERM");
    }
  }
}

function spawnChild(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });

  children.push(child);

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopChildren(child);
    if (signal) {
      console.error(`${name} exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });

  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChildren();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

spawnChild("eve", process.execPath, [eveEntry], {
  HOST: "127.0.0.1",
  NITRO_HOST: "127.0.0.1",
  NITRO_PORT: evePort,
  PORT: evePort,
});

spawnChild("next", process.execPath, [nextBin, "start", ...nextArgs]);
