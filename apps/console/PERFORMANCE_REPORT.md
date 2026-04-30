# apps/console — Performance & Hardening Report

**Mission**: Transform `apps/console` into a fast, resilient, clean, scalable, secure, and premium internal operating platform — preserving all existing business logic and avoiding flashy consumer UI.

**Method**: Read-only structural audit of the entire app (151 routes, layout, middleware, lib, components, configs, security headers, dependencies) followed by surgical fixes only where ROI is unambiguous.

---

## 1. Audit Findings — Summary

| Area | Finding | Action |
|---|---|---|
| Dynamic rendering | 138 / 151 pages use `force-dynamic`. **All justified** — every audited file calls `auth()`, hits Drizzle, or reads cookies/headers. | **No change.** Converting any of these to ISR/static would break tenancy, auth, or data freshness. |
| Loading states | 0 `loading.tsx` files | **Added** dashboard root `loading.tsx` — calm skeleton with `aria-busy` and `motion-safe:animate-pulse`. |
| Error boundaries | 1 `error.tsx` (dashboard root, basic) | **Polished** root + **added** section boundaries for `intelligence/`, `itsm/`, `business/`. Each logs to `console.error` for RUM ingestion and surfaces `error.digest` for support tickets. |
| Not-found pages | 0 `not-found.tsx` files | **Added** in-shell dashboard `not-found.tsx`. |
| Per-request data dedupe | Dashboard tiles call `getExecutiveOrgId()` 5–10× per render — 5–10 identical DB roundtrips | **Wrapped** in React `cache()`. One DB call per request, regardless of caller count. |
| Navigation config | 150-line inline `navGroups` array hard-coded inside `layout.tsx` (untyped, untestable, no role/feature-flag gating) | **Extracted** to typed `lib/nav-config.ts` with `NavItemConfig` (optional `requiredRoles`, `featureFlag`), exported `filterNav()` helper, and added contract test that proves every href resolves to a real route segment. |
| Bundle / heavy libs | No moment.js, no lodash, no chart libs >100kb. ~40 Heroicons used. | **No change** — already lean. |
| Virtualization | Largest known table (`/itsm/queue`) is bounded at <500 rows by SQL pagination | **No change** — virtualization would add dependency cost with zero perceptible gain. |
| CSP | `unsafe-eval` permitted in `script-src` | **No change** — flagged for security review. Hardening this requires removing inline-eval dependencies (next.js dev mode, possibly framer-motion); not in scope for a non-breaking PR. |
| Tests | Only 4 lib unit tests in console; coverage gap is real | **Out of scope** for surgical mission. New nav-config contract test (55 cases) is the only test added. |
| Edge crypto risk | `proxy.ts` previously crashed in ACA when auth was imported into edge middleware | **Already mitigated** — middleware contains only request-id, i18n, rate-limit, idempotency, cost-budget, egress allowlist. Auth gate is delegated to RSC layout (Node.js runtime). |

---

## 2. Changes Applied

### `apps/console/lib/executive-os.ts`
- Added `import { cache } from 'react'`.
- Wrapped exported `getExecutiveOrgId` with React `cache()`.
- **Net effect**: dashboard render drops 4–9 redundant DB roundtrips per request.

### `apps/console/lib/nav-config.ts` (new)
- Single source of truth for sidebar navigation.
- Strongly typed: `NavItemConfig`, `NavGroupConfig`, `AppLinkConfig`.
- Optional `requiredRoles` and `featureFlag` per item; `filterNav()` helper enforces both at the call site.
- Empty groups are dropped after filtering so the layout never renders an empty header.

### `apps/console/app/(dashboard)/layout.tsx`
- Removed inline 150-line `navGroups` and `appLinks` literals.
- Now imports both from `@/lib/nav-config`.
- All other behavior preserved verbatim: auth gate, Node runtime, `force-dynamic`, sidebar JSX, app launcher, executive mode wrapper, `CommandSectionGuide`.

### `apps/console/app/(dashboard)/loading.tsx` (new)
- Server-component skeleton: title row, 4-card KPI strip, 6-row main panel.
- `aria-busy="true"`, `aria-live="polite"`, `motion-safe:animate-pulse`, `<span class="sr-only">Loading…</span>`.

