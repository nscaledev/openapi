import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeServiceParam, renderServiceCards } from '../../site/assets/app.js';

test('sanitizeServiceParam accepts a plain lowercase-kebab id', () => {
  assert.equal(sanitizeServiceParam('compute'), 'compute');
  assert.equal(sanitizeServiceParam('fleet-manager'), 'fleet-manager');
});

test('sanitizeServiceParam rejects path traversal attempts entirely', () => {
  assert.equal(sanitizeServiceParam('../../etc/passwd'), '');
  assert.equal(sanitizeServiceParam('..%2f..%2fetc'), '');
});

test('sanitizeServiceParam rejects script-injection-shaped values entirely', () => {
  assert.equal(sanitizeServiceParam('<script>alert(1)</script>'), '');
  assert.equal(sanitizeServiceParam('"><img src=x onerror=alert(1)>'), '');
});

test('sanitizeServiceParam rejects uppercase, whitespace, and shell metacharacters', () => {
  assert.equal(sanitizeServiceParam('Compute'), '');
  assert.equal(sanitizeServiceParam('compute; rm -rf /'), '');
  assert.equal(sanitizeServiceParam('  compute  '), 'compute', 'surrounding whitespace is trimmed, not treated as invalid');
});

test('sanitizeServiceParam handles empty/missing input defensively', () => {
  assert.equal(sanitizeServiceParam(''), '');
  assert.equal(sanitizeServiceParam(null), '');
  assert.equal(sanitizeServiceParam(undefined), '');
});

test('renderServiceCards renders the empty state for zero services', () => {
  assert.match(renderServiceCards({ services: [] }), /No services published yet/);
});

test('renderServiceCards tolerates a malformed index document', () => {
  assert.match(renderServiceCards({}), /No services published yet/);
  assert.match(renderServiceCards(null), /No services published yet/);
});

test('renderServiceCards includes all expected links for a fully-populated service', () => {
  const html = renderServiceCards({
    services: [
      {
        id: 'compute',
        title: 'Compute Service API',
        version: '1.13.0',
        spec: { yaml: 'https://openapi.nscale.com/specs/compute/openapi.yaml', json: 'https://openapi.nscale.com/specs/compute/openapi.json' },
        docs: 'https://docs.nscale.com/api-reference/compute',
        reference: 'https://openapi.nscale.com/reference.html?service=compute',
      },
    ],
  });
  assert.match(html, /Compute Service API/);
  assert.match(html, /v1\.13\.0/);
  assert.match(html, /href="https:\/\/openapi\.nscale\.com\/specs\/compute\/openapi\.yaml"/);
  assert.match(html, /href="https:\/\/openapi\.nscale\.com\/specs\/compute\/openapi\.json"/);
  assert.match(html, /href="https:\/\/docs\.nscale\.com\/api-reference\/compute"/);
  assert.match(html, /href="\/specs\/compute\/CHANGELOG\.md"/);
});

test('renderServiceCards omits a link cleanly when its field is absent, rather than emitting a broken href', () => {
  const html = renderServiceCards({ services: [{ id: 'partial', title: 'Partial Service', version: '0.1.0' }] });
  assert.doesNotMatch(html, /href="undefined"/);
  assert.match(html, /Partial Service/);
});

test('renderServiceCards escapes HTML in service-provided fields', () => {
  const html = renderServiceCards({ services: [{ id: 'x', title: '<script>alert(1)</script>', version: '1.0.0' }] });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});
