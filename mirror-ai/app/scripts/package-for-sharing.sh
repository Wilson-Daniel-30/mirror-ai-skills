#!/usr/bin/env bash
# Build a portable Mirror-AI folder (no node_modules, caches, or local repos).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/distribution/Mirror-AI}"

rm -rf "$DEST"
mkdir -p "$DEST"

rsync -a \
  --exclude '.DS_Store' \
  --exclude 'node_modules/' \
  --exclude '.cache/' \
  --exclude 'repos/' \
  --exclude 'generated reports/' \
  --exclude '.git/' \
  --exclude '.claude-flow/' \
  --exclude '.swarm/' \
  --exclude '.probe/' \
  --exclude 'ruvector.db' \
  --exclude 'agentdb.rvf' \
  --exclude 'agentdb.rvf.lock' \
  --exclude 'tests/.npx.log' \
  --exclude 'tests/.claude-args.log' \
  --exclude 'tests/.cli-report.md' \
  --exclude 'reports/fixture-comparison.stub.md' \
  --exclude '.env' \
  "$ROOT/" "$DEST/"

chmod +x "$DEST/setup.sh" "$DEST/scripts/start-ui.sh" "$DEST/scripts/diagnose-setup.sh" 2>/dev/null || true

say_size() {
  du -sh "$DEST" | awk '{print $1}'
}

cat >"$DEST/UPLOAD_README.txt" <<'EOF'
Mirror AI — portable package

On the new laptop:
  1. Unzip or copy this entire folder anywhere.
  2. Install Node.js 22+ from https://nodejs.org/
  3. Run:  chmod +x setup.sh && ./setup.sh
  4. Start UI:  ./scripts/start-ui.sh   or   npm run serve
  5. If something fails: in Cursor use /find-setup-issue or run ./scripts/diagnose-setup.sh

Do not commit or share your .env file (created by setup).

This package intentionally excludes:
  - node_modules (reinstalled by npm install)
  - .cache/repos (cloned when you enter git URLs)
  - repos/ (your full app checkouts — use URLs or your own paths)
  - generated reports/ (recreated when you run audits)
EOF

echo "Created $DEST ($(say_size))"
if command -v ditto >/dev/null 2>&1; then
  ZIP="${DEST}.zip"
  ditto -c -k --sequesterRsrc --keepParent "$DEST" "$ZIP"
  echo "Zip: $ZIP ($(du -sh "$ZIP" | awk '{print $1}'))"
fi
