// List eve agent runs and replay a run's turn-by-turn trace.
// Stitches two sources: Vercel's Agent Runs API for the run list, and the eve
// runtime on the deployment for each run's durable event stream.
// Run: bun run scripts/agent-runs.ts list [page] [pageSize]
//      bun run scripts/agent-runs.ts show <wrun_id>

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) throw new Error("set VERCEL_TOKEN");
const TEAM_SLUG = process.env.TEAM_SLUG ?? "labs-lite";
const PROJECT = process.env.PROJECT ?? "wc26-chat"; // project NAME, not the prj_ id
const APP_URL = process.env.APP_URL ?? "https://wc26.chat";

const RUNS_API = "https://vercel.com/api/observability/agent-runs";

type Usage = { totalTokens: number };
type Run = {
  id: string;
  title: string | null;
  status: string;
  model: string | null;
  turns: number;
  subagents: number;
  durationMs: number | null;
  createdAt: string;
  deploymentId: string | null;
  usage?: Usage;
};
type ListResponse = { runs: Run[]; pageInfo: { total: number; page: number; pageSize: number } };
type EveEvent = { type: string; data: Record<string, any>; meta?: { at: string } };

const TERMINAL = new Set(["session.waiting", "session.completed", "session.failed"]);

async function api<T>(params: Record<string, string>): Promise<T> {
  const url = `${RUNS_API}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json() as Promise<T>;
}

async function listRuns(page = 1, pageSize = 25): Promise<void> {
  const { runs, pageInfo } = await api<ListResponse>({
    teamSlug: TEAM_SLUG,
    project: PROJECT,
    page: String(page),
    pageSize: String(pageSize),
  });
  const pages = Math.ceil(pageInfo.total / pageInfo.pageSize);
  console.log(`runs ${runs.length} of ${pageInfo.total} (page ${pageInfo.page}/${pages})\n`);
  for (const r of runs) {
    const dur = r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "·";
    const tok = r.usage ? `${r.usage.totalTokens}tok` : "";
    console.log(
      `${r.id}  ${r.status.padEnd(9)} ${r.turns}t ${dur.padStart(6)} ${tok.padEnd(9)} ${r.createdAt}  ${JSON.stringify(r.title ?? "")}`,
    );
  }
}

// The stream stays open after replaying history, so stop on the first terminal event.
async function streamTrace(id: string): Promise<void> {
  const res = await fetch(`${APP_URL}/eve/v1/session/${id}/stream?startIndex=0`);
  if (!res.body) throw new Error("no stream body");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as EveEvent;
      printEvent(event);
      if (TERMINAL.has(event.type)) {
        await reader.cancel();
        return;
      }
    }
  }
}

function printEvent({ type, data: d }: EveEvent): void {
  const clip = (v: unknown, n = 200) => JSON.stringify(v ?? "").slice(0, n);
  switch (type) {
    case "message.received":
      return console.log(`\n[user]  ${clip(d.message ?? d.text)}`);
    case "reasoning.completed":
      return console.log(`[think] ${(d.text ?? "").slice(0, 200)}`);
    case "actions.requested":
      for (const a of d.actions ?? []) console.log(`[tool>] ${a.toolName}(${JSON.stringify(a.input)})`);
      return;
    case "action.result":
      return console.log(`[tool<] ${clip(d.output ?? d.result)}`);
    case "message.completed":
      return console.log(`[asst]  ${d.message ?? d.text ?? ""}  (finish=${d.finishReason ?? ""})`);
    case "step.failed":
    case "turn.failed":
    case "session.failed":
      return console.log(`[FAIL]  ${JSON.stringify(d)}`);
  }
}

async function showRun(id: string): Promise<void> {
  const { run } = await api<{ run: Run }>({ teamSlug: TEAM_SLUG, project: PROJECT, runId: id });
  console.log("== run metadata ==");
  const { title, status, model, turns, subagents, deploymentId, usage } = run;
  console.log(JSON.stringify({ title, status, model, turns, subagents, deploymentId, usage }, null, 1));
  console.log("\n== trace (durable replay) ==");
  await streamTrace(id);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "show") {
  const id = rest[0];
  if (!id) throw new Error("usage: show <wrun_id>");
  await showRun(id);
} else if (cmd === "list" || cmd === undefined) {
  await listRuns(Number(rest[0] ?? 1), Number(rest[1] ?? 25));
} else {
  throw new Error("usage: agent-runs.ts list [page] [pageSize] | show <wrun_id>");
}
