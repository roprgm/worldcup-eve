#!/usr/bin/env bash
# List eve agent runs and replay a run's turn-by-turn trace.
#
# Two data sources are stitched together:
#   - the run list comes from Vercel's Agent Runs API (vercel.com/api)
#   - the per-run trace comes from the eve runtime on the deployment (/eve/v1)
#
# Env:
#   VERCEL_TOKEN  (required)  Vercel token with access to the team
#   TEAM_SLUG     default: labs-lite
#   PROJECT       default: wc26-chat        (project NAME, not the prj_ id)
#   APP_URL       default: https://wc26.chat
#
# Usage:
#   scripts/agent-runs.sh list [page] [pageSize]
#   scripts/agent-runs.sh show <wrun_id>
set -euo pipefail

TEAM_SLUG="${TEAM_SLUG:-labs-lite}"
PROJECT="${PROJECT:-wc26-chat}"
APP_URL="${APP_URL:-https://wc26.chat}"
: "${VERCEL_TOKEN:?set VERCEL_TOKEN}"

api() { curl -sS --max-time 30 -H "Authorization: Bearer $VERCEL_TOKEN" "$@"; }

list_runs() {
  local page="${1:-1}" size="${2:-25}"
  api "https://vercel.com/api/observability/agent-runs?teamSlug=${TEAM_SLUG}&project=${PROJECT}&page=${page}&pageSize=${size}" \
  | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const j=JSON.parse(d); const p=j.pageInfo||{};
      console.log(`runs ${j.runs.length} of ${p.total} (page ${p.page}/${Math.ceil(p.total/p.pageSize)})\n`);
      for(const r of j.runs){
        const dur=r.durationMs!=null?`${(r.durationMs/1000).toFixed(1)}s`:"·";
        const tok=r.usage?`${r.usage.totalTokens}tok`:"";
        console.log(`${r.id}  ${String(r.status).padEnd(9)} ${String(r.turns)+"t"} ${dur.padStart(6)} ${tok.padEnd(9)} ${r.createdAt}  ${JSON.stringify(r.title||"")}`);
      }
    });'
}

show_run() {
  local id="$1"
  echo "== run metadata =="
  api "https://vercel.com/api/observability/agent-runs?teamSlug=${TEAM_SLUG}&project=${PROJECT}&runId=${id}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).run;console.log(JSON.stringify({title:r.title,status:r.status,model:r.model,turns:r.turns,subagents:r.subagents,deploymentId:r.deploymentId,usage:r.usage},null,1));});'
  echo
  echo "== trace (durable replay) =="
  # The stream stays open after replay; node exits on the first terminal event,
  # which closes the pipe and makes curl exit 23 (broken pipe) — harmless, so
  # relax errexit/pipefail just for this line.
  set +e +o pipefail
  curl -sS --max-time 40 -N "${APP_URL}/eve/v1/session/${id}/stream?startIndex=0" 2>/dev/null \
  | node -e '
    const rl=require("readline").createInterface({input:process.stdin});
    rl.on("line",l=>{
      if(!l.trim())return;
      let e;try{e=JSON.parse(l)}catch{return}
      const t=e.type,d=e.data||{};
      if(t==="message.received")      console.log(`\n[user]  ${JSON.stringify(d.message||d.text||"")}`);
      else if(t==="reasoning.completed") console.log(`[think] ${(d.text||"").slice(0,200)}`);
      else if(t==="actions.requested") for(const a of d.actions||[]) console.log(`[tool>] ${a.toolName}(${JSON.stringify(a.input)})`);
      else if(t==="action.result")     console.log(`[tool<] ${JSON.stringify(d.output??d.result??"").slice(0,200)}`);
      else if(t==="message.completed") console.log(`[asst]  ${d.message||d.text||""}  (finish=${d.finishReason||""})`);
      else if(t==="step.failed"||t==="turn.failed"||t==="session.failed") console.log(`[FAIL]  ${JSON.stringify(d)}`);
      if(t==="session.waiting"||t==="session.completed"||t==="session.failed"){rl.close();process.exit(0);}
    });'
  set -e -o pipefail
}

cmd="${1:-list}"; shift || true
case "$cmd" in
  list) list_runs "${1:-1}" "${2:-25}" ;;
  show) show_run "${1:?usage: show <wrun_id>}" ;;
  *) echo "usage: $0 list [page] [pageSize] | show <wrun_id>" >&2; exit 1 ;;
esac
