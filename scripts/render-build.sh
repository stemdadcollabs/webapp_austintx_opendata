#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

escape_js() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

AUSTIN_APP_TOKEN_ESCAPED="$(escape_js "${AUSTIN_APP_TOKEN:-}")"
DALLAS_APP_TOKEN_ESCAPED="$(escape_js "${DALLAS_APP_TOKEN:-}")"
CHICAGO_APP_TOKEN_ESCAPED="$(escape_js "${CHICAGO_APP_TOKEN:-}")"

cat > "$ROOT_DIR/config.js" <<EOF
// Render build-time config (generated).
window.OPEN_DATA_TOKENS = {
  austin: "${AUSTIN_APP_TOKEN_ESCAPED}",
  dallas: "${DALLAS_APP_TOKEN_ESCAPED}",
  chicago: "${CHICAGO_APP_TOKEN_ESCAPED}",
};

window.AUSTIN_APP_TOKEN = window.OPEN_DATA_TOKENS.austin;
window.DALLAS_APP_TOKEN = window.OPEN_DATA_TOKENS.dallas;
window.CHICAGO_APP_TOKEN = window.OPEN_DATA_TOKENS.chicago;
EOF

echo "Wrote $ROOT_DIR/config.js"
