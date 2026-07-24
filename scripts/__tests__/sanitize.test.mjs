import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { sanitizeSpec } from '../sanitize.mjs';

function fixture(name) {
  return readFileSync(fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url)), 'utf8');
}

test('strips operations marked x-hidden or x-internal', () => {
  const { yaml } = sanitizeSpec(fixture('raw-with-hidden.yaml'));
  const out = parse(yaml);
  assert.equal(out.paths['/hidden'], undefined, 'x-hidden operation path should be removed entirely');
  assert.equal(out.paths['/internal-only'], undefined, 'x-internal operation path should be removed entirely');
  assert.ok(out.paths['/public'], 'unrelated public path must survive');
});

test('removes only the hidden method on a path shared with a public method', () => {
  const { yaml } = sanitizeSpec(fixture('raw-with-hidden.yaml'));
  const out = parse(yaml);
  assert.ok(out.paths['/mixed'], 'path must survive since it still has a public method');
  assert.ok(out.paths['/mixed'].get, 'public method must survive');
  assert.equal(out.paths['/mixed'].post, undefined, 'hidden method must be removed');
});

test('strips schemas marked x-hidden from components', () => {
  const { yaml } = sanitizeSpec(fixture('raw-with-hidden.yaml'));
  const out = parse(yaml);
  assert.equal(out.components.schemas.HiddenThing, undefined);
  assert.ok(out.components.schemas.PublicThing, 'unrelated public schema must survive');
});

test('strips non-public servers entries, keeps public https ones', () => {
  const { yaml } = sanitizeSpec(fixture('raw-with-hidden.yaml'));
  const out = parse(yaml);
  assert.deepEqual(out.servers, [{ url: 'https://api.example.com' }]);
});

test('strips non-allowlisted x-* extensions without removing the object they annotate', () => {
  const { yaml } = sanitizeSpec(fixture('raw-with-hidden.yaml'));
  const out = parse(yaml);
  assert.ok(out.components.schemas.Codegen, 'schema itself must survive — the marker is not a hidden marker');
  assert.equal(out.components.schemas.Codegen['x-go-type'], undefined, 'non-allowlisted extension must be stripped');
});

test('is a no-op removal-wise on a spec with no hidden markers', () => {
  const { yaml, stats } = sanitizeSpec(fixture('no-hidden-markers.yaml'));
  const out = parse(yaml);
  assert.equal(stats.removedOperations, 0);
  assert.equal(stats.removedComponents, 0);
  assert.ok(out.paths['/public']);
});

test('fails closed on unparseable input', () => {
  assert.throws(() => sanitizeSpec(fixture('malformed.yaml')), /failed to parse/);
});

test('fails closed when a hidden marker exists somewhere sanitize.mjs does not remove from', () => {
  assert.throws(() => sanitizeSpec(fixture('unhandled-marker.yaml')), /removed nothing — failing closed/);
});

test('injects configured public servers when the spec has none of its own', () => {
  const noServersSpec = 'openapi: 3.0.3\ninfo:\n  title: No Servers Fixture\n  version: 1.0.0\npaths: {}\n';
  const publicServers = [{ url: 'https://compute.nks.europe-west4.nscale.com', description: 'Production' }];
  const { yaml, stats } = sanitizeSpec(noServersSpec, { publicServers });
  const out = parse(yaml);
  assert.deepEqual(out.servers, publicServers);
  assert.equal(stats.injectedServers, 1);
});

test('does not override servers already present after stripping internal ones', () => {
  const publicServers = [{ url: 'https://should-not-be-used.example.com' }];
  const { yaml, stats } = sanitizeSpec(fixture('raw-with-hidden.yaml'), { publicServers });
  const out = parse(yaml);
  assert.deepEqual(out.servers, [{ url: 'https://api.example.com' }]);
  assert.equal(stats.injectedServers, 0);
});
