#!/usr/bin/env bash
# Assembles the GitHub Pages artifact: site/*.html + site/assets/ flattened
# to the root, alongside specs/, index.json, and CNAME. This is the single
# place that logic lives — both local dev (`npm run serve`) and the Pages
# deploy workflow call this script, so there's no risk of the two drifting
# out of sync.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/.site-build}"
# When set (npm run serve does this), index.json is regenerated with this
# as the base URL instead of the committed one — otherwise every card,
# reference, YAML, and JSON link in a local preview points at the real
# openapi.nscale.com, which won't resolve until DNS is configured, and
# clicking anything looks broken even though nothing is actually wrong.
LOCAL_BASE_URL="${OPENAPI_BASE_URL:-}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp "$REPO_ROOT"/site/*.html "$OUT_DIR"/
cp -r "$REPO_ROOT"/site/assets "$OUT_DIR"/assets
cp -r "$REPO_ROOT"/specs "$OUT_DIR"/specs
cp "$REPO_ROOT"/CNAME "$OUT_DIR"/CNAME

if [ -n "$LOCAL_BASE_URL" ]; then
  OPENAPI_BASE_URL="$LOCAL_BASE_URL" node "$REPO_ROOT/scripts/build-index.mjs" "$OUT_DIR/index.json"
  echo "build-site: index.json regenerated with base URL $LOCAL_BASE_URL (local preview only — not committed)"
else
  cp "$REPO_ROOT"/index.json "$OUT_DIR"/index.json
fi

echo "build-site: assembled Pages artifact at $OUT_DIR"
