#!/usr/bin/env node
// Sanitizes a bundled, dereferenced OpenAPI spec for public publication:
// strips anything marked x-hidden or x-internal, non-public servers, and
// any x-* vendor extension not on the allowlist. Fails closed on parse
// errors or when hidden markers are present but nothing was removed.
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';

export const HIDDEN_MARKERS = ['x-hidden', 'x-internal'];
export const ALLOWED_EXTENSIONS = ['x-codeSamples'];
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const COMPONENT_MAPS = ['schemas', 'parameters', 'responses', 'requestBodies', 'headers'];
const INTERNAL_URL_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /\.internal(\W|$)/i, /\.svc(\.|:|$)/i, /staging/i];

function isHidden(node) {
  return !!node && typeof node === 'object' && HIDDEN_MARKERS.some((m) => node[m] === true);
}

function isPublicServerUrl(url) {
  return typeof url === 'string' && /^https:\/\//.test(url) && !INTERNAL_URL_PATTERNS.some((p) => p.test(url));
}

function stripHiddenOperations(spec, stats) {
  const paths = spec.paths;
  if (!paths || typeof paths !== 'object') return;
  for (const pathKey of Object.keys(paths)) {
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const method of HTTP_METHODS) {
      if (method in pathItem && isHidden(pathItem[method])) {
        delete pathItem[method];
        stats.removedOperations++;
      }
    }
    const hasAnyMethod = HTTP_METHODS.some((m) => m in pathItem);
    if (!hasAnyMethod) {
      delete paths[pathKey];
      stats.removedPaths++;
    }
  }
}

function stripHiddenComponents(spec, stats) {
  const components = spec.components;
  if (!components || typeof components !== 'object') return;
  for (const mapName of COMPONENT_MAPS) {
    const map = components[mapName];
    if (!map || typeof map !== 'object') continue;
    for (const key of Object.keys(map)) {
      if (isHidden(map[key])) {
        delete map[key];
        stats.removedComponents++;
      }
    }
  }
}

function stripInternalServers(spec, stats) {
  if (Array.isArray(spec.servers)) {
    const before = spec.servers.length;
    spec.servers = spec.servers.filter((s) => isPublicServerUrl(s && s.url));
    stats.removedServers += before - spec.servers.length;
  }
  const paths = spec.paths;
  if (paths && typeof paths === 'object') {
    for (const pathItem of Object.values(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      if (Array.isArray(pathItem.servers)) {
        const before = pathItem.servers.length;
        pathItem.servers = pathItem.servers.filter((s) => isPublicServerUrl(s && s.url));
        stats.removedServers += before - pathItem.servers.length;
      }
    }
  }
}

function stripDisallowedExtensions(node, stats) {
  if (Array.isArray(node)) {
    for (const item of node) stripDisallowedExtensions(item, stats);
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    if (key.startsWith('x-') && !ALLOWED_EXTENSIONS.includes(key)) {
      delete node[key];
      stats.removedExtensions++;
      continue;
    }
    stripDisallowedExtensions(node[key], stats);
  }
}

function countHiddenMarkers(node) {
  let count = 0;
  if (Array.isArray(node)) {
    for (const item of node) count += countHiddenMarkers(item);
    return count;
  }
  if (!node || typeof node !== 'object') return count;
  if (HIDDEN_MARKERS.some((m) => node[m] === true)) count++;
  for (const value of Object.values(node)) count += countHiddenMarkers(value);
  return count;
}

/**
 * Sanitizes a raw OpenAPI YAML string for public publication.
 * @param {string} rawYaml
 * @param {{ publicServers?: Array<{url: string, description?: string}> }} [options]
 *   publicServers, when the input has none of its own after stripping
 *   internal ones, are injected as-is (source repos are mounted behind a
 *   gateway and don't self-describe a public host).
 * @returns {{ yaml: string, stats: object }}
 */
export function sanitizeSpec(rawYaml, options = {}) {
  let spec;
  try {
    spec = parse(rawYaml);
  } catch (err) {
    throw new Error(`sanitize: failed to parse input spec: ${err.message}`);
  }
  if (!spec || typeof spec !== 'object') {
    throw new Error('sanitize: parsed spec is not an object');
  }

  const markersFound = countHiddenMarkers(spec);
  const stats = {
    removedOperations: 0,
    removedPaths: 0,
    removedComponents: 0,
    removedServers: 0,
    removedExtensions: 0,
    injectedServers: 0,
  };

  stripHiddenOperations(spec, stats);
  stripHiddenComponents(spec, stats);
  stripInternalServers(spec, stats);

  if ((!Array.isArray(spec.servers) || spec.servers.length === 0) && options.publicServers?.length) {
    spec.servers = options.publicServers;
    stats.injectedServers = options.publicServers.length;
  }

  stripDisallowedExtensions(spec, stats);

  const totalRemoved = stats.removedOperations + stats.removedComponents + stats.removedServers;
  if (markersFound > 0 && totalRemoved === 0) {
    throw new Error(
      `sanitize: found ${markersFound} hidden/internal marker(s) in source but removed nothing — failing closed`
    );
  }

  return { yaml: stringify(spec), stats };
}

function loadPublicServers(serviceId) {
  if (!serviceId) return undefined;
  const configPath = new URL('./public-servers.json', import.meta.url);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  return config[serviceId];
}

function main() {
  const [, , inputPath, outputPath, serviceId] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('usage: sanitize.mjs <input.yaml> <output.yaml> [serviceId]');
    process.exit(1);
  }
  const raw = readFileSync(inputPath, 'utf8');
  const publicServers = loadPublicServers(serviceId);
  const { yaml, stats } = sanitizeSpec(raw, { publicServers });
  writeFileSync(outputPath, yaml, 'utf8');
  console.error(
    `sanitize: removed ${stats.removedOperations} operation(s), ${stats.removedPaths} now-empty path(s), ` +
      `${stats.removedComponents} component(s), ${stats.removedServers} server(s), ${stats.removedExtensions} extension key(s)` +
      (stats.injectedServers ? `, injected ${stats.injectedServers} configured public server(s)` : '')
  );
  if (!stats.injectedServers && (!publicServers || publicServers.length === 0)) {
    console.error(
      `sanitize: warning — no public server URL configured for "${serviceId || '(no serviceId given)'}" in scripts/public-servers.json; spec.servers may be empty`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
