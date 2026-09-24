#!/usr/bin/env bash
# Validates a sanitized spec before it's allowed to publish: lints it, and
# runs an independent forbidden-string scan as a second check on top of
# sanitize.mjs (belt-and-suspenders — this must not rely on the sanitizer
# alone having worked correctly).
set -euo pipefail

SPEC_PATH="${1:?usage: validate.sh <specs/service/openapi.yaml>}"

echo "validate: linting ${SPEC_PATH}"
npx --yes @redocly/cli@2 lint "${SPEC_PATH}" --extends recommended

echo "validate: scanning ${SPEC_PATH} for forbidden strings"
FORBIDDEN_PATTERN='x-hidden|x-internal|\.internal\b|\.svc\.cluster\.local|localhost|127\.0\.0\.1|staging\.'
if grep -inE "${FORBIDDEN_PATTERN}" "${SPEC_PATH}"; then
  echo "validate: FAILED — forbidden string found in ${SPEC_PATH}" >&2
  exit 1
fi

# The scan above catches internal *hostnames*; this catches internal *routes*,
# which look nothing alike and are not covered by the sanitizer either unless
# the source repo marked them. See check-internal-paths.mjs for why it parses
# path keys instead of grepping.
echo "validate: checking ${SPEC_PATH} for internal paths"
node "$(dirname "$0")/check-internal-paths.mjs" "${SPEC_PATH}"

echo "validate: ${SPEC_PATH} passed"
