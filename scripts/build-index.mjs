#!/usr/bin/env node
// Walks specs/, reads info.title/info.version from each service's canonical
// spec, merges publish metadata written alongside it, and (re)writes
// index.json at the repo root. Runs on every publish commit.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const BASE_URL = 'https://openapi.nscale.com';
export const DOCS_BASE_URL = 'https://docs.nscale.com/api-reference';

/**
 * @param {string} specsDir absolute path to the specs/ directory
 * @param {() => string} now injectable clock, for deterministic tests
 * @returns {object} the index.json document
 */
export function buildIndex(specsDir, now = () => new Date().toISOString()) {
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
          yaml: `${BASE_URL}/specs/${entry}/openapi.yaml`,
          json: `${BASE_URL}/specs/${entry}/openapi.json`,
        },
        docs: `${DOCS_BASE_URL}/${entry}`,
        reference: `${BASE_URL}/reference.html?service=${entry}`,
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
  const index = buildIndex(specsDir);
  writeFileSync(join(repoRoot, 'index.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.error(`build-index: wrote index.json with ${index.services.length} service(s)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
