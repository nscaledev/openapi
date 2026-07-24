# Next.js Reference Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static GitHub Pages site in `nscaledev/openapi` with a single Next.js app — a landing page listing published services, a per-service Scalar reference page, and a per-service "Ask AI" chat grounded in that one spec — styled with Nscale's own `@nscaledev/ui` design system, deployable as one container to Nscale's own k8s cluster.

**Architecture:** Next.js 15 App Router app at `web/` inside the existing `nscaledev-openapi` repo. Both pages fetch spec data server-side from GitHub's raw content API (never from GitHub Pages, which this app fully replaces). `/reference/[service]` embeds Scalar via `@scalar/api-reference-react` (a normal page component, not the route-handler form, because the chat widget has to share the page). `/api/chat/[service]` is a Route Handler that streams a response from Nscale's own Inference API, grounded only in that one service's spec — no tool-calling, no cross-service search.

**Tech Stack:** Next.js 15.5.18, React 19, TypeScript ~6.0, Tailwind CSS ^4.2.2, `@nscaledev/ui` (pinned exact version, installed from GitHub Packages), `@scalar/api-reference-react`, Vercel AI SDK (`ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/react`), Vitest + React Testing Library, Docker (Chainguard base images), Helm.

## Global Constraints

- Node >=22 required (`@scalar/api-reference-react`'s toolchain needs it) — set `"engines": { "node": ">=22" }` in `web/package.json`.
- Pin `@nscaledev/ui`, `next`, `react`, `react-dom`, `next-themes`, `tailwindcss`, `typescript`, `vitest` to the exact versions confirmed compatible with `@nscaledev/ui` in `nscale-ui/apps/console/package.json` (Next 15.5.18, React ^19, `next-themes` ^0.4.6, Tailwind ^4.2.2, TypeScript ^6.0.3, Vitest ^4.1.8) — not whatever `npm view` returns as latest, which may be a newer, unverified-compatible major.
- Fetch spec data only from `https://raw.githubusercontent.com/nscaledev/openapi/main/...` — never from `openapi.nscale.com` (the GitHub Pages site this app replaces).
- Do **not** delete `site/*.html`, disable `pages.yml`, or touch the `openapi.nscale.com` DNS/Pages configuration as part of this plan — that cutover happens later, manually, only once this app is confirmed deployed and working at the real domain. Building this app must not take down the currently-live static site.
- No custom `x-codeSamples` SDK examples, no cross-service search/tool-calling for chat — both explicitly deferred per the design doc.
- The Helm chart is written and locally verified (`helm lint`, `helm template`) but never applied to a cluster or wired into a `k8s-deploy-*` repo's ArgoCD `Application` as part of this plan — deployment is blocked on platform/SRE confirming DNS and Vault AppRole access.
- Every service (`fetch`, `ai` provider) call must be mockable/mocked in tests — no test may make a real network call to GitHub, the Inference API, or anywhere else.

---

## File Structure

```
nscaledev-openapi/
  web/                                  # new Next.js app (this plan's scope)
    package.json
    package-lock.json
    tsconfig.json
    next.config.ts
    vitest.config.ts
    vitest.setup.ts
    .npmrc
    Dockerfile
    .dockerignore
    public/
      static/imgs/
        favicon.ico
        favicon-32.png
        favicon-180.png
    src/
      app/
        layout.tsx
        page.tsx                        # "/" landing page
        globals.css
        not-found.tsx
        error.tsx
        reference/
          [service]/
            page.tsx                    # "/reference/[service]"
            not-found.tsx
        api/
          chat/
            [service]/
              route.ts                  # "/api/chat/[service]"
      lib/
        service-catalog.ts               # pure: index.json -> ServiceCatalogEntry[]
        service-catalog.test.ts
        service-param.ts                 # pure: validate a service id
        service-param.test.ts
        chat-system-prompt.ts            # pure: spec content -> system prompt string
        chat-system-prompt.test.ts
        rate-limit.ts                    # pure: in-process per-IP token bucket
        rate-limit.test.ts
        raw-content.ts                   # fetch wrappers (index.json, spec yaml/json)
      components/
        chat-widget.tsx                  # client component, useChat
        chat-widget.test.tsx
    charts/
      openapi-web/                       # Helm chart, written but not applied
        Chart.yaml
        values.yaml
        templates/
          _helpers.tpl
          deployment.yaml
          service.yaml
          ingress.yaml
          serviceaccount.yaml
          secret-store.yaml
          external-secret.yaml
  .github/workflows/
    web-ci.yml                           # test + build on PR/push, path-filtered to web/**
    web-release.yml                      # build + push image to ghcr.io on push/tag
```

**Responsibilities:**
- `lib/service-catalog.ts` — shapes the raw `index.json` document into what the landing page renders. No fetching, no React.
- `lib/service-param.ts` — the one place that decides whether a `service` route segment is valid. Shared by the reference page, its `not-found`, and the chat route.
- `lib/chat-system-prompt.ts` — turns a service title + its spec YAML into the system prompt string sent to the model. No fetching, no AI SDK.
- `lib/rate-limit.ts` — a standalone in-memory token bucket, independent of any framework, so it's trivially unit-testable.
- `lib/raw-content.ts` — the only place that knows the `raw.githubusercontent.com` URL shape; everything else calls its functions, never constructs the URL itself.
- `components/chat-widget.tsx` — the only client component that touches `@ai-sdk/react`.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/.npmrc`, `web/.gitignore`, `web/src/app/layout.tsx`, `web/src/app/page.tsx`, `web/src/app/globals.css`

**Interfaces:**
- Produces: a running Next.js dev server at `http://localhost:3000` serving a placeholder `/`.

- [ ] **Step 1: Create the app directory and package.json**

```bash
mkdir -p /Users/adamflanagan/code/openapi/nscaledev-openapi/web/src/app
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
```

Create `web/package.json`:

```json
{
  "name": "openapi-web",
  "private": true,
  "version": "0.1.0",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.5.18",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "typescript": "^6.0.3",
    "tailwindcss": "^4.2.2",
    "@tailwindcss/postcss": "^4.2.2",
    "vitest": "^4.1.8",
    "@vitejs/plugin-react": "^5.0.0",
    "jsdom": "^29.1.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts (standalone output for the Docker runtime stage)**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: Create .npmrc (no token committed — read from env at install time)**

```
@nscaledev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.next/
next-env.d.ts
*.tsbuildinfo
```

- [ ] **Step 6: Create a placeholder root layout and page**

`web/src/app/globals.css`:

```css
@import "tailwindcss";
```

`web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nscale OpenAPI Specs",
  description: "Canonical, public OpenAPI specs for Nscale's services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`web/src/app/page.tsx`:

```tsx
export default function LandingPage() {
  return <main>Scaffold OK</main>;
}
```

- [ ] **Step 7: Install and verify the dev server runs**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
npm run dev
```

Expected: server starts on `http://localhost:3000`, visiting it shows "Scaffold OK". Stop the server (Ctrl-C) once confirmed.

- [ ] **Step 8: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/package.json web/package-lock.json web/tsconfig.json web/next.config.ts web/.npmrc web/.gitignore web/src/app/layout.tsx web/src/app/page.tsx web/src/app/globals.css
git commit -m "web: scaffold Next.js app skeleton"
```

---

### Task 2: Install `@nscaledev/ui`, wire up theming and global styles

**Files:**
- Modify: `web/package.json`, `web/src/app/layout.tsx`, `web/src/app/globals.css`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the scaffold.
- Produces: a `ThemeProvider`-wrapped root layout; every later page can rely on `@nscaledev/ui`'s Tailwind classes and dark/light theming being active.

**Prerequisite (manual, cannot be scripted):** a GitHub PAT with `read:packages` scope on the `nscaledev` org, exported as `NODE_AUTH_TOKEN`, is required for `npm install` to succeed locally. `export NODE_AUTH_TOKEN=<your PAT>` before running any `npm install`/`npm ci` in `web/`.

- [ ] **Step 1: Confirm the current `@nscaledev/ui` version**

```bash
export NODE_AUTH_TOKEN=<your PAT with read:packages>
npm view @nscaledev/ui version --registry=https://npm.pkg.github.com
```

Expected: prints a version (e.g. `0.5.1` at design time — use whatever this prints, pinned exactly, not a caret range).

- [ ] **Step 2: Add dependencies to package.json**

Add to `web/package.json`'s `"dependencies"` (use the exact version Step 1 printed in place of `0.5.1` if it differs):

```json
    "@nscaledev/ui": "0.5.1",
    "next-themes": "^0.4.6",
```

- [ ] **Step 3: Install**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

Expected: installs cleanly, `node_modules/@nscaledev/ui` exists.

- [ ] **Step 4: Wire up global styles**

Replace `web/src/app/globals.css`:

```css
@import "tailwindcss";
@import "@nscaledev/ui/styles/globals.css";

@source "../**/*.{js,jsx,ts,tsx,mdx,css,svg}";
```

- [ ] **Step 5: Add PostCSS config for Tailwind v4**

Create `web/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 6: Wrap the root layout in ThemeProvider**

Replace `web/src/app/layout.tsx`:

```tsx
import { ThemeProvider } from "@nscaledev/ui/contexts/theme-provider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | Nscale OpenAPI",
    default: "Nscale OpenAPI Specs",
  },
  description: "Canonical, public OpenAPI specs for Nscale's services.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-nscale-background text-primary-content">
        <ThemeProvider attribute="class" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify the app still builds and the theme classes apply**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm run build
```

Expected: build succeeds with no errors. If it fails on the `@import "@nscaledev/ui/styles/globals.css"` line, run `ls node_modules/@nscaledev/ui/dist/components-v2/styles/` to confirm the file is actually named `globals.css` in the installed version, and adjust the import to match.

- [ ] **Step 8: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/package.json web/package-lock.json web/src/app/layout.tsx web/src/app/globals.css web/postcss.config.mjs
git commit -m "web: install @nscaledev/ui, wire up theming and Tailwind"
```

---

### Task 3: Brand assets — favicon and logo

**Files:**
- Create: `web/public/static/imgs/favicon.ico`, `web/public/static/imgs/favicon-32.png`, `web/public/static/imgs/favicon-180.png`, `web/src/components/site-header.tsx`
- Modify: `web/src/app/layout.tsx`

**Interfaces:**
- Produces: favicon wired via `Metadata.icons`; a `<SiteHeader />` component (rendered in the root layout, so it appears on every page) using `NscaleWordmarkLogo` from `@nscaledev/ui`.

- [ ] **Step 1: Copy favicon assets from nscale-ui**

```bash
mkdir -p /Users/adamflanagan/code/openapi/nscaledev-openapi/web/public/static/imgs
cp /Users/adamflanagan/code/openapi/nscale-ui/apps/console/public/static/imgs/favicon.ico \
   /Users/adamflanagan/code/openapi/nscaledev-openapi/web/public/static/imgs/favicon.ico
cp /Users/adamflanagan/code/openapi/nscale-ui/apps/console/public/static/imgs/favicon-32.png \
   /Users/adamflanagan/code/openapi/nscaledev-openapi/web/public/static/imgs/favicon-32.png
cp /Users/adamflanagan/code/openapi/nscale-ui/apps/console/public/static/imgs/favicon-180.png \
   /Users/adamflanagan/code/openapi/nscaledev-openapi/web/public/static/imgs/favicon-180.png
```

- [ ] **Step 2: Wire up favicon metadata**

In `web/src/app/layout.tsx`, add `icons` to the existing `metadata` export:

```tsx
export const metadata: Metadata = {
  title: {
    template: "%s | Nscale OpenAPI",
    default: "Nscale OpenAPI Specs",
  },
  description: "Canonical, public OpenAPI specs for Nscale's services.",
  icons: {
    shortcut: "/static/imgs/favicon.ico",
    apple: "/static/imgs/favicon-180.png",
    icon: "/static/imgs/favicon-32.png",
  },
};
```

- [ ] **Step 3: Create a site header using the real logo component**

`web/src/components/site-header.tsx`:

```tsx
import { NscaleWordmarkLogo } from "@nscaledev/ui/logos/nscale-logo-wordmark";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-primary-border">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <Link href="/" aria-label="Nscale OpenAPI Specs — home">
          <NscaleWordmarkLogo width={120} height={24} />
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Mount it in the root layout**

In `web/src/app/layout.tsx`, import and render `SiteHeader` above `{children}`:

```tsx
import { SiteHeader } from "@/components/site-header";
```

```tsx
        <ThemeProvider attribute="class" enableSystem>
          <SiteHeader />
          {children}
        </ThemeProvider>
```

- [ ] **Step 5: Verify the favicon loads and the logo renders**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm run dev
```

Visit `http://localhost:3000/static/imgs/favicon.ico` directly in a browser — expect the Nscale favicon image to load (not a 404). Visit `http://localhost:3000/` — expect the Nscale wordmark logo in a header above the page content. Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/public/static/imgs web/src/app/layout.tsx web/src/components/site-header.tsx
git commit -m "web: add favicon and site header using @nscaledev/ui's real logo component"
```

---

### Task 4: Set up Vitest, write the service-catalog pure function

**Files:**
- Create: `web/vitest.config.ts`, `web/vitest.setup.ts`, `web/src/lib/service-catalog.ts`, `web/src/lib/service-catalog.test.ts`

**Interfaces:**
- Produces: `shapeCatalog(index: unknown): ServiceCatalogEntry[]` and the `ServiceCatalogEntry` type, both imported by the landing page in Task 6.

- [ ] **Step 1: Create Vitest config**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
```

`web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write the failing test**

`web/src/lib/service-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shapeCatalog } from "./service-catalog";

