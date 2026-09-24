#!/usr/bin/env node
// Fails a publish when any path key carries an `internal` segment.
//
// This is deliberately a separate check from sanitize.mjs's x-hidden/x-internal
// stripping. That only removes what a source repo explicitly marked, so it is
// no defence at all against a spec whose internal surface carries no markers —
// which is the normal case, not a hypothetical. nscale-environments' published
// artifact intentionally includes its service-to-service routes (its own drift
// check needs to see them) and marks none of them, so sanitization passes it
// through untouched and a naive spec-path would publish the lot.
//
// It inspects path keys rather than scanning the file as text because
// "internal" occurs in ordinary prose in every spec published here — 12 to 41
// times each, mostly "Internal Server Error" response descriptions — so a text
// grep is unusable for this. A path segment equal to `internal` is the
// convention these services already use, and is unambiguous.
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

/**
 * Returns the path keys that contain an `internal` segment.
 * @param {string} rawYaml
 * @returns {string[]}
 */
export function findInternalPaths(rawYaml) {
  let spec;
  try {
    spec = parse(rawYaml);
  } catch (err) {
    throw new Error(`check-internal-paths: failed to parse input spec: ${err.message}`);
  }
  const paths = spec?.paths;
  if (!paths || typeof paths !== 'object') return [];
  return Object.keys(paths).filter((pathKey) =>
    pathKey.split('/').some((segment) => segment.toLowerCase() === 'internal')
  );
}

function main() {
  const [, , specPath] = process.argv;
  if (!specPath) {
    console.error('usage: check-internal-paths.mjs <openapi.yaml>');
    process.exit(1);
  }
  const found = findInternalPaths(readFileSync(specPath, 'utf8'));
  if (found.length > 0) {
    console.error(
      `check-internal-paths: FAILED — ${found.length} path(s) in ${specPath} contain an "internal" segment:`
    );
    for (const pathKey of found) console.error(`  ${pathKey}`);
    console.error(
      'These look like service-to-service endpoints, and this repo is public. Publish a\n' +
        'public-only spec from the source repo instead of the internal-inclusive artifact.'
    );
    process.exit(1);
  }
  console.error(`check-internal-paths: ${specPath} has no internal paths`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
