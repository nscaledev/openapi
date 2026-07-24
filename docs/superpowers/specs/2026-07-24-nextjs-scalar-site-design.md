# Design: Next.js reference site (replaces the static GitHub Pages site)

**Status:** Approved, pending platform/SRE confirmation on DNS + Vault before deploy
**Date:** 2026-07-24
**Repo:** `nscaledev/openapi`

## Context

Phase 1 shipped a static GitHub Pages site (`site/index.html`, `site/reference.html`, Scalar loaded via CDN) as the browsing UI for published specs, alongside the actual data layer: `specs/`, `index.json`, and the sanitize → validate → bundle → index publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`). That pipeline is live, tested (26 passing fixture tests), and already publishing the compute service's spec.

During a follow-on design conversation about adding an "Ask AI" chat feature, two things surfaced that changed the plan:

1. Nscale has a real, published, installable design-system package — `@nscaledev/ui` (GitHub Packages, v0.5.1) — that a Next.js app could depend on, giving a consistent look with zero custom CSS work.
2. Scalar's simplest Next.js integration (`@scalar/nextjs-api-reference`, a route handler) returns a raw HTML document and bypasses Next's layout system — it can't coexist on a page with other React content. The component form, `@scalar/api-reference-react`, embeds normally inside a page and layout tree.

Given those, and a preference for one deployable unit on Nscale's own k8s clusters rather than static hosting plus a separate service, the decision was made to replace the static site with a single Next.js app. **The "Ask AI" chat feature and custom `x-codeSamples` SDK examples are explicitly deferred** — v1 ships the core browsing experience only, using Scalar's default generated code samples.

## Architecture

```
ONE Next.js app (App Router), styled with @nscaledev/ui
  ├─ "/"                      — landing page listing services, reads index.json
  ├─ "/reference/[service]"   — <ApiReferenceReact /> per service, default
  │                             generated code samples only (no x-codeSamples yet)
  └─ deployed as ONE container, ONE Helm chart, to Nscale's own k8s cluster
     (mirroring the ai-proxy / watchtower-service chart shape:
      Deployment, Service, Ingress, ServiceAccount)
```

**Unchanged**: `specs/`, `index.json`, and the entire publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`) — this app is only a new *reader* of that same already-public data, fetched from the same `openapi.nscale.com` URLs any other consumer would use.

**Retired**: the static site (`site/*.html`, `pages.yml`) and the GitHub Pages deployment enabled during Phase 1. Once the Next.js app is confirmed working, Pages gets disabled rather than run in parallel — one presentation layer, not two.

**Explicitly out of scope for v1** (deferred, not abandoned):
- The "Ask AI" chat widget and its supporting `/api/chat` route, tool-calling design (`list_services`/`search_endpoints`/`get_service_spec`), and Nscale Inference API integration — fully designed in this conversation but not being built now.
- Custom `x-codeSamples` entries showing Nscale's own SDKs (`nscale-sdk-go`, etc.) — v1 uses Scalar's built-in generated-from-spec code samples only.

## Data flow

- Landing page (`/`): server-side fetch of `index.json` at request/build time, rendered as a list of service cards using `@nscaledev/ui` primitives (its confirmed catalog includes buttons, badges, tables, tabs, breadcrumbs, and nav components — exact composition is an implementation-time choice, not a new component to build).
- Reference page (`/reference/[service]`): server-side fetch of `specs/<service>/openapi.json`, passed into `<ApiReferenceReact />`.
- No client-side secrets, no proxy, no dependency beyond the already-public spec URLs.

## Error handling

- Unknown `service` param → a proper Next.js 404, not the static site's client-side redirect hack (that redirect existed specifically to work around GitHub Pages having no server-side routing; a real app doesn't need it).
- Upstream fetch failure (specs temporarily unreachable) → an error boundary with a retry affordance, not a blank page.

## Testing

Same seam-based philosophy as Phase 1's pipeline: pure functions get direct unit tests, not the framework glue around them.
- Pure functions to test directly: the landing page's `index.json` → card view-model shaping, and `service`-param validation for the reference route.
- Component rendering: a smoke test per page (renders without throwing, shows expected content for a known-good `index.json`/spec fixture).
- No fixture-based pipeline tests needed here — this app never touches sanitize/validate/index-build; those stay covered by Phase 1's existing 26 tests.

## Deployment

Helm chart mirroring `ai-proxy`/`watchtower-service`'s shape (`Chart.yaml`, `values.yaml`, `templates/{deployment,service,ingress,serviceaccount}.yaml`). Written and kept local — not applied to any cluster, not wired into a `k8s-deploy-*` repo's ArgoCD `Application` — until two things are confirmed with platform/SRE:

1. **DNS**: how a new public hostname gets created and pointed at the cluster's ingress load balancer (no existing automation for this was found for HTTP services during research).
2. **Vault AppRole access**: whether this app gets its own AppRole/path or reuses an existing team's mount (moot for v1 specifically, since v1 needs no secrets at all — no inference API key — but the same chart shape will need this once Ask AI is built later).

No inference API key or other secret is required for v1's scope, which removes the Vault/ExternalSecrets concern that the (deferred) Ask AI feature would have needed.

## Rationale for key decisions

- **`@nscaledev/ui` over custom CSS**: real, versioned, published package (not workspace-only); reduces this app's own design work to near zero; keeps visual consistency with the rest of Nscale's products.
- **`@scalar/api-reference-react` over `@scalar/nextjs-api-reference`**: the route-handler form bypasses Next's layout entirely, which would have blocked adding the (deferred) chat widget to the same page later. The component form costs a little more setup now but keeps that door open without a rewrite.
- **Scalar is free for this**: `scalar/scalar` is MIT-licensed; the self-hosted reference-viewer package needs no account, key, or payment. Scalar's paid tier is a separate cloud product (hosted docs, the Agent AI assistant, SDK generation-as-a-service) that this design doesn't use.
- **Deferring Ask AI and `x-codeSamples`**: both are real, validated ideas (verified `x-codeSamples` is a standard, documented pattern many companies use for exactly this) but add scope (a backend + inference API key + Vault wiring for chat; curated per-operation samples for SDKs) that isn't needed to ship the core browsing experience. Revisit once the base app is live.