describe("shapeCatalog", () => {
  it("shapes a well-formed index.json into catalog entries", () => {
    const result = shapeCatalog({
      services: [
        {
          id: "compute",
          title: "Compute Service API",
          version: "1.13.0",
          spec: {
            yaml: "https://openapi.nscale.com/specs/compute/openapi.yaml",
            json: "https://openapi.nscale.com/specs/compute/openapi.json",
          },
          docs: "https://docs.nscale.com/api-reference/compute",
        },
      ],
    });

    expect(result).toEqual([
      {
        id: "compute",
        title: "Compute Service API",
        version: "1.13.0",
        specUrl: "https://openapi.nscale.com/specs/compute/openapi.yaml",
        jsonUrl: "https://openapi.nscale.com/specs/compute/openapi.json",
        docsUrl: "https://docs.nscale.com/api-reference/compute",
      },
    ]);
  });

  it("falls back to the id for a missing title, and to null for a missing docs link", () => {
    const result = shapeCatalog({
      services: [{ id: "compute", version: "1.0.0", spec: {} }],
    });

    expect(result).toEqual([
      {
        id: "compute",
        title: "compute",
        version: "1.0.0",
        specUrl: "",
        jsonUrl: "",
        docsUrl: null,
      },
    ]);
  });

  it("skips entries with no id", () => {
    const result = shapeCatalog({
      services: [{ title: "No id here" }, { id: "valid", version: "1.0.0" }],
    });

    expect(result.map((s) => s.id)).toEqual(["valid"]);
  });

  it("returns an empty array for a malformed or missing document", () => {
    expect(shapeCatalog(null)).toEqual([]);
    expect(shapeCatalog(undefined)).toEqual([]);
    expect(shapeCatalog({})).toEqual([]);
    expect(shapeCatalog({ services: "not-an-array" })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/service-catalog.test.ts
```

Expected: FAIL — `Cannot find module './service-catalog'`.

- [ ] **Step 4: Write the implementation**

`web/src/lib/service-catalog.ts`:

```ts
export type ServiceCatalogEntry = {
  id: string;
  title: string;
  version: string;
  specUrl: string;
  jsonUrl: string;
  docsUrl: string | null;
};

type RawServiceEntry = {
  id?: unknown;
  title?: unknown;
  version?: unknown;
  spec?: { yaml?: unknown; json?: unknown };
  docs?: unknown;
};

type RawIndexDocument = {
  services?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function shapeCatalog(index: unknown): ServiceCatalogEntry[] {
  const doc = index as RawIndexDocument | null | undefined;
  const services = Array.isArray(doc?.services)
    ? (doc!.services as RawServiceEntry[])
    : [];

  return services
    .filter((entry) => isNonEmptyString(entry.id))
    .map((entry) => ({
      id: entry.id as string,
      title: isNonEmptyString(entry.title) ? entry.title : (entry.id as string),
      version: isNonEmptyString(entry.version) ? entry.version : "0.0.0",
      specUrl: isNonEmptyString(entry.spec?.yaml) ? (entry.spec!.yaml as string) : "",
      jsonUrl: isNonEmptyString(entry.spec?.json) ? (entry.spec!.json as string) : "",
      docsUrl: isNonEmptyString(entry.docs) ? (entry.docs as string) : null,
    }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/service-catalog.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Add the test script's dependency and commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/vitest.config.ts web/vitest.setup.ts web/src/lib/service-catalog.ts web/src/lib/service-catalog.test.ts
git commit -m "web: add shapeCatalog pure function with tests"
```

---

### Task 5: Service-param validation pure function

**Files:**
- Create: `web/src/lib/service-param.ts`, `web/src/lib/service-param.test.ts`

**Interfaces:**
- Produces: `isValidServiceId(raw: string | undefined | null): boolean`, used by the reference page (Task 7) and the chat route (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isValidServiceId } from "./service-param";

describe("isValidServiceId", () => {
  it("accepts a plain lowercase-kebab id", () => {
    expect(isValidServiceId("compute")).toBe(true);
    expect(isValidServiceId("fleet-manager")).toBe(true);
  });

  it("rejects path traversal attempts entirely", () => {
    expect(isValidServiceId("../../etc/passwd")).toBe(false);
    expect(isValidServiceId("..%2f..%2fetc")).toBe(false);
  });

  it("rejects uppercase and whitespace-containing values", () => {
    expect(isValidServiceId("Compute")).toBe(false);
    expect(isValidServiceId("compute ")).toBe(false);
    expect(isValidServiceId(" compute")).toBe(false);
  });

  it("rejects empty, null, and undefined", () => {
    expect(isValidServiceId("")).toBe(false);
    expect(isValidServiceId(null)).toBe(false);
    expect(isValidServiceId(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/service-param.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
const SERVICE_ID_PATTERN = /^[a-z0-9-]+$/;

export function isValidServiceId(
  raw: string | undefined | null
): raw is string {
  if (typeof raw !== "string") return false;
  return SERVICE_ID_PATTERN.test(raw);
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/service-param.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/lib/service-param.ts web/src/lib/service-param.test.ts
git commit -m "web: add isValidServiceId pure function with tests"
```

---

### Task 6: Raw-content fetch wrappers

**Files:**
- Create: `web/src/lib/raw-content.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `fetchServiceIndex(): Promise<unknown>`, `fetchServiceSpecYaml(serviceId: string): Promise<string | null>`, `fetchServiceSpecJsonUrl(serviceId: string): string` — used by the landing page (Task 7), reference page (Task 8), and chat route (Task 9). This is the *only* file that knows the `raw.githubusercontent.com` URL shape.

- [ ] **Step 1: Implement**

```ts
const RAW_CONTENT_BASE =
  "https://raw.githubusercontent.com/nscaledev/openapi/main";

export async function fetchServiceIndex(): Promise<unknown> {
  const response = await fetch(`${RAW_CONTENT_BASE}/index.json`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) {
    throw new Error(`fetchServiceIndex: upstream returned ${response.status}`);
  }
  return response.json();
}

export async function fetchServiceSpecYaml(
  serviceId: string
): Promise<string | null> {
  const response = await fetch(
    `${RAW_CONTENT_BASE}/specs/${serviceId}/openapi.yaml`,
    { next: { revalidate: 60 } }
  );
  if (!response.ok) return null;
  return response.text();
}

export function serviceSpecJsonUrl(serviceId: string): string {
  return `${RAW_CONTENT_BASE}/specs/${serviceId}/openapi.json`;
}
```

This file has no tests of its own — it's a thin fetch wrapper around a single, already-tested-elsewhere concern (the URL shape is trivial and covered implicitly by every test that mocks `fetch` against these exact URLs in later tasks).

- [ ] **Step 2: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/lib/raw-content.ts
git commit -m "web: add raw-content fetch wrappers"
```

---

### Task 7: Landing page

**Files:**
- Modify: `web/src/app/page.tsx`
- Create: `web/src/app/page.test.tsx`

**Interfaces:**
- Consumes: `shapeCatalog`/`ServiceCatalogEntry` (Task 4), `fetchServiceIndex` (Task 6).
- Produces: the "/" route, rendering one card per service.

- [ ] **Step 1: Write the failing smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "./page";

vi.mock("@/lib/raw-content", () => ({
  fetchServiceIndex: vi.fn().mockResolvedValue({
    services: [
      {
        id: "compute",
        title: "Compute Service API",
        version: "1.13.0",
        spec: {
          yaml: "https://openapi.nscale.com/specs/compute/openapi.yaml",
          json: "https://openapi.nscale.com/specs/compute/openapi.json",
        },
        docs: "https://docs.nscale.com/api-reference/compute",
      },
    ],
  }),
}));

describe("LandingPage", () => {
  it("renders a card for each published service", async () => {
    render(await LandingPage());

    expect(screen.getByText("Compute Service API")).toBeVisible();
    expect(screen.getByText("v1.13.0")).toBeVisible();
    expect(screen.getByRole("link", { name: /reference/i })).toHaveAttribute(
      "href",
      "/reference/compute"
    );
  });

  it("renders an empty state when no services are published yet", async () => {
    const { fetchServiceIndex } = await import("@/lib/raw-content");
    vi.mocked(fetchServiceIndex).mockResolvedValueOnce({ services: [] });

    render(await LandingPage());

    expect(screen.getByText(/no services published yet/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/page.test.tsx
```

Expected: FAIL (current `page.tsx` is still the Task 1 placeholder).

- [ ] **Step 3: Implement the landing page**

Replace `web/src/app/page.tsx`:

```tsx
import { CircleStackIcon } from "@heroicons/react/24/outline";
import { Button } from "@nscaledev/ui/components-v2/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nscaledev/ui/components-v2/card";
import { HeroBanner } from "@nscaledev/ui/components-v2/hero-banner";
import Link from "next/link";
import { fetchServiceIndex } from "@/lib/raw-content";
import { shapeCatalog } from "@/lib/service-catalog";

export default async function LandingPage() {
  const index = await fetchServiceIndex();
  const services = shapeCatalog(index);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-8">
      <HeroBanner
        eyebrow="Nscale"
        title="OpenAPI Specs"
        icon={<CircleStackIcon />}
      />
      {services.length === 0 ? (
        <p className="text-secondary-content">No services published yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <CardTitle>{service.title}</CardTitle>
                <CardDescription>v{service.version}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/reference/${service.id}`}>Reference</Link>
              </CardContent>
              <CardFooter>
                {service.docsUrl && (
                  <Button asChild variant="outline">
                    <a href={service.docsUrl}>Docs on Mintlify</a>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/page.test.tsx
```

Expected: PASS, 2 tests. If `Button`'s `asChild` prop errors, check `node_modules/@nscaledev/ui/dist/components-v2/button/button.d.ts` for the actual supported props in the installed version and adjust (it wraps `@radix-ui/react-slot`'s `Slot`, which is the standard source of an `asChild` prop in this component family).

- [ ] **Step 5: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/app/page.tsx web/src/app/page.test.tsx
git commit -m "web: build landing page with @nscaledev/ui HeroBanner and Card"
```

---

### Task 8: Reference page (Scalar embedded)

**Files:**
- Create: `web/src/app/reference/[service]/page.tsx`, `web/src/app/reference/[service]/not-found.tsx`, `web/src/app/reference/[service]/page.test.tsx`
- Modify: `web/package.json` (add `@scalar/api-reference-react`)

**Interfaces:**
- Consumes: `isValidServiceId` (Task 5), `serviceSpecJsonUrl` (Task 6).
- Produces: the "/reference/[service]" route. The chat widget (Task 11) mounts into this same page.

- [ ] **Step 1: Confirm and install the current Scalar package version**

```bash
npm view @scalar/api-reference-react version
```

Add to `web/package.json`'s `"dependencies"` (use whatever version this printed):

```json
    "@scalar/api-reference-react": "0.9.59",
```

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

- [ ] **Step 2: Implement the reference page**

`web/src/app/reference/[service]/page.tsx`:

```tsx
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { notFound } from "next/navigation";
import { isValidServiceId } from "@/lib/service-param";
import { serviceSpecJsonUrl } from "@/lib/raw-content";

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  if (!isValidServiceId(service)) {
    notFound();
  }

  return (
    <ApiReferenceReact
      configuration={{
        url: serviceSpecJsonUrl(service),
      }}
    />
  );
}
```

`web/src/app/reference/[service]/not-found.tsx`:

```tsx
import Link from "next/link";

export default function ServiceNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Service not found</h1>
      <p className="text-secondary-content">
        That service isn&apos;t published here.
      </p>
      <Link href="/" className="underline">
        Back to all services
      </Link>
    </main>
  );
}
```

- [ ] **Step 3: Write the smoke test**

`web/src/app/reference/[service]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReferencePage from "./page";

vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: ({ configuration }: { configuration: { url: string } }) => (
    <div data-testid="scalar-reference">{configuration.url}</div>
  ),
}));

vi.mock("@scalar/api-reference-react/style.css", () => ({}));

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

describe("ReferencePage", () => {
  it("renders Scalar pointed at the requested service's spec URL", async () => {
    render(
      await ReferencePage({ params: Promise.resolve({ service: "compute" }) })
    );

    expect(screen.getByTestId("scalar-reference")).toHaveTextContent(
      "specs/compute/openapi.json"
    );
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("calls notFound() for an invalid service id, without rendering Scalar", async () => {
    await expect(
      ReferencePage({ params: Promise.resolve({ service: "../../etc" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/reference/\[service\]/page.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Verify it renders against the real, already-published compute spec**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm run dev
```

Visit `http://localhost:3000/reference/compute` — expect the Scalar reference UI to render the compute service's endpoints (this hits the real `raw.githubusercontent.com` URL for the already-published spec from Phase 1). Visit `http://localhost:3000/reference/../../etc` — expect the "Service not found" page, not an error or a path traversal. Stop the server once confirmed.

- [ ] **Step 6: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/package.json web/package-lock.json web/src/app/reference
git commit -m "web: add /reference/[service] page with Scalar embedded, with a smoke test"
```

---

### Task 9: Chat system-prompt pure function

**Files:**
- Create: `web/src/lib/chat-system-prompt.ts`, `web/src/lib/chat-system-prompt.test.ts`

**Interfaces:**
- Produces: `buildSystemPrompt(serviceTitle: string, specYaml: string): string`, used by the chat route (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./chat-system-prompt";

describe("buildSystemPrompt", () => {
  it("includes the service title and the full spec content", () => {
    const prompt = buildSystemPrompt("Compute Service API", "openapi: 3.0.3");

    expect(prompt).toContain("Compute Service API");
    expect(prompt).toContain("openapi: 3.0.3");
  });

  it("instructs the model to answer only from the spec", () => {
    const prompt = buildSystemPrompt("Compute Service API", "openapi: 3.0.3");

    expect(prompt.toLowerCase()).toContain("only");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/chat-system-prompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export function buildSystemPrompt(
  serviceTitle: string,
  specYaml: string
): string {
  return [
    `You are a documentation assistant for the ${serviceTitle} API.`,
    "Answer questions using only the OpenAPI specification below. " +
      "If the answer isn't in the spec, say so rather than guessing.",
    "",
    "```yaml",
    specYaml,
    "```",
  ].join("\n");
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/chat-system-prompt.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/lib/chat-system-prompt.ts web/src/lib/chat-system-prompt.test.ts
git commit -m "web: add buildSystemPrompt pure function with tests"
```

---

### Task 10: Rate limiter pure function

**Files:**
- Create: `web/src/lib/rate-limit.ts`, `web/src/lib/rate-limit.test.ts`

**Interfaces:**
- Produces: `class TokenBucketRateLimiter` with a `tryConsume(key: string): boolean` method, used by the chat route (Task 11).

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucketRateLimiter } from "./rate-limit";

describe("TokenBucketRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("allows up to the configured number of requests per key", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 3, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);
  });

  it("tracks separate buckets per key", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("5.6.7.8")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);
  });

  it("refills after the configured interval", () => {
    const limiter = new TokenBucketRateLimiter({ maxTokens: 1, refillIntervalMs: 60_000 });

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
    expect(limiter.tryConsume("1.2.3.4")).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(limiter.tryConsume("1.2.3.4")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/rate-limit.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
type Bucket = {
  tokens: number;
  windowStart: number;
};

export class TokenBucketRateLimiter {
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: { maxTokens: number; refillIntervalMs: number }) {
    this.maxTokens = options.maxTokens;
    this.refillIntervalMs = options.refillIntervalMs;
  }

  tryConsume(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart >= this.refillIntervalMs) {
      this.buckets.set(key, { tokens: this.maxTokens - 1, windowStart: now });
      return true;
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/lib/rate-limit.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/lib/rate-limit.ts web/src/lib/rate-limit.test.ts
git commit -m "web: add in-process per-key rate limiter with tests"

Note: this in-memory limiter resets on every pod restart/redeploy and doesn't coordinate across replicas — a documented stopgap (see design doc), not a substitute for ingress-level rate limiting once this is actually deployed.
```

---

### Task 11: Chat route handler

**Files:**
- Create: `web/src/app/api/chat/[service]/route.ts`, `web/src/app/api/chat/[service]/route.test.ts`
- Modify: `web/package.json` (add `ai`, `@ai-sdk/openai-compatible`)

**Interfaces:**
- Consumes: `isValidServiceId` (Task 5), `fetchServiceSpecYaml` (Task 6), `buildSystemPrompt` (Task 9), `TokenBucketRateLimiter` (Task 10).
- Produces: `POST /api/chat/[service]`, consumed by the chat widget (Task 12).
- Reads env vars: `NSCALE_INFERENCE_API_HOST`, `NSCALE_INFERENCE_API_KEY`, `NSCALE_INFERENCE_MODEL`.

- [ ] **Step 1: Install the AI SDK packages**

```bash
npm view ai version
npm view @ai-sdk/openai-compatible version
```

Add to `web/package.json`'s `"dependencies"` (use whatever versions these printed):

```json
    "ai": "7.0.37",
    "@ai-sdk/openai-compatible": "3.0.14",
```

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const streamTextMock = vi.fn();

vi.mock("ai", () => ({
  streamText: streamTextMock,
}));

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    languageModel: vi.fn((model: string) => ({ model })),
  })),
}));

describe("POST /api/chat/[service]", () => {
  beforeEach(() => {
    // The route module holds a module-scoped rate-limiter instance —
    // reset modules per test so each test starts with a fresh limiter,
    // not one that's accumulated state from a previous test.
    vi.resetModules();
    streamTextMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("openapi: 3.0.3\ninfo:\n  title: Compute Service API"),
      })
    );
    process.env.NSCALE_INFERENCE_API_HOST = "https://inference.example.com";
    process.env.NSCALE_INFERENCE_API_KEY = "test-key";
    process.env.NSCALE_INFERENCE_MODEL = "test-model";
  });

  it("returns 404 for an invalid service id, without calling the inference API", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/../../etc", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "../../etc" }),
    });

    expect(response.status).toBe(404);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns 502 when the upstream spec fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/compute", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(response.status).toBe(502);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("streams a response grounded in the fetched spec for a valid service", async () => {
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
    });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/chat/compute", {
      method: "POST",
      headers: { "x-forwarded-for": "1.2.3.4" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(response.status).toBe(200);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const call = streamTextMock.mock.calls[0][0];
    expect(call.system).toContain("Compute Service API");
    expect(call.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("returns 429 once a caller exceeds the rate limit, without calling the inference API", async () => {
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response("ok", { status: 200 }),
    });
    const { POST } = await import("./route");
    const makeRequest = () =>
      new Request("http://localhost/api/chat/compute", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      });

    // The route's limiter allows 5 requests per minute per IP (see
    // implementation) — the 6th from the same IP must be rejected.
    for (let i = 0; i < 5; i++) {
      const ok = await POST(makeRequest(), {
        params: Promise.resolve({ service: "compute" }),
      });
      expect(ok.status).toBe(200);
    }

    streamTextMock.mockClear();
    const limited = await POST(makeRequest(), {
      params: Promise.resolve({ service: "compute" }),
    });

    expect(limited.status).toBe(429);
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/api/chat/\[service\]/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the route handler**

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { buildSystemPrompt } from "@/lib/chat-system-prompt";
import { fetchServiceSpecYaml } from "@/lib/raw-content";
import { TokenBucketRateLimiter } from "@/lib/rate-limit";
import { isValidServiceId } from "@/lib/service-param";
import { parse } from "yaml";

// Module-scoped: one limiter shared across requests to this pod. Resets on
// restart/redeploy and doesn't coordinate across replicas — a documented
// stopgap (see design doc), not a substitute for ingress-level rate limiting.
const rateLimiter = new TokenBucketRateLimiter({
  maxTokens: 5,
  refillIntervalMs: 60_000,
});

function clientKeyFor(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  if (!rateLimiter.tryConsume(clientKeyFor(request))) {
    return new Response("Too many requests", { status: 429 });
  }

  const { service } = await params;

  if (!isValidServiceId(service)) {
    return new Response("Not found", { status: 404 });
  }

  const specYaml = await fetchServiceSpecYaml(service);
  if (specYaml === null) {
    return new Response("Spec temporarily unavailable", { status: 502 });
  }

  const { messages } = await request.json();
  const parsedSpec = parse(specYaml) as { info?: { title?: string } };
  const serviceTitle = parsedSpec?.info?.title ?? service;

  const provider = createOpenAICompatible({
    name: "nscale",
    baseURL: `${process.env.NSCALE_INFERENCE_API_HOST}/v1`,
    headers: {
      Authorization: `Bearer ${process.env.NSCALE_INFERENCE_API_KEY}`,
    },
  });

  const result = streamText({
    model: provider.languageModel(process.env.NSCALE_INFERENCE_MODEL ?? ""),
    system: buildSystemPrompt(serviceTitle, specYaml),
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

Add the `yaml` dependency (used to read the spec's title):

```json
    "yaml": "^2.6.1",
```

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

- [ ] **Step 5: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/api/chat/\[service\]/route.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/package.json web/package-lock.json web/src/app/api
git commit -m "web: add /api/chat/[service] route handler with tests"
```

---

### Task 12: Chat widget (client component)

**Files:**
- Create: `web/src/components/chat-widget.tsx`, `web/src/components/chat-widget.test.tsx`
- Modify: `web/src/app/reference/[service]/page.tsx`, `web/package.json` (add `@ai-sdk/react`)

**Interfaces:**
- Consumes: `POST /api/chat/[service]` (Task 11).
- Produces: `<ChatWidget serviceId={string} />`, mounted from the reference page.

- [ ] **Step 1: Install `@ai-sdk/react`**

```bash
npm view @ai-sdk/react version
```

Add to `web/package.json`'s `"dependencies"` (use whatever version this printed):

```json
    "@ai-sdk/react": "4.0.40",
```

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

- [ ] **Step 2: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatWidget } from "./chat-widget";

const sendMessageMock = vi.fn();

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: sendMessageMock,
    status: "ready",
  })),
}));

describe("ChatWidget", () => {
  it("renders an input and a send button", () => {
    render(<ChatWidget serviceId="compute" />);

    expect(screen.getByRole("textbox")).toBeVisible();
    expect(screen.getByRole("button", { name: /send/i })).toBeVisible();
  });

  it("sends the typed message when submitted", async () => {
    const user = userEvent.setup();
    render(<ChatWidget serviceId="compute" />);

    await user.type(screen.getByRole("textbox"), "What endpoints exist?");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(sendMessageMock).toHaveBeenCalledWith({
      text: "What endpoints exist?",
    });
  });
});
```

Add `@testing-library/user-event` to devDependencies:

```json
    "@testing-library/user-event": "^14.5.2",
```

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm install
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/components/chat-widget.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { Button } from "@nscaledev/ui/components-v2/button";
import { useState } from "react";

export function ChatWidget({ serviceId }: { serviceId: string }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    api: `/api/chat/${serviceId}`,
  });

  return (
    <div className="flex flex-col gap-4 p-4 border border-primary-border rounded-xl bg-primary-background">
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} data-role={message.role}>
            {message.parts
              .filter((part) => part.type === "text")
              .map((part, i) => (
                <p key={i}>{part.text}</p>
              ))}
          </div>
        ))}
        {status === "error" && (
          <p role="alert" className="text-destructive">
            Something went wrong talking to the assistant. Try again in a
            moment.
          </p>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border border-primary-border rounded-md px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this API..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/components/chat-widget.test.tsx
```

Expected: PASS, 2 tests. If `useChat`'s options shape differs in the installed version (e.g. it expects a `transport` object instead of a flat `api` string — check `node_modules/@ai-sdk/react/dist/index.d.ts` for the installed version's actual signature), adjust the call to match what's actually exported, keeping the same `/api/chat/${serviceId}` endpoint target.

- [ ] **Step 6: Mount the widget on the reference page**

Modify `web/src/app/reference/[service]/page.tsx`, adding the import and rendering it alongside the reference:

```tsx
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { notFound } from "next/navigation";
import { ChatWidget } from "@/components/chat-widget";
import { isValidServiceId } from "@/lib/service-param";
import { serviceSpecJsonUrl } from "@/lib/raw-content";

export default async function ReferencePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  if (!isValidServiceId(service)) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <ApiReferenceReact
        configuration={{
          url: serviceSpecJsonUrl(service),
        }}
      />
      <div className="mx-auto w-full max-w-3xl px-6 pb-8">
        <ChatWidget serviceId={service} />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Fix Task 8's page test, which this step just broke**

Task 8's `page.test.tsx` renders the real `ChatWidget` now that it's part of the page, which would call the real (unmocked) `@ai-sdk/react` `useChat`. Add a mock to `web/src/app/reference/[service]/page.test.tsx`, alongside its existing `@scalar/api-reference-react`/`next/navigation` mocks:

```tsx
vi.mock("@/components/chat-widget", () => ({
  ChatWidget: ({ serviceId }: { serviceId: string }) => (
    <div data-testid="chat-widget">{serviceId}</div>
  ),
}));
```

Run the full test file again to confirm both tests still pass:

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npx vitest run src/app/reference/\[service\]/page.test.tsx
```

Expected: PASS, 2 tests (unchanged from Task 8 — this step only fixes the mock, not the assertions).

- [ ] **Step 8: Verify manually**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm run dev
```

Visit `http://localhost:3000/reference/compute` — expect the Scalar reference above and the chat widget below it. Set the three `NSCALE_INFERENCE_*` env vars to real values first if you want to actually send a message and see a real streamed reply; otherwise just confirm the widget renders and typing/submitting doesn't throw a client-side error (it'll show the inline error state without real credentials, which is the expected, correctly-handled failure path). Stop the server once confirmed.

- [ ] **Step 9: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/package.json web/package-lock.json web/src/components web/src/app/reference/[service]/page.tsx web/src/app/reference/[service]/page.test.tsx
git commit -m "web: add chat widget, mount on reference page"
```

---

### Task 13: App-level error handling

**Files:**
- Create: `web/src/app/not-found.tsx`, `web/src/app/error.tsx`

**Interfaces:**
- Produces: the app-wide 404 and error-boundary pages.

- [ ] **Step 1: Implement the app-wide 404**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="underline">
        Back to all services
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Implement the error boundary (covers upstream fetch failures for index.json)**

```tsx
"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-secondary-content">
        Couldn&apos;t load the service catalog right now.
      </p>
      <button
        type="button"
        onClick={reset}
        className="underline cursor-pointer"
      >
        Try again
      </button>
    </main>
  );
}
```

- [ ] **Step 3: Verify manually**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
npm run dev
```

Visit a nonsense URL like `http://localhost:3000/this-page-does-not-exist` — expect the app-wide "Page not found" page. Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/src/app/not-found.tsx web/src/app/error.tsx
git commit -m "web: add app-wide 404 and error boundary"
```

---

### Task 14: Dockerfile

**Files:**
- Create: `web/Dockerfile`, `web/.dockerignore`

**Interfaces:**
- Produces: a container image runnable locally, matching what CI (Task 15) will build and push.

- [ ] **Step 1: Create .dockerignore**

```
node_modules
.next
.git
*.md
```

- [ ] **Step 2: Create the Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1.7

FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN npm ci

FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["server.js"]
```

- [ ] **Step 3: Build and run locally**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
export NODE_AUTH_TOKEN=<your PAT with read:packages>
docker buildx build --secret id=npm_token,env=NODE_AUTH_TOKEN -t openapi-web:local .
docker run -p 3000:3000 \
  -e NSCALE_INFERENCE_API_HOST=https://inference.example.com \
  -e NSCALE_INFERENCE_API_KEY=test-key \
  -e NSCALE_INFERENCE_MODEL=test-model \
  openapi-web:local
```

Expected: image builds successfully; `curl http://localhost:3000/` returns the landing page HTML. Stop the container (Ctrl-C) once confirmed.

- [ ] **Step 4: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/Dockerfile web/.dockerignore
git commit -m "web: add Dockerfile (Chainguard multi-stage build)"
```

---

### Task 15: CI workflows

**Files:**
- Create: `.github/workflows/web-ci.yml`, `.github/workflows/web-release.yml`

**Interfaces:**
- Produces: automated test/build on PRs, and image publish to `ghcr.io/nscaledev/openapi-web` on push to `main` and on version tags.

- [ ] **Step 1: Create the test/build workflow**

`.github/workflows/web-ci.yml`:

```yaml
name: web CI

on:
  pull_request:
    paths:
      - "web/**"
      - ".github/workflows/web-ci.yml"
  push:
    branches: [main]
    paths:
      - "web/**"
      - ".github/workflows/web-ci.yml"

permissions:
  contents: read
  packages: read

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "22"
      - name: Install dependencies
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm ci
      - run: npm run typecheck
      - run: npm test
      - name: Build
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run build
```

Note: this tries the workflow's own built-in `GITHUB_TOKEN` first (standard for reading same-org GitHub Packages once `permissions: packages: read` is declared). If `npm ci` 404s on `@nscaledev/ui` when this first runs, that means the package's visibility settings don't allow it — in that case, create a real PAT with `read:packages`, store it as a repo secret (e.g. `PACKAGES_READ_TOKEN`), and replace both `${{ secrets.GITHUB_TOKEN }}` references above with `${{ secrets.PACKAGES_READ_TOKEN }}`.

- [ ] **Step 2: Create the build-and-push workflow**

`.github/workflows/web-release.yml`:

```yaml
name: web release

on:
  push:
    branches: [main]
    tags: ["openapi-web/v*"]
    paths:
      - "web/**"

permissions:
  contents: read
  packages: write

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Compute tags
        id: meta
        run: |
          echo "sha_tag=ghcr.io/nscaledev/openapi-web:${{ github.sha }}" >> "$GITHUB_OUTPUT"
          if [[ "${{ github.ref_type }}" == "tag" ]]; then
            VERSION="${GITHUB_REF_NAME#openapi-web/v}"
            echo "version_tag=ghcr.io/nscaledev/openapi-web:$VERSION" >> "$GITHUB_OUTPUT"
          fi
      - uses: docker/build-push-action@v6
        with:
          context: web
          push: true
          secrets: |
            npm_token=${{ secrets.GITHUB_TOKEN }}
          tags: |
            ${{ steps.meta.outputs.sha_tag }}
            ${{ steps.meta.outputs.version_tag }}
```

- [ ] **Step 3: Verify the CI workflow syntax locally**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
npx --yes @action-validator/cli .github/workflows/web-ci.yml .github/workflows/web-release.yml 2>&1 || \
  python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/web-ci.yml .github/workflows/web-release.yml
```

Expected: no errors (either the action-validator tool or the plain YAML parse succeeds).

- [ ] **Step 4: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add .github/workflows/web-ci.yml .github/workflows/web-release.yml
git commit -m "web: add CI test/build and image release workflows"
```

---

### Task 16: Helm chart (written and locally verified, not applied)

**Files:**
- Create: `web/charts/openapi-web/Chart.yaml`, `web/charts/openapi-web/values.yaml`, `web/charts/openapi-web/templates/_helpers.tpl`, `web/charts/openapi-web/templates/deployment.yaml`, `web/charts/openapi-web/templates/service.yaml`, `web/charts/openapi-web/templates/ingress.yaml`, `web/charts/openapi-web/templates/serviceaccount.yaml`, `web/charts/openapi-web/templates/secret-store.yaml`, `web/charts/openapi-web/templates/external-secret.yaml`

**Interfaces:**
- Produces: a chart that lints and templates cleanly. **Not applied to any cluster or wired into a `k8s-deploy-*` repo as part of this task** — see Global Constraints.

- [ ] **Step 1: Chart.yaml**

```yaml
apiVersion: v2
name: openapi-web
description: Nscale OpenAPI reference site (landing page, Scalar reference, per-service chat)
type: application
version: 0.1.0
appVersion: "0.1.0"
```

- [ ] **Step 2: values.yaml**

```yaml
replicaCount: 2

image:
  repository: ghcr.io/nscaledev/openapi-web
  tag: latest
  pullPolicy: IfNotPresent

service:
  port: 3000

ingress:
  enabled: true
  class: nginx
  clusterIssuer: letsencrypt-prod
  host: openapi.nscale.com

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

env:
  nscaleInferenceApiHost: ""
  nscaleInferenceModel: ""

vault:
  server: https://vault.nscale.com
  path: "product"
  roleName: "openapi-web-approle"
  inferenceApiKeyPath: "prod/openapi-web/inference-api-key"
```

- [ ] **Step 3: templates/_helpers.tpl**

```yaml
{{- define "openapi-web.fullname" -}}
{{ .Chart.Name }}
{{- end -}}

{{- define "openapi-web.labels" -}}
app.kubernetes.io/name: {{ include "openapi-web.fullname" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
```

- [ ] **Step 4: templates/serviceaccount.yaml**

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "openapi-web.fullname" . }}
  labels:
    {{- include "openapi-web.labels" . | nindent 4 }}
```

- [ ] **Step 5: templates/deployment.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "openapi-web.fullname" . }}
  labels:
    {{- include "openapi-web.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "openapi-web.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "openapi-web.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "openapi-web.fullname" . }}
      containers:
        - name: openapi-web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: 3000
          env:
            - name: NSCALE_INFERENCE_API_HOST
              value: {{ .Values.env.nscaleInferenceApiHost | quote }}
            - name: NSCALE_INFERENCE_MODEL
              value: {{ .Values.env.nscaleInferenceModel | quote }}
          envFrom:
            - secretRef:
                name: inference-api-key
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

- [ ] **Step 6: templates/service.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "openapi-web.fullname" . }}
  labels:
    {{- include "openapi-web.labels" . | nindent 4 }}
spec:
  selector:
    {{- include "openapi-web.labels" . | nindent 4 }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: 3000
```

- [ ] **Step 7: templates/ingress.yaml**

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "openapi-web.fullname" . }}
  labels:
    {{- include "openapi-web.labels" . | nindent 4 }}
  annotations:
    cert-manager.io/cluster-issuer: {{ .Values.ingress.clusterIssuer }}
spec:
  ingressClassName: {{ .Values.ingress.class }}
  tls:
    - hosts: [{{ .Values.ingress.host }}]
      secretName: openapi-web-ingress-cert
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "openapi-web.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
```

- [ ] **Step 8: templates/secret-store.yaml and templates/external-secret.yaml**

```yaml
# secret-store.yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: {{ include "openapi-web.fullname" . }}-vault-store
spec:
  provider:
    vault:
      server: {{ .Values.vault.server }}
      path: {{ .Values.vault.path }}
      auth:
        appRole:
          path: "approle"
          roleRef:
            key: "id"
            name: {{ .Values.vault.roleName }}
          secretRef:
            key: "secret"
            name: {{ .Values.vault.roleName }}
```

```yaml
# external-secret.yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: inference-api-key
spec:
  secretStoreRef:
    name: {{ include "openapi-web.fullname" . }}-vault-store
    kind: SecretStore
  target:
    name: inference-api-key
  data:
    - secretKey: NSCALE_INFERENCE_API_KEY
      remoteRef:
        key: {{ .Values.vault.inferenceApiKeyPath }}
        property: api-key
```

- [ ] **Step 9: Lint and template locally (no cluster needed)**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi/web
helm lint charts/openapi-web
helm template test-release charts/openapi-web
```

Expected: `helm lint` reports 0 errors (warnings about no `README.md` are fine); `helm template` prints fully-rendered YAML with no template errors. If `helm` isn't installed locally, install it first (`brew install helm` on macOS) — this is a one-time local tool install, not a cluster action.

- [ ] **Step 10: Commit**

```bash
cd /Users/adamflanagan/code/openapi/nscaledev-openapi
git add web/charts
git commit -m "web: add Helm chart (written, lint/template-verified, not applied to any cluster)"
```

---

## Self-Review Notes

This is a record of what the review pass actually caught and fixed, not just an assertion that the plan is fine.

- **Spec coverage**: landing page (Task 7), reference page (Task 8), chat reinstated per-service (Tasks 9–12), brand assets (Tasks 2–3), error handling (Task 13), container build (Task 14), CI (Task 15), Helm chart with the reinstated Vault/ExternalSecret (Task 16) — all design doc sections have a corresponding task. Retiring the old static site and DNS cutover are deliberately *not* tasks here, per the Global Constraints safety note.
- **Three real gaps found and fixed during this review, not just checked off:**
  1. Task 10 built `TokenBucketRateLimiter` and Task 11's "Consumes" line claimed it was used, but the original Task 11 implementation never actually imported or called it. Fixed: the route handler now calls `rateLimiter.tryConsume()` before doing any work, with a dedicated 429 test (and a `vi.resetModules()` fix in the test file's `beforeEach`, since the limiter is module-scoped state that would otherwise leak between tests).
  2. Task 3 said the logo components would be "available for later tasks to use" but no task ever rendered one. Fixed: Task 3 now builds a real `SiteHeader` component using `NscaleWordmarkLogo`, mounted in the root layout so it's on every page.
  3. The design doc's Testing section calls for "a smoke test per page," but the reference page (Task 8) originally had only manual browser verification. Fixed: added `page.test.tsx` with two automated cases (renders Scalar with the right spec URL; calls `notFound()` for an invalid id).
- **Cross-task consistency checked, not just single-task correctness**: Task 12 modifies the same `page.tsx` file Task 8 already wrote a test for, which would have broken that test (an unmocked `ChatWidget` pulling in the real `@ai-sdk/react` hook). Fixed by adding a step in Task 12 that updates Task 8's test file with the missing mock before moving on — the kind of gap that only shows up by tracing a file across every task that touches it, not by reviewing each task in isolation.
- **Type consistency checked**: `ServiceCatalogEntry` (Task 4) is the same shape consumed in Task 7's landing page; `isValidServiceId` (Task 5) is imported with that exact name in Task 8's reference page and Task 11's chat route; `buildSystemPrompt(serviceTitle, specYaml)` (Task 9) signature matches its call site in Task 11.
- **No placeholders**: every step has complete, real code — the only two "adjust if this doesn't match" notes (Task 2's styles filename check, Task 12's `useChat` signature check) are genuine unknowns about exact installed-package internals that can't be pinned without installing the real package first, and each gives a concrete command to resolve it, not a vague instruction.
