# nscaledev/openapi

The canonical, public home for Nscale's OpenAPI specs — one spec per service, sanitized, versioned, and pushed here from each service's own repo.

This repo has two parts:

- **`specs/` and `index.json`** — the actual data. Sanitized, versioned OpenAPI specs, never hand-edited here (see below).
- **`web/`** — a Next.js app that reads that data and renders the browsable site: a landing page listing every published service, and a per-service reference view. It's deployed to Nscale's own k8s cluster (see `web/charts/openapi-web/`) and fetches specs from this repo's git history at runtime — a new publish shows up within about a minute, with no redeploy of the app itself.

This repo is **not** the polished API docs experience — that's [docs.nscale.com](https://docs.nscale.com), built with Mintlify. It's the raw, technical layer underneath: the thing Mintlify, Postman, codegen tools, and the `web/` app itself all pull from.

## How specs get here

Specs are **never hand-edited in this repo**. Each source service repo fires a `repository_dispatch` event on release; a publish workflow here sanitizes (stripping internal-only operations, servers, and vendor extensions), lints, diffs for breaking changes, converts formats, and commits under a bot identity. `CODEOWNERS` and a CI check block human edits to `specs/`.

## Local development

**Publish pipeline** (root-level, Node 20+, no global installs required):

```bash
# Sanitize a raw (already-bundled/dereferenced) spec
node scripts/sanitize.mjs <input.yaml> <output.yaml>

# Lint + forbidden-string scan a sanitized spec
scripts/validate.sh specs/<service>/openapi.yaml

# Rebuild index.json from specs/
node scripts/build-index.mjs

# Run the pipeline's tests
npm test
```

**The web app** (`web/`, Node 22+ — see `web/README.md` if more detail is ever added there):

```bash
cd web
npm install   # needs NODE_AUTH_TOKEN set to a GitHub PAT with read:packages, for @nscaledev/ui
npm run dev   # http://localhost:3000
```

## License

Apache-2.0 (see `LICENSE`). Specs published here may be used to generate API clients.
