#!/usr/bin/env bash
# Bootstrap Mirror AI if needed, then start the local UI (same as /mirror-ai).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL="$("$DIR/bootstrap.sh")"
cd "$INSTALL"
exec ./scripts/start-ui.sh
