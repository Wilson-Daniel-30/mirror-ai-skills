#!/usr/bin/env bash
# Poll a running /api/audits job (see .cache/live-audit.env).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/.cache/live-audit.env"
PORT=4173
[[ -f "$ROOT/.env" ]] && line="$(grep -E '^PORT=' "$ROOT/.env" 2>/dev/null | tail -1 || true)" && [[ -n "$line" ]] && PORT="${line#PORT=}"
while true; do
  curl -sf "http://127.0.0.1:${PORT}/api/audits?jobId=${JOB}" | node -e '
    let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
      const j=JSON.parse(s);
      const lines=j.modules?.flatMap(m=>m.passes.map(p=>`${m.label} · ${p.title}: ${p.state}${p.cached?" (cached)":""}`))||[];
      console.log(new Date().toISOString(), j.done?"DONE":"running", lines.join(" | "));
    });
  '
  grep -q '^JOB=' "$ROOT/.cache/live-audit.env" || exit 0
  done=$(curl -sf "http://127.0.0.1:${PORT}/api/audits?jobId=${JOB}" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>console.log(JSON.parse(s).done?"yes":"no"))')
  [[ "$done" == "yes" ]] && break
  sleep 15
done