### `apps/console/app/(dashboard)/not-found.tsx` (new)
- In-shell 404 (sidebar still visible).
- Two recovery actions: return to `/console`, open `/today`.

### `apps/console/app/(dashboard)/error.tsx` (rewritten)
- `useEffect` logs `{ message, digest }` to `console.error` under `[console:dashboard:error]` for RUM/Sentry sinks.
- `Forbidden:` errors → calm amber RBAC panel.
- All other errors → red panel with `reset()` button and copy-on-click `error.digest` reference.

### Section-level error boundaries (new)
- `app/(dashboard)/intelligence/error.tsx`
- `app/(dashboard)/itsm/error.tsx`
- `app/(dashboard)/business/error.tsx`
- All client components, all log to `console.error` with namespaced tags, all preserve the dashboard shell on failure.

### `tooling/contract-tests/console-nav-config.test.ts` (new)
- 55 test cases — 1 per nav item plus 3 invariant checks.
- Asserts: every group non-empty, no duplicate hrefs, every href resolves to a real route segment under `apps/console/app/(dashboard)/`.
- Catches dead links the moment a route is renamed but the nav config is forgotten.

---

## 3. What Was Deliberately NOT Changed

| Concern | Reason |
|---|---|
| `force-dynamic` directives | Every one is justified by tenancy, cookies, or fresh data. ISR/static would silently break auth or leak across orgs. |
| CSP `unsafe-eval` | Removing it requires dev-mode and animation-lib changes outside surgical scope. Flagged for separate security PR. |
| `executive-intelligence.ts` private duplicate of `getExecutiveOrgId` (line 324) | Duplicate is a minor smell, used in 2 call sites in the same module. Refactoring it now would touch a 1k-line file with zero behavior change. Recommended follow-up. |
| Test coverage expansion | Out of scope. Only added the one contract test that protects the change actually made. |
| Visual restyling | Mission explicitly forbids "flashy consumer UI". Skeletons and error panels are calm and consistent with existing patterns. |
| Role-aware nav rendering | Helper added (`filterNav`) but not wired — wiring requires deciding the role-grant source (Entra groups vs. `organization_members`), which is a product decision, not a perf one. |

---

## 4. Recommended Follow-Ups (separate PRs)

1. **Wire `filterNav()`** — once role grants live behind a stable resolver, pass them at the top of the layout: `const visible = filterNav(navGroups, { roles })`.
2. **Section loading skeletons** — apply the `loading.tsx` pattern to `/intelligence`, `/board`, `/business/finance`, `/itsm/queue` (the slowest-feeling routes).
3. **Section `not-found.tsx`** — for `/itsm/tickets/[id]`, `/orgs/[id]`, etc. so deep-link 404s render in shell.
4. **Reasoning context `error.tsx`** — when an upstream model surface fails inside `/intelligence`, prefer a section boundary over a top-level one.
5. **CSP hardening review** — separate security ticket to remove `unsafe-eval`.
6. **Refactor `executive-intelligence.ts`** — delete the private `getExecutiveOrgId`, import the cached public one from `executive-os.ts`.
7. **Test coverage** — broader unit/integration coverage for `lib/` modules (`executive-os`, `executive-intelligence`, `cost-budget`, `idempotency`).

---

## 5. Verification

| Check | Command | Result |
|---|---|---|
| TypeScript | `pnpm --filter @nzila/console typecheck` | **PASS** (no errors) |
| Contract tests (governance + console nav) | `npx vitest run tooling/contract-tests/{console-nav-config,ai-inventory-integrity,ai-reasoning-envelope,data-inventory-integrity}.test.ts` | **119 / 119 PASS** |

No regressions detected. All acceptance criteria from the mission preserved:
- Workflows unchanged (auth, render flow, sidebar, app launcher all behave identically).
- No functionality removed.
- No sensitive data cached beyond per-request scope (`React.cache` is per-request only).
- Secure routes unaffected (Node-runtime auth gate intact).
- No flashy consumer UI introduced.
- No Lighthouse-only optimizations.
