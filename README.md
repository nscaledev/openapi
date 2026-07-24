# nscaledev/openapi

The canonical, public home for Nscale's OpenAPI specs — one spec per service, sanitized, versioned, and served from stable URLs.

This repo is **not** the polished API docs experience — that's [docs.nscale.com](https://docs.nscale.com), built with Mintlify. This repo is the raw, technical, fetchable layer underneath it: the thing Mintlify, Postman, codegen tools, and scripts pull from.

## Consuming a spec

Every published service gets a stable URL in both formats:

```
https://openapi.nscale.com/specs/<service>/openapi.yaml
https://openapi.nscale.com/specs/<service>/openapi.json
```

The full catalog of published services, their versions, and their URLs is available as machine-readable JSON:

```
https://openapi.nscale.com/index.json
```

Browse any service's endpoints without any tooling at:

```
https://openapi.nscale.com/reference.html?service=<service>
```

## How specs get here

Specs are **never hand-edited in this repo**. Each source service repo fires a `repository_dispatch` event on release; a publish workflow here sanitizes (stripping internal-only operations, servers, and vendor extensions), lints, diffs for breaking changes, converts formats, and commits under a bot identity. `CODEOWNERS` and a CI check block human edits to `specs/`.

## Local development

All scripts run with Node 20+ and `npx` — no global installs required.

```bash
# Sanitize a raw (already-bundled/dereferenced) spec
node scripts/sanitize.mjs <input.yaml> <output.yaml>

# Lint + forbidden-string scan a sanitized spec
scripts/validate.sh specs/<service>/openapi.yaml

# Rebuild index.json from specs/
node scripts/build-index.mjs

# Run the pipeline's tests
npm test

# Assemble and serve the Pages site locally at http://localhost:4173
npm run serve
```

`npm run serve` runs the same `scripts/build-site.sh` that the Pages deploy workflow uses, so what you see locally is what goes live — no separate local-only path to drift out of sync.

## License

Apache-2.0 (see `LICENSE`). Specs published here may be used to generate API clients.
