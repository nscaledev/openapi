// Pure helper functions shared by index.html and reference.html. No DOM
// access here on purpose — kept testable as plain functions (see
// scripts/__tests__/app.test.mjs) without a browser/DOM harness.

const SERVICE_ID_PATTERN = /^[a-z0-9-]+$/;

// Rejects the whole value rather than PRD-style stripping-of-bad-chars:
// stripping "../../etc" down to "etc" would silently resolve to a
// different, technically-valid id instead of surfacing the bad input.
export function sanitizeServiceParam(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return SERVICE_ID_PATTERN.test(value) ? value : '';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderServiceCards(index) {
  const services = Array.isArray(index && index.services) ? index.services : [];
  if (services.length === 0) {
    return '<p class="empty">No services published yet.</p>';
  }
  return services.map(renderCard).join('\n');
}

function renderCard(svc) {
  const id = escapeHtml(svc.id || '');
  const title = escapeHtml(svc.title || svc.id || 'Untitled service');
  const version = escapeHtml(svc.version || '');

  const links = [
    svc.reference ? ['Reference', svc.reference] : null,
    svc.spec && svc.spec.yaml ? ['YAML', svc.spec.yaml] : null,
    svc.spec && svc.spec.json ? ['JSON', svc.spec.json] : null,
    svc.docs ? ['Docs on Mintlify', svc.docs] : null,
    svc.id ? ['Changelog', `/specs/${svc.id}/CHANGELOG.md`] : null,
  ].filter(Boolean);

  const linksHtml = links.map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('\n        ');

  return `<article class="card" data-service="${id}">
      <h2>${title}</h2>
      <p class="version">v${version}</p>
      <nav class="card-links">
        ${linksHtml}
      </nav>
    </article>`;
}
