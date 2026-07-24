#!/usr/bin/env node
// Walks specs/, reads info.title/info.version from each service's canonical
// spec, merges publish metadata written alongside it, and (re)writes
// index.json at the repo root. Runs on every publish commit.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

export const BASE_URL = 'https://openapi.nscale.com';
export const DOCS_BASE_URL = 'https://docs.nscale.com/api-reference';

/**
 * @param {string} specsDir absolute path to the specs/ directory
 * @param {() => string} now injectable clock, for deterministic tests
 * @param {string} baseUrl override for local preview builds — production
 *   publishes always use the real BASE_URL constant, never this override
 * @returns {object} the index.json document
 */
export function buildIndex(specsDir, now = () => new Date().toISOString(), baseUrl = BASE_URL) {
  const services = [];

  if (existsSync(specsDir)) {
    for (const entry of readdirSync(specsDir).sort()) {
      const serviceDir = join(specsDir, entry);
      if (!statSync(serviceDir).isDirectory()) continue;

      const specPath = join(serviceDir, 'openapi.yaml');
      if (!existsSync(specPath)) continue;

      const spec = parse(readFileSync(specPath, 'utf8'));
      const info = spec && spec.info ? spec.info : {};

      let meta = {};
      const metaPath = join(serviceDir, '.publish-meta.json');
      if (existsSync(metaPath)) {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'));
      }

      services.push({
        id: entry,
        title: info.title || entry,
        version: info.version || '0.0.0',
        spec: {
          yaml: `${baseUrl}/specs/${entry}/openapi.yaml`,
          json: `${baseUrl}/specs/${entry}/openapi.json`,
        },
        docs: `${DOCS_BASE_URL}/${entry}`,
        reference: `${baseUrl}/reference.html?service=${entry}`,
        sourceCommit: meta.sourceCommit || null,
        publishedAt: meta.publishedAt || null,
      });
    }
  }

  return {
    $schema: './index.schema.json',
    generated: now(),
    services,
  };
}

function main() {
  const repoRoot = new URL('..', import.meta.url).pathname;
  const specsDir = join(repoRoot, 'specs');
  // OPENAPI_BASE_URL is for local preview only (scripts/build-site.sh sets
  // it when assembling a local-serving build) — a real publish never sets
  // this, so it always falls through to the real BASE_URL constant.
  const baseUrl = process.env.OPENAPI_BASE_URL || BASE_URL;
  const outPath = process.argv[2] ? resolve(repoRoot, process.argv[2]) : join(repoRoot, 'index.json');
  const index = buildIndex(specsDir, undefined, baseUrl);
  writeFileSync(outPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.error(`build-index: wrote ${outPath} with ${index.services.length} service(s), base URL ${baseUrl}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
