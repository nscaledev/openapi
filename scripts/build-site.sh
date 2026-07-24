#!/usr/bin/env bash
# Assembles the GitHub Pages artifact: site/*.html + site/assets/ flattened
# to the root, alongside specs/, index.json, and CNAME. This is the single
# place that logic lives — both local dev (`npm run serve`) and the Pages
# deploy workflow call this script, so there's no risk of the two drifting
# out of sync.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/.site-build}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cp "$REPO_ROOT"/site/*.html "$OUT_DIR"/
cp -r "$REPO_ROOT"/site/assets "$OUT_DIR"/assets
cp -r "$REPO_ROOT"/specs "$OUT_DIR"/specs
cp "$REPO_ROOT"/index.json "$OUT_DIR"/index.json
cp "$REPO_ROOT"/CNAME "$OUT_DIR"/CNAME

echo "build-site: assembled Pages artifact at $OUT_DIR"
