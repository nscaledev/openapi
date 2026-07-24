# Design: Next.js reference site (replaces the static GitHub Pages site)

**Status:** Approved, pending platform/SRE confirmation on DNS before deploy
**Date:** 2026-07-24
**Repo:** `nscaledev/openapi`

## Context

Phase 1 shipped a static GitHub Pages site (`site/index.html`, `site/reference.html`, Scalar loaded via CDN) as the browsing UI for published specs, alongside the actual data layer: `specs/`, `index.json`, and the sanitize → validate → bundle → index publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`). That pipeline is live, tested (26 passing fixture tests), and already publishing the compute service's spec.

During a follow-on design conversation about adding an "Ask AI" chat feature, two things surfaced that changed the plan:

1. Nscale has a real, published, installable design-system package — `@nscaledev/ui` (GitHub Packages, v0.5.1) — that a Next.js app could depend on, giving a consistent look with little custom CSS work.
2. A preference for one deployable unit on Nscale's own k8s clusters, rather than static hosting plus a separate service.

Given those, the decision was made to replace the static site with a single Next.js app. **The "Ask AI" chat feature and custom `x-codeSamples` SDK examples are explicitly deferred** — v1 ships the core browsing experience only, using Scalar's default generated code samples.

This design went through an adversarial review after the first draft, which found a real self-contradiction (see below) and talked the design back down to something simpler. The sections below reflect the corrected version.

## Architecture

```
ONE Next.js app (App Router), styled with @nscaledev/ui
  ├─ "/"                      — landing page listing services, reads index.json
  ├─ "/reference/[service]"   — Scalar embedded via @scalar/nextjs-api-reference
  │                             (its own route, default generated code samples
  │                             only — no x-codeSamples yet)
  └─ deployed as ONE container, ONE Helm chart, to Nscale's own k8s cluster
     (mirroring the ai-proxy / watchtower-service chart shape:
      Deployment, Service, Ingress, ServiceAccount)
```

**Unchanged**: `specs/`, `index.json`, and the entire publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`) — untouched by this design.

**Retired, fully**: the static site (`site/*.html`) *and* the GitHub Pages deployment itself (`pages.yml`), including the custom domain registration made during Phase 1 — `openapi.nscale.com` now points at this app's k8s ingress instead. This is only safe because of a change described in Data Flow below: the app reads spec data directly from the git repo via GitHub's raw content API, not from the Pages-hosted site. (The first draft of this design had Pages retired *and* the app still depending on Pages-served URLs — a real self-contradiction, caught in review and fixed here.)

**Explicitly out of scope for v1** (deferred, not abandoned):
- The "Ask AI" chat widget and its supporting `/api/chat` route, tool-calling design (`list_services`/`search_endpoints`/`get_service_spec`), and Nscale Inference API integration — fully designed in this conversation but not being built now.
- Custom `x-codeSamples` entries showing Nscale's own SDKs (`nscale-sdk-go`, etc.) — v1 uses Scalar's built-in generated-from-spec code samples only.

## Visual direction

The landing page should read as an Nscale product page, not a generic docs site — modeled directly on console.nscale.com (which `@nscaledev/ui` already styles), not a new look invented for this app:

- **Navy hero banner** at the top of the page: an outlined icon on the left, a small light-weight overline label above a bold white heading, and a primary action pinned to the right (e.g. a "Browse all specs" or similar action) — matching the `Compute` / `Instances` banner pattern shown in the reference screenshots.
- **White content cards below the banner**, each following the console's own "Get started with X" shape: a large icon, a bold black heading, a gray descriptive line, and a black pill-shaped call-to-action button. One card per published service (reading from `index.json`), rather than one card for a single feature — this reuses the shape, not the literal content.
- **Navy/black accent palette, generous whitespace, rounded corners** throughout, consistent with the reference screenshots — no separate color/spacing system to design.
- Sidebar navigation (grouped, labeled sections in the console reference) is *not* needed here — this is a two-page app, not a multi-section console — but the same left-nav visual language could inform how `/reference/[service]` breadcrumbs back to the landing page, if that turns out to want more than a simple link.

Since `@nscaledev/ui` is the actual library the console itself is built with, achieving this is expected to be mostly a matter of using its existing components/tokens as intended, not custom CSS.

## Data flow

- Both pages fetch data server-side directly from GitHub's raw content (e.g. `raw.githubusercontent.com/nscaledev/openapi/main/index.json` and `.../specs/<service>/openapi.json`), **not** from `openapi.nscale.com` — that's the fix for the Pages-retirement contradiction above. Fetches use a short revalidation window (on the order of a minute) so a new publish shows up automatically without needing to redeploy this app.
- Landing page (`/`): fetches `index.json`, rendered as a list of service cards using `@nscaledev/ui` primitives (its confirmed catalog includes buttons, badges, tables, tabs, breadcrumbs, and nav components — exact composition is an implementation-time choice, not a new component to build).
- Reference page (`/reference/[service]`): Scalar's route handler is configured to fetch that service's `openapi.json` from the same raw-content URL.
- No runtime application secrets (no inference API key, no proxy) — but see Deployment below, this is **not** a fully secret-free app once the build step is accounted for.

