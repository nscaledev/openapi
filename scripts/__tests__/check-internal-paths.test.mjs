import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findInternalPaths } from '../check-internal-paths.mjs';

function fixture(name) {
  return readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
}

test('reports every path key with an internal segment', () => {
  const found = findInternalPaths(fixture('internal-paths.yaml'));
  assert.deepEqual(found, [
    '/api/v1/resource-manager/internal/resource-pools',
    '/api/v1/environment-manager/internal/environments/{environment_id}',
  ]);
});

test('leaves public paths alone, including prose mentioning internal', () => {
  const found = findInternalPaths(fixture('internal-paths.yaml'));
  assert.ok(
    !found.includes('/api/v1/public/things'),
    'a public path must not be flagged for an "Internal Server Error" description'
  );
});

test('does not flag a segment that merely starts with internal', () => {
  const found = findInternalPaths(fixture('internal-paths.yaml'));
  assert.ok(!found.includes('/api/v1/internal-users'), '"internal-users" is a distinct segment from "internal"');
});

test('matches an internal segment regardless of case', () => {
  const found = findInternalPaths('openapi: 3.1.0\npaths:\n  /api/Internal/things: {}\n');
  assert.deepEqual(found, ['/api/Internal/things']);
});

test('returns nothing for a spec with no paths at all', () => {
  assert.deepEqual(findInternalPaths('openapi: 3.1.0\ninfo:\n  title: t\n  version: "1"\n'), []);
});

test('throws rather than passing silently on an unparseable spec', () => {
  assert.throws(() => findInternalPaths(fixture('malformed.yaml')), /failed to parse input spec/);
});
