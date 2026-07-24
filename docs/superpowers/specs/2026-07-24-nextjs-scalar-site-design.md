# Design: Next.js reference site (replaces the static GitHub Pages site)

**Status:** Approved, pending platform/SRE confirmation on DNS and Vault AppRole access before deploy
**Date:** 2026-07-24
**Repo:** `nscaledev/openapi`

## Context

Phase 1 shipped a static GitHub Pages site (`site/index.html`, `site/reference.html`, Scalar loaded via CDN) as the browsing UI for published specs, alongside the actual data layer: `specs/`, `index.json`, and the sanitize → validate → bundle → index publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`). That pipeline is live, tested (26 passing fixture tests), and already publishing the compute service's spec.

During a follow-on design conversation about adding an "Ask AI" chat feature, two things surfaced that changed the plan:

1. Nscale has a real, published, installable design-system package — `@nscaledev/ui` (GitHub Packages, v0.5.1) — that a Next.js app could depend on, giving a consistent look with little custom CSS work.
2. A preference for one deployable unit on Nscale's own k8s clusters, rather than static hosting plus a separate service.

Given those, the decision was made to replace the static site with a single Next.js app. The design went through two more rounds after that: an adversarial review (which found a real self-contradiction and talked the design back down to something simpler — see Architecture), and then a decision to bring the "Ask AI" chat feature back into v1 scope after all, simplified (see Architecture) once it became clear each page is already split one-per-service. Custom `x-codeSamples` SDK examples remain deferred. The sections below reflect the final version, not the intermediate drafts.

## Architecture

```
ONE Next.js app (App Router), styled with @nscaledev/ui
  ├─ "/"                        — landing page listing services, reads index.json
  ├─ "/reference/[service]"     — Scalar embedded via @scalar/api-reference-react
  │                               (a normal page in the layout tree, default
  │                               generated code samples only — no x-codeSamples
  │                               yet), plus a chat widget (useChat) on the same
  │                               page, grounded in just this service's spec
  ├─ "/api/chat/[service]"      — Route Handler: streamText() against Nscale's
  │                               Inference API (createOpenAICompatible), same
  │                               pattern as nscale-ui's provider.ts/route.ts
  └─ deployed as ONE container, ONE Helm chart, to Nscale's own k8s cluster
     (mirroring the ai-proxy / watchtower-service chart shape:
      Deployment, Service, Ingress, ServiceAccount, plus a
      SecretStore/ExternalSecret for the Inference API key)