## Error handling

- Unknown `service` param → a proper Next.js 404, not the static site's client-side redirect hack (that redirect existed specifically to work around GitHub Pages having no server-side routing; a real app doesn't need it).
- Upstream fetch failure (specs temporarily unreachable) → an error boundary with a retry affordance, not a blank page.

## Testing

Same seam-based philosophy as Phase 1's pipeline: pure functions get direct unit tests, not the framework glue around them.
- Pure functions to test directly: the landing page's `index.json` → card view-model shaping, and `service`-param validation for the reference route.
- Component rendering: a smoke test per page (renders without throwing, shows expected content for a known-good `index.json`/spec fixture).
- No fixture-based pipeline tests needed here — this app never touches sanitize/validate/index-build; those stay covered by Phase 1's existing 26 tests.

## Deployment

**Container build/push**: a Dockerfile and a CI workflow that builds and pushes the image to `ghcr.io/nscaledev/<this-service>` on push/tag, mirroring `ai-proxy`'s `dev-build.yml`/`release.yml` pattern. The build stage needs a GitHub Packages read token (see Secrets below) to `npm install @nscaledev/ui` — pass it via Docker's `--secret` mount, not a build ARG, so it never ends up baked into an image layer.

**Helm chart**: mirrors `ai-proxy`/`watchtower-service`'s shape (`Chart.yaml`, `values.yaml`, `templates/{deployment,service,ingress,serviceaccount}.yaml`), including the resource limits, liveness/readiness probes, and rollout strategy those charts already establish — nothing novel needed there. Written and kept local — not applied to any cluster, not wired into a `k8s-deploy-*` repo's ArgoCD `Application` — until DNS is confirmed with platform/SRE:

- **DNS**: how a new public hostname gets created and pointed at the cluster's ingress load balancer (no existing automation for this was found for HTTP services during research). This is the only platform-blocked item — see Secrets below for why Vault isn't one.

**Secrets — corrected from the first draft, which claimed "no secrets" for v1 and was wrong**: there genuinely are no *runtime application* secrets (no inference API key, no per-request credential). But installing `@nscaledev/ui` from GitHub Packages requires a `.npmrc` with `@nscaledev:registry=https://npm.pkg.github.com` and a PAT/`NODE_AUTH_TOKEN` with `read:packages` scope, at **build time only**. That's a CI-level secret (a GitHub Actions secret for the build workflow), not a running-pod Vault/ExternalSecret — which is why it doesn't block deployment the way DNS does, but it must exist before CI can build the image at all, and needs to be set up as part of implementation, not assumed away.

## Rationale for key decisions

- **`@nscaledev/ui` over custom CSS**: real, versioned, published package (not workspace-only); reduces this app's own design work; keeps visual consistency with the rest of Nscale's products. It's pre-1.0 (0.5.1) — pin the exact version and bump deliberately rather than tracking a caret range.
- **`@scalar/nextjs-api-reference` (route handler) over `@scalar/api-reference-react` (embedded component) — reversed from the first draft.** The first draft chose the component form specifically to keep the door open for embedding the deferred chat widget on the same page later. Adversarial review pointed out that component form's real costs, paid now for a maybe-never benefit: it wraps a Vue-based renderer in a React shim (with SSR-hydration bugs in its history and no minimum safe version identified in this design), needs a client-component boundary for a payload that can be large for bigger specs, and risks CSS/theme collisions with `@nscaledev/ui` on the same page. The simpler route-handler form is Scalar's own recommended default, avoids all of that by owning its route entirely, and matches "as simple and stable as possible." If chat gets built later, switching forms then is a contained, well-scoped change — not a cost worth paying speculatively today.
- **Scalar is free for this**: `scalar/scalar` is MIT-licensed; the self-hosted reference-viewer package needs no account, key, or payment. Scalar's paid tier is a separate cloud product (hosted docs, the Agent AI assistant, SDK generation-as-a-service) that this design doesn't use.
- **Deferring Ask AI and `x-codeSamples`**: both are real, validated ideas (`x-codeSamples` is a standard, documented pattern many companies use for exactly this) but add scope (a backend + inference API key + Vault wiring for chat; curated per-operation samples for SDKs) that isn't needed to ship the core browsing experience. Revisit once the base app is live.
- **Fetching from GitHub raw content, not `openapi.nscale.com`**: lets Pages be retired cleanly (see Architecture) and gives automatic pickup of new publishes via short-window revalidation, without wiring a redeploy trigger into `publish.yml`.
