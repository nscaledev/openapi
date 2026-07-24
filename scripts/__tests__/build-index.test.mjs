import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { buildIndex, BASE_URL } from '../build-index.mjs';

const specsTreeDir = fileURLToPath(new URL('../__fixtures__/specs-tree', import.meta.url));
const FIXED_NOW = '2026-07-24T00:00:00.000Z';

test('builds one entry per service directory that has an openapi.yaml', () => {
  const index = buildIndex(specsTreeDir, () => FIXED_NOW);
  const ids = index.services.map((s) => s.id);
  assert.deepEqual(ids, ['alpha', 'beta'], 'notes.txt and gamma-no-spec (no openapi.yaml) must be skipped');
});

test('reads title and version from each spec', () => {
  const index = buildIndex(specsTreeDir, () => FIXED_NOW);
  const alpha = index.services.find((s) => s.id === 'alpha');
  assert.equal(alpha.title, 'Alpha API');
  assert.equal(alpha.version, '1.0.0');
});

test('merges .publish-meta.json when present, nulls when absent', () => {
  const index = buildIndex(specsTreeDir, () => FIXED_NOW);
  const alpha = index.services.find((s) => s.id === 'alpha');
  const beta = index.services.find((s) => s.id === 'beta');
  assert.equal(alpha.sourceCommit, 'abc1234');
  assert.equal(alpha.publishedAt, '2026-01-01T00:00:00.000Z');
  assert.equal(beta.sourceCommit, null);
  assert.equal(beta.publishedAt, null);
});

test('emits stable, absolute openapi.nscale.com URLs, never a github.io URL', () => {
  const index = buildIndex(specsTreeDir, () => FIXED_NOW);
  const alpha = index.services.find((s) => s.id === 'alpha');
  assert.equal(alpha.spec.yaml, `${BASE_URL}/specs/alpha/openapi.yaml`);
  assert.equal(alpha.spec.json, `${BASE_URL}/specs/alpha/openapi.json`);
  assert.equal(alpha.reference, `${BASE_URL}/reference.html?service=alpha`);
  assert.ok(!JSON.stringify(index).includes('github.io'));
});

test('returns an empty service list for a directory with no service subdirectories', () => {
  const index = buildIndex(fileURLToPath(new URL('../__fixtures__/empty-specs-tree', import.meta.url)), () => FIXED_NOW);
  assert.deepEqual(index.services, []);
});