```

**Unchanged**: `specs/`, `index.json`, and the entire publish pipeline (`sanitize.mjs`, `build-index.mjs`, `validate.sh`, `publish.yml`, `protect-specs.yml`, `ci.yml`) — untouched by this design.

**Retired, fully**: the static site (`site/*.html`) *and* the GitHub Pages deployment itself (`pages.yml`), including the custom domain registration made during Phase 1 — `openapi.nscale.com` now points at this app's k8s ingress instead. This is only safe because of a change described in Data Flow below: the app reads spec data directly from the git repo via GitHub's raw content API, not from the Pages-hosted site. (The first draft of this design had Pages retired *and* the app still depending on Pages-served URLs — a real self-contradiction, caught in review and fixed here.)

**Ask AI — reinstated for v1, simplified.** Originally deferred (see the multi-service, tool-calling design earlier in this doc's history: `list_services`/`search_endpoints`/`get_service_spec`). Reinstated because the pages are already split one-per-service (`/reference/[service]`), so there's no cross-service question to answer — the assistant only ever needs the *current* page's spec, grounded directly in its system prompt. No tools, no catalog-wide search.

This is also cheaper to build than originally scoped, for a reason that only exists because of the earlier Next.js pivot: since this is now a real Next.js app rather than a static site, the chat backend is just another Route Handler in the *same app* (`app/api/chat/[service]/route.ts`) — no separate proxy service, no second Helm chart, no second ingress hostname. It mirrors nscale-ui's own `route.ts`/`provider.ts` pattern almost exactly (`streamText()` against `createOpenAICompatible(...)` pointed at Nscale's Inference API), except with a static service-level API key instead of a per-user Auth0 token, since docs visitors are anonymous.

Client-side, the earlier design's hand-rolled `fetch()` + `ReadableStream` reader (chosen because the old static site had "zero framework, zero build step") is no longer the right call — we're in a real React app now, so `@ai-sdk/react`'s `useChat` is used directly, same as nscale-ui's client.

**This does reintroduce a real runtime secret** (the Inference API key) that the earlier "no secrets" framing didn't have to account for — see Deployment.

**Still explicitly out of scope for v1** (deferred, not abandoned):
- Custom `x-codeSamples` entries showing Nscale's own SDKs (`nscale-sdk-go`, etc.) — v1 uses Scalar's built-in generated-from-spec code samples only.
- Rate limiting / abuse prevention beyond a basic in-process per-IP limiter — this is a public, anonymous, unauthenticated endpoint, and nscale-ui's own pattern has no rate-limiting to copy (it doesn't need any — logged-in users are billed via credits). A simple in-process limiter ships with v1 as a stopgap; anything more (ingress-level limits, WAF rules) is a follow-up once this is actually deployed and real traffic patterns are known.

## Visual direction

The landing page should read as an Nscale product page, not a generic docs site — modeled directly on console.nscale.com (which `@nscaledev/ui` already styles), not a new look invented for this app:

- **Navy hero banner** at the top of the page: an outlined icon on the left, a small light-weight overline label above a bold white heading, and a primary action pinned to the right (e.g. a "Browse all specs" or similar action) — matching the `Compute` / `Instances` banner pattern shown in the reference screenshots.
- **White content cards below the banner**, each following the console's own "Get started with X" shape: a large icon, a bold black heading, a gray descriptive line, and a black pill-shaped call-to-action button. One card per published service (reading from `index.json`), rather than one card for a single feature — this reuses the shape, not the literal content.
- **Navy/black accent palette, generous whitespace, rounded corners** throughout, consistent with the reference screenshots — no separate color/spacing system to design.
- Sidebar navigation (grouped, labeled sections in the console reference) is *not* needed here — this is a two-page app, not a multi-section console — but the same left-nav visual language could inform how `/reference/[service]` breadcrumbs back to the landing page, if that turns out to want more than a simple link.

Since `@nscaledev/ui` is the actual library the console itself is built with, achieving this is expected to be mostly a matter of using its existing components/tokens as intended, not custom CSS.

**Brand assets, reused rather than recreated:**
- **Logo**: `@nscaledev/ui` exports real logo components directly (`./logos/*` is a genuine entry in its package `exports` map) — `NscaleFullLogo`, `NscaleWordmarkLogo`, `NscaleSymbolLogo`. Import these from the package once it's a dependency; don't vendor an image file.
- **Favicon**: not part of the published package (it's a plain static asset in the console app, not exported). Copy `favicon.ico`, `favicon-32.png`, and `favicon-180.png` from `nscale-ui/apps/console/public/static/imgs/` into this app's `public/` directory and wire them up via Next.js's standard `app/favicon.ico`/`icon`/`apple-icon` file conventions.

## Data flow

- Both pages fetch data server-side directly from GitHub's raw content (e.g. `raw.githubusercontent.com/nscaledev/openapi/main/index.json` and `.../specs/<service>/openapi.json`), **not** from `openapi.nscale.com` — that's the fix for the Pages-retirement contradiction above. Fetches use a short revalidation window (on the order of a minute) so a new publish shows up automatically without needing to redeploy this app.
- Landing page (`/`): fetches `index.json`, rendered as a list of service cards using `@nscaledev/ui` primitives (its confirmed catalog includes buttons, badges, tables, tabs, breadcrumbs, and nav components — exact composition is an implementation-time choice, not a new component to build).
- Reference page (`/reference/[service]`): Scalar's route handler is configured to fetch that service's `openapi.json` from the same raw-content URL. The same page mounts a chat widget wired to `/api/chat/[service]`.
- Chat (`/api/chat/[service]`): the Route Handler fetches that one service's already-public sanitized spec (same raw-content URL, not re-sanitized here), embeds it in the system prompt, and streams a response from Nscale's Inference API. No client-side secrets — the Inference API key stays server-side, injected via the pod's environment (see Deployment).
- This is **not** a secret-free app: the Inference API key is a real runtime secret (reinstated with chat), and the `@nscaledev/ui` install token is a real build-time secret (see Deployment).

## Error handling

- Unknown `service` param (on either the reference page or the chat route) → a proper Next.js 404, not the static site's client-side redirect hack (that redirect existed specifically to work around GitHub Pages having no server-side routing; a real app doesn't need it).
- Upstream fetch failure (specs temporarily unreachable) → an error boundary with a retry affordance, not a blank page.
- Inference API failure (rate-limited, credit-exhausted, unreachable) → the chat widget shows an inline error in the conversation, not a silent hang; matches nscale-ui's own pattern of surfacing a `429` as a clear "out of capacity" state rather than a generic failure.

## Testing

Same seam-based philosophy as Phase 1's pipeline: pure functions get direct unit tests, not the framework glue around them.
- Pure functions to test directly: the landing page's `index.json` → card view-model shaping, `service`-param validation (shared by the reference page and the chat route), and the chat route's system-prompt-building function (spec content in, prompt string out).
- Component rendering: a smoke test per page (renders without throwing, shows expected content for a known-good `index.json`/spec fixture).
- The chat route itself is tested by mocking the Inference API call (fixed request in, assert the outgoing request shape and that a non-2xx upstream response surfaces as the expected error state) — never a real call to the Inference API in tests.
- No fixture-based pipeline tests needed here — this app never touches sanitize/validate/index-build; those stay covered by Phase 1's existing 26 tests.

## Deployment

**Container build/push**: a Dockerfile and a CI workflow that builds and pushes the image to `ghcr.io/nscaledev/<this-service>` on push/tag, mirroring `ai-proxy`'s `dev-build.yml`/`release.yml` pattern. The build stage needs a GitHub Packages read token (see Secrets below) to `npm install @nscaledev/ui` — pass it via Docker's `--secret` mount, not a build ARG, so it never ends up baked into an image layer.

**Helm chart**: mirrors `ai-proxy`/`watchtower-service`'s shape (`Chart.yaml`, `values.yaml`, `templates/{deployment,service,ingress,serviceaccount}.yaml`), including the resource limits, liveness/readiness probes, and rollout strategy those charts already establish, **plus a `SecretStore`/`ExternalSecret` for the Inference API key** (see Secrets below) — the same Vault/External-Secrets-Operator pattern documented for `onboarding-service`/`watchtower-service`. Written and kept local — not applied to any cluster, not wired into a `k8s-deploy-*` repo's ArgoCD `Application` — until two things are confirmed with platform/SRE:

- **DNS**: how a new public hostname gets created and pointed at the cluster's ingress load balancer (no existing automation for this was found for HTTP services during research).
- **Vault AppRole access**: whether this app gets its own AppRole/path or reuses an existing team's mount for the Inference API key — genuinely needed now that chat is back in scope (the earlier draft's "Vault is moot for v1" was only true while chat was deferred).

**Secrets**: two kinds, don't conflate them. (1) A **runtime** secret — the Inference API key, injected into the running pod via Vault/ExternalSecrets, never touching the browser or build process. (2) A **build-time** secret — installing `@nscaledev/ui` from GitHub Packages requires a `.npmrc` with `@nscaledev:registry=https://npm.pkg.github.com` and a PAT/`NODE_AUTH_TOKEN` with `read:packages` scope. In CI, this can very likely just be the workflow's own built-in `GITHUB_TOKEN` with `permissions: packages: read` declared (standard for same-org GitHub Packages) — no new secret needed there. Local development and the Docker build stage still need a real personal PAT, passed via Docker's `--secret` mount, never a build ARG, so it never ends up baked into an image layer.

## Rationale for key decisions

- **`@nscaledev/ui` over custom CSS**: real, versioned, published package (not workspace-only); reduces this app's own design work; keeps visual consistency with the rest of Nscale's products. It's pre-1.0 (0.5.1) — pin the exact version and bump deliberately rather than tracking a caret range.
- **`@scalar/api-reference-react` (embedded component) — this decision flip-flopped twice, worth recording why it landed here.** Draft 1 chose the component form to keep the door open for a chat widget on the same page. Adversarial review pushed back to the simpler route-handler form (`@scalar/nextjs-api-reference`) because chat was deferred at the time — paying the component form's real costs (a Vue renderer wrapped in a React shim, SSR-hydration bugs in its history, a client-component boundary, CSS/theme collision risk with `@nscaledev/ui`) for a maybe-never benefit made no sense. Now that chat is back in v1 scope *on this same page*, that calculus flips back: the route-handler form architecturally cannot host anything else on its route (it returns a raw HTML document, bypassing Next's layout entirely) — a chat widget simply could not render there. The component form's costs are real and still apply; they're just no longer speculative, since the thing they buy (coexisting with the chat widget) is now an actual v1 requirement, not a maybe-later one. Implementation should watch for the specific risks called out above (pin a version past the known SSR-hydration fixes; wrap in a client boundary deliberately, not by accident; check for CSS collisions with `@nscaledev/ui` early rather than late).
- **Scalar is free for this**: `scalar/scalar` is MIT-licensed; the self-hosted reference-viewer package needs no account, key, or payment. Scalar's paid tier is a separate cloud product (hosted docs, the Agent AI assistant, SDK generation-as-a-service) that this design doesn't use.
- **Ask AI reinstated, `x-codeSamples` still deferred**: chat turned out cheap to add once the site was already a Next.js app with per-service pages (no tools, no separate proxy — just another Route Handler and a real Inference API key). `x-codeSamples` is a real, validated idea (a standard, documented pattern many companies use for exactly this) but adds scope (curated per-operation samples for SDKs) with no equivalent "already paid for by another decision" discount — still deferred, revisit once the base app is live.
- **Fetching from GitHub raw content, not `openapi.nscale.com`**: lets Pages be retired cleanly (see Architecture) and gives automatic pickup of new publishes via short-window revalidation, without wiring a redeploy trigger into `publish.yml`.
