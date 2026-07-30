# nscaledev/openapi

The canonical, public home for Nscale's OpenAPI specs. One folder per service, one subfolder per published version:

```
identity/main/openapi.yaml
identity/main/openapi.json
identity/latest/openapi.yaml
identity/latest/openapi.json
identity/v1.13.0/openapi.yaml
identity/v1.13.0/openapi.json
compute/main/openapi.yaml
compute/main/openapi.json
...
```

`main/` always reflects whatever's currently on the source service's `main` branch. `vX.Y.Z/` is an immutable snapshot of an actual tagged release, using that repo's own release tag verbatim — never a prerelease (`vX.Y.Z-rc1` etc. still get their own version folder, just never become `latest/`). `latest/` always mirrors whichever stable release is newest, so anything linking to `<service>/latest/openapi.yaml` — a Mintlify overview page, a codegen pipeline, whatever — never needs updating when a new version ships. That's the whole repo — no index, no generated site, no changelog file. Git history on this repo *is* the changelog.

This repo is **not** the polished API docs experience — that's [docs.nscale.com](https://docs.nscale.com), built with Mintlify. It's the raw, technical layer underneath: the thing Mintlify, Postman, codegen tools, and anything else all pull from.

## How specs get here

Specs are **never hand-edited in this repo**. Each source service repo calls the shared [`publish-spec`](.github/actions/publish-spec/action.yml) action from its own CI:

```yaml
- name: Publish OpenAPI spec
  uses: nscaledev/openapi/.github/actions/publish-spec@<commit-sha> # main
  with:
    service: identity
    spec-path: pkg/openapi/server.spec.yaml
    version: main   # or ${{ github.ref_name }} from a release workflow
    token: ${{ secrets.OPENAPI_PUBLISH_TOKEN }}
```

Pin `<commit-sha>` to this repo's current `main` HEAD rather than referencing `@main` directly — it's a separate repo, so an unpinned branch ref means anyone who can push here could silently change what every caller's CI executes with `OPENAPI_PUBLISH_TOKEN` in scope. Bump the pinned SHA by hand when you want a caller to pick up a change to the action.

Call it with `version: main` from a main-push workflow, and with `version: ${{ github.ref_name }}` from a tag-release workflow. The action bundles (dereferences `$ref`s), sanitizes (strips internal-only operations, servers, and vendor extensions), lints, converts to JSON, and commits directly to `main` here under a bot identity (`nscale-openapi-bot`). `CODEOWNERS` and `.github/workflows/protect-published-specs.yml` block human edits to any `<service>/main/` or `<service>/vX.Y.Z/` path.

**Prerequisite:** each source repo needs an `OPENAPI_PUBLISH_TOKEN` secret — a token with `contents: write` on this repo — before the action can push. That's provisioned per-repo by a human; the action doesn't create it.

`main` requires the `test` and `check` status checks to pass and blocks force-pushes/deletions, but admins are exempt from required checks (`enforce_admins: false`) — deliberately, since the action pushes straight to `main` with no PR, and a brand-new commit can never have a passing check recorded against it before it lands. Whatever account `OPENAPI_PUBLISH_TOKEN` belongs to needs admin or maintain access here, or its pushes will be rejected the same way a non-admin's would be.

## Local development

Node 20+, no global installs required:

```bash
# Sanitize a raw (already-bundled/dereferenced) spec
node scripts/sanitize.mjs <input.yaml> <output.yaml> <service-id>

# Lint + forbidden-string scan a sanitized spec
scripts/validate.sh <path/to/openapi.yaml>

# Run the pipeline's tests
npm test
```

## License

Apache-2.0 (see `LICENSE`). Specs published here may be used to generate API clients.
