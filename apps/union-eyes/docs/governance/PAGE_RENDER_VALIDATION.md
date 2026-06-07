# UnionEyes — Page Render Validation Report

**Scope:** Pilot-critical dashboard pages + public auth/marketing surfaces  
**Method:** Static code-level analysis (no runtime execution)  
**Analyst:** GitHub Copilot CLI  
**Date:** 2025-07-21  

---

## Table of Contents

1. [Validation Criteria](#validation-criteria)  
2. [Shared Infrastructure Assessment](#shared-infrastructure-assessment)  
3. [Page-by-Page Validations](#page-by-page-validations)  
4. [Pilot-Critical Summary Table](#pilot-critical-summary-table)  
5. [Issues by Severity](#issues-by-severity)  
6. [Test Coverage Gaps](#test-coverage-gaps)  

---

## Validation Criteria

Each page is assessed against eight render-quality dimensions:

| # | Criterion | What it checks |
|---|---|---|
| **C1** | **Data Fetch** | Does the page fetch real data (server query / SWR / useEffect+API)? |
| **C2** | **Title / Header** | Is a page title or `<h1>` rendered with i18n or real content (not a stub)? |
| **C3** | **Empty State** | Is a meaningful empty/zero-result state handled in UI? |
| **C4** | **Loading State** | Is a loading skeleton/spinner/Suspense fallback present? |
| **C5** | **Error Handling** | Is an error state rendered when the data fetch fails? |
| **C6** | **No Fake Data** | Is no hardcoded Lorem ipsum / placeholder user / stub array present at render time? |
| **C7** | **Role Gate** | Is access restricted to the correct minimum role, enforced **server-side**? |
| **C8** | **Production-Ready** | Are there no TODO comments, debug logs, or un-guarded dev-only renders? |

Legend for all tables:  
✅ Pass · ⚠️ Warn (present but weaker than ideal) · ❌ Fail · N/A Not applicable · ? Delegated to child component (assumed present unless noted)

---

## Shared Infrastructure Assessment

### `app/[locale]/dashboard/layout.tsx`

The dashboard layout is the first line of defence for every page under `/dashboard`.

| Concern | Finding |
|---|---|
| Auth guard | `requireUser()` called at the top of `DashboardLayout`; unauthenticated requests redirected before any render |
| Profile auto-create | Calls `getOrCreateUserProfile()` on every request — production-grade, no stub logic |
| Org membership sync | Auto-provisions `platform_org_members` row if missing — idempotent, real DB write |
| Role resolution | Resolves role from DB, stores in context passed to `RoleExperienceGuard` |
| QC bilingual compliance | Fetches org province, conditionally renders `QcBilingualBanner` (Bill 96/Law 25) |
| Sidebar | Rendered for all authenticated dashboard pages |
| Onboarding | `OnboardingProvider` wraps children — real onboarding flow, not stub |
| Assessment | **PASS** — robust shared auth foundation |

### `app/[locale]/dashboard/error.tsx`

- **Sentry integration**: `captureException(error)` called on every boundary trigger
- **Reference ID**: `Sentry.lastEventId()` surfaced in the UI for support correlation
- **Dev detail**: `process.env.NODE_ENV === 'development'` guard around raw error display
- **Actions**: Retry button + Home link
- Assessment: **PASS** — production-grade boundary

### `app/api/health/liveness/route.ts`

- Returns `{ status: 'ok', timestamp, uptime }` with proper `Cache-Control: no-store, max-age=0` headers
- No authentication required (correct — liveness probes must always be reachable)
- Assessment: **PASS**

---

## Page-by-Page Validations

---

### `/dashboard` (root redirect page)

**File:** `app/[locale]/dashboard/page.tsx`  
**Pattern:** Server Component · redirect-only

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| N/A | N/A | N/A | N/A | ✅ | ✅ | ✅ | ✅ |

**Notes:**  
- Resolves user → org → role, then `redirect()` to the role's landing path
- `try/catch` around every async step with `logger.error`
- No UI rendered; serves purely as a role-aware entry gate
- **Assessment: PASS**

---

### `/dashboard/grievances` (list page)

**File:** `app/[locale]/dashboard/grievances/page.tsx` — **DOES NOT EXIST**

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ |

**Notes:**  
- The `grievances/` directory contains only `[id]/page.tsx`; the list/index route is entirely absent
- Navigating to `/dashboard/grievances` will produce a Next.js 404
- **Assessment: NOT_FOUND — P1 missing route**

---

### `/dashboard/grievances/[id]` (detail page)

**File:** `app/[locale]/dashboard/grievances/[id]/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ? | ? | ? | ? | ? | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('steward')` enforced server-side; non-steward users redirected to `/dashboard`
- Data fetch, loading, empty, and error states are **delegated to `<GrievanceDetailConsole />`** — not validated here but assumed implemented by the component contract
- i18n metadata via `getTranslations('grievancePage')`
- **Assessment: PASS (page frame) — component integration assumed**

---

### `/dashboard/cases` (list page)

**File:** `app/[locale]/dashboard/cases/page.tsx` — **DOES NOT EXIST**

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ |

**Notes:**  
- The `cases/` directory contains only `[id]/page.tsx`; the list/index route is absent
- Navigating to `/dashboard/cases` will produce a Next.js 404
- **Assessment: NOT_FOUND — P1 missing route**

---

### `/dashboard/cases/[id]` (detail page)

**File:** `app/[locale]/dashboard/cases/[id]/page.tsx`  
**Pattern:** Client Component (`"use client"`)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |

**Notes:**  
- `useEffect` → `api.cases.get(caseId)` on mount; non-critical fields (timeline, evidence) loaded in parallel without blocking render
- `setLoading(true/false)` pattern; `setError(msg)` renders an error UI when the primary fetch fails
- `useHasPermission(Permission.EDIT_ALL_CLAIMS)` gates edit controls — **client-side only**
- Dashboard layout provides authentication, but there is **no server-side role gate** at the page level; an authenticated member with insufficient role sees the UI shell and only fails on API calls
- **Assessment: WARN — C7 weak (client-side RBAC only)**

---

### `/dashboard/claims` (list page)

**File:** `app/[locale]/dashboard/claims/page.tsx` — **DOES NOT EXIST**

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ |

**Notes:**  
- The `claims/` directory contains only `new/page.tsx`; the list/index route is absent
- Navigating to `/dashboard/claims` will produce a Next.js 404
- **Assessment: NOT_FOUND — P1 missing route**

---

### `/dashboard/claims/new` (new claim form)

**File:** `app/[locale]/dashboard/claims/new/page.tsx`  
**Pattern:** Client Component (`"use client"`)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | N/A | ✅ | ✅ | ✅ | ⚠️ | ✅ |

**Notes:**  
- `useUser()` verifies a session exists client-side; form submits to API which does server-side validation
- `submitting` boolean disables submit button and shows feedback during API call
- Voice recording with `MediaRecorder` API is a real implementation (not stub)
- **No server-side role guard at page level** — any authenticated user can access the form; the API must be the final gate
- **Assessment: WARN — C7 weak (no server page-level role gate)**

---

### `/dashboard/members` (list page)

**File:** `app/[locale]/dashboard/members/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ? | ? | ? | ? | ? | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('steward')` enforced server-side; non-steward redirected to `/dashboard`
- Delegates to `<MembersConsole />` — data, loading, empty, error states assumed implemented
- i18n metadata via `getTranslations('membersPage')`
- **Assessment: PASS (page frame)**

---

### `/dashboard/members/[id]` (member detail)

**File:** `app/[locale]/dashboard/members/[id]/page.tsx`  
**Pattern:** Client Component (`"use client"`)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ |

**Notes:**  
- `useSWR` for both member data and member claims — proper cache-based re-fetching
- `memberLoading` / `claimsLoading` states render loading skeletons
- `memberError || !member` renders a not-found/error UI
- `claims.length === 0` triggers an empty state card
- **No server-side role gate** at page level — relies on layout auth only
- **Assessment: WARN — C7 weak (no page-level RBAC)**

---

### `/dashboard/governance` (bylaws, policies, signatories)

**File:** `app/[locale]/dashboard/governance/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ? | ✅ | ? | ? | ? | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('officer')` enforced server-side; lower roles redirected
- Three tabs: Bylaws, Policies, Signatories — each delegates to its own component
- i18n metadata and heading via `getTranslations('governancePage')`
- **Assessment: PASS (page frame)**

---

### `/dashboard/governance-center` (institutional posture)

**File:** `app/[locale]/dashboard/governance-center/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | N/A | N/A | via error.tsx | ✅ | ✅ | ✅ |

**Notes:**  
- Reads from `@nzila/organizational-cognition-core` registry (synchronous package-level state projection — no DB, no async fetch needed)
- `requireUser()` enforced; no additional role gate (intentionally broad — all authenticated users can view institutional posture)
- All copy is real institutional narrative, not stub
- No loading state needed because there is no async data fetch at render time
- **Assessment: PASS**

---

### `/dashboard/analytics`

**File:** `app/[locale]/dashboard/analytics/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ? | ? | ? | ? | ? | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('steward')` enforced server-side
- Delegates entirely to `<AnalyticsOverviewConsole />` — all render criteria assumed in component
- i18n metadata via `getTranslations('analyticsPage')`
- **Assessment: PASS (page frame)**

---

### `/dashboard/operations`

**File:** `app/[locale]/dashboard/operations/page.tsx`  
**Pattern:** Server Component (30 KB, inline DB queries)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | via error.tsx | ✅ | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('platform_lead')` enforced; non-platform-lead redirected
- Five direct drizzle queries: `platform_services`, `platform_incidents`, `platform_sla_metrics`, `platform_releases`, `platform_capacity`
- Data loaders return typed arrays; all mapped with explicit `String()` / `Number()` casting — no implicit type coercion
- Inline service status icons (`🟢`, `🟡`, `🔴`) and colour-coded SLA badges driven by real data fields
- No fake or hardcoded data; tables may return empty arrays which are rendered as empty lists (adequate for a live platform page)
- **Assessment: PASS**

---

### `/dashboard/ops` (performance sub-dashboard)

**File:** `app/[locale]/dashboard/ops/page.tsx` — **DOES NOT EXIST**

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ❌ | ❌ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ |

**Notes:**  
- The `ops/` directory exists with a `performance/` subdirectory but **no `page.tsx` at the `ops/` level**
- Navigating to `/dashboard/ops` will produce a Next.js 404
- **Assessment: NOT_FOUND — P2 missing route**

---

### `/dashboard/admin`

**File:** `app/[locale]/dashboard/admin/page.tsx`  
**Pattern:** Client Component (`"use client"`, ~80 KB)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

**Notes:**  
- `useEffect` fetches `/api/admin/stats/overview`, `/api/admin/users`, `/api/admin/locals` on mount
- Seven functional sections: overview, users, locals, system settings, security, reports, database, AI testing
- `setLoading(true/false)` gates render; `toast.error(...)` on fetch failure
- Empty/filtered states for user and local lists
- i18n via `useTranslations('adminPage')`
- **CRITICAL: There is NO server-side auth or role check in this page file.** The dashboard layout authenticates the session, but no `requireUser()` + `hasMinRole('admin')` call exists at the page level. Any authenticated non-admin user who navigates to `/dashboard/admin` will receive the full admin page shell; the API calls will fail at the route layer, but the page structure and section labels are visible.
- **Assessment: FAIL on C7 — P1 security gap**

---

### `/dashboard/settings`

**File:** `app/[locale]/dashboard/settings/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | N/A | via error.tsx | ✅ | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` enforced; `getUserRole()` from DB used to split rendering between platform-admin view and org-admin view
- Real DB queries for org profile, billing plan, and notification preferences
- i18n metadata and all labels via `getTranslations('settingsPage')`
- **Assessment: PASS**

---

### `/dashboard/documents`

**File:** `app/[locale]/dashboard/documents/page.tsx`  
**Pattern:** Server Component wrapper + client console (`DocumentsConsole`)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Notes:**  
- Page is guarded by server-side `requireUser()` and role-aware demo/runtime branching.
- Console uses governed repository APIs for library/search/templates/approvals/retention/bulk flows.
- Upload + OCR ingestion and migration URL import are wired into the live console surface.
- **Assessment: PASS**

---

### `/dashboard/inbox`

**File:** `app/[locale]/dashboard/inbox/page.tsx`  
**Pattern:** Server Component

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ? | ? | ? | ? | ? | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` enforced in `try/catch`; failure redirects to `/login`
- Delegates to `<InboxConsole />` — all render criteria assumed in component
- i18n metadata via `getTranslations('inboxPage')`
- **Assessment: PASS (page frame)**

---

### `/dashboard/billing-admin`

**File:** `app/[locale]/dashboard/billing-admin/page.tsx`  
**Pattern:** Server Component (28 KB)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | ✅ | via error.tsx | ✅ | ✅ | ✅ | ✅ |

**Notes:**  
- `requireUser()` + `hasMinRole('billing_specialist')` enforced; non-billing roles redirected to `/dashboard`
- `Promise.all([loadSubscriptions(), loadInvoices(), loadPayments()])` — parallel real service calls from `@/services/platform-economics`
- Error caught with `logger.error`; page renders with empty arrays rather than crashing
- Tabs: Overview (MRR, active subscriptions, payment success rate, overdue count), Subscriptions, Invoices, Payments — all driven by real data
- Overdue invoice badge uses `stats.overdueInvoices > 0` conditional — real data-driven alerting
- **Assessment: PASS**

---

### `/[locale]/(auth)/sign-up`

**File:** `app/[locale]/(auth)/sign-up/[[...sign-up]]/page.tsx`  
**Pattern:** Server Component (auth page)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| N/A | ✅ | N/A | N/A | N/A | ✅ | N/A | ✅ |

**Notes:**  
- Server component; renders `<AuthPageLayout>` + `<SignupForm />`
- i18n metadata (`metaTitle`, `metaDescription`) via `getTranslations('signUpCatchAllPage')`
- Stats (locals, members, uptime) from i18n keys — intentionally static marketing copy
- No auth guard needed (this is the sign-up surface)
- **Assessment: PASS**

---

### `/[locale]/(marketing)/pilot-request`

**File:** `app/[locale]/(marketing)/pilot-request/page.tsx`  
**Pattern:** Client Component (`"use client"`, 34 KB)

| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ✅ | ✅ | N/A | ✅ | ✅ | ✅ | N/A | ✅ |

**Notes:**  
- Multi-step (5-step) form with client-side state machine; step 5 is readiness assessment, step 6 is confirmation
- Submits to `/api/pilot/apply` via `fetch` with `Content-Type: application/json`
- `submitting` boolean disables submit and shows feedback
- `alert(t('alerts.submitFailed'))` on error — functional but lower quality than a toast; acceptable for a marketing form
- `calculateReadinessScore()` from `@/lib/pilot/readiness-assessment` — real scoring algorithm, not stub
- i18n via `useTranslations('marketing.pilotRequest')` throughout
- No auth required (public marketing page)
- **Assessment: PASS**

---

## Pilot-Critical Summary Table

| Route | Exists | Auth (C7 server) | Data Real (C1) | Loading (C4) | Error (C5) | Empty (C3) | i18n (C2) | Overall |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/dashboard` (root) | ✅ | ✅ | N/A | N/A | ✅ | N/A | ✅ | ✅ PASS |
| `/dashboard/layout` | ✅ | ✅ | ✅ | N/A | ✅ | N/A | ✅ | ✅ PASS |
| `/dashboard/error` | ✅ | N/A | N/A | N/A | ✅ Sentry | N/A | ✅ | ✅ PASS |
| `/dashboard/grievances` | ❌ | — | — | — | — | — | — | ❌ NOT_FOUND |
| `/dashboard/grievances/[id]` | ✅ | ✅ steward | ? delegate | ? delegate | ? delegate | ? delegate | ✅ | ✅ PASS |
| `/dashboard/cases` | ❌ | — | — | — | — | — | — | ❌ NOT_FOUND |
| `/dashboard/cases/[id]` | ✅ | ⚠️ client | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ WARN |
| `/dashboard/claims` | ❌ | — | — | — | — | — | — | ❌ NOT_FOUND |
| `/dashboard/claims/new` | ✅ | ⚠️ client | ✅ API | ✅ | ✅ | N/A | ✅ | ⚠️ WARN |
| `/dashboard/members` | ✅ | ✅ steward | ? delegate | ? delegate | ? delegate | ? delegate | ✅ | ✅ PASS |
| `/dashboard/members/[id]` | ✅ | ⚠️ layout | ✅ SWR | ✅ | ✅ | ✅ | ✅ | ⚠️ WARN |
| `/dashboard/governance` | ✅ | ✅ officer | ? delegate | ? delegate | ? delegate | ? delegate | ✅ | ✅ PASS |
| `/dashboard/governance-center` | ✅ | ✅ auth | ✅ registry | N/A | via boundary | N/A | ✅ | ✅ PASS |
| `/dashboard/analytics` | ✅ | ✅ steward | ? delegate | ? delegate | ? delegate | ? delegate | ✅ | ✅ PASS |
| `/dashboard/operations` | ✅ | ✅ platform_lead | ✅ drizzle | via boundary | ✅ | ✅ | ✅ | ✅ PASS |
| `/dashboard/ops` | ❌ | — | — | — | — | — | — | ❌ NOT_FOUND |
| `/dashboard/admin` | ✅ | ❌ none | ✅ fetch | ✅ | ✅ | ✅ | ✅ | ❌ FAIL C7 |
| `/dashboard/settings` | ✅ | ✅ role-split | ✅ DB | via boundary | ✅ | N/A | ✅ | ✅ PASS |
| `/dashboard/documents` | ✅ | ❌ none | ✅ fetch | ✅ | ✅ | ✅ | ✅ | ⚠️ WARN |
| `/dashboard/inbox` | ✅ | ✅ auth | ? delegate | ? delegate | ? delegate | ? delegate | ✅ | ✅ PASS |
| `/dashboard/billing-admin` | ✅ | ✅ billing_specialist | ✅ services | via boundary | ✅ | ✅ | ✅ | ✅ PASS |
| `/(auth)/sign-up` | ✅ | N/A | N/A | N/A | N/A | N/A | ✅ | ✅ PASS |
| `/(marketing)/pilot-request` | ✅ | N/A | ✅ API | ✅ | ✅ | N/A | ✅ | ✅ PASS |
| `/api/health/liveness` | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | ✅ PASS |

**Totals:** ✅ PASS: 16 · ⚠️ WARN: 4 · ❌ FAIL/NOT_FOUND: 5

---

## Issues by Severity

### P0 — Production Blocker

*None identified.* The shared dashboard layout correctly gates all routes behind `requireUser()`. No page renders unauthenticated data to the public.

---

### P1 — Security Risk

#### P1-1 · `/dashboard/admin` has no server-side role gate

**File:** `app/[locale]/dashboard/admin/page.tsx`  
**Impact:** Any authenticated user (including `member` and `steward` roles) who navigates directly to `/dashboard/admin` receives the full admin panel HTML shell. All seven admin sections (users, locals, system, security, reports, database, AI testing) are visible in the DOM. Individual API calls will return 403, but the page structure leaks information about system capabilities.

**Fix:** Add at the top of the server component wrapper or create an async `AdminPage` server component that calls:
```ts
await requireUser();
const hasAccess = await hasMinRole('admin');
if (!hasAccess) redirect(`/${locale}/dashboard`);
```
If the page must remain a client component, add a new thin server component wrapper (`admin-guard.tsx`) and export only that.

---

#### P1-2 · `/dashboard/documents` has no server-side role gate

**File:** `app/[locale]/dashboard/documents/page.tsx`  
**Impact:** Any authenticated user can view the documents management interface and initiate uploads. Documents may contain member-private or org-confidential materials.

**Fix:** Same pattern — introduce a thin server wrapper or middleware rule for the `/dashboard/documents` route that applies `requireUser()` + `hasMinRole('steward')` (or whatever the intended role is for document access).

---

### P2 — UX / Functional Gap

#### P2-1 · Three pilot-critical list routes are missing

The following routes return a 404:
- `/dashboard/grievances` (list of all grievances)
- `/dashboard/cases` (list of all cases)
- `/dashboard/claims` (list of submitted claims)

Each directory has only a `[id]/` detail page. Pilots who land on the list URL (e.g., from a navbar link) see a Next.js 404 instead of a table/list view. These are the primary entry points to the core workflow.

**Fix:** Create `app/[locale]/dashboard/grievances/page.tsx`, `cases/page.tsx`, and `claims/page.tsx` with the standard server component pattern (`requireUser()` + `hasMinRole(...)` + delegate to a console component).

---

#### P2-2 · `/dashboard/ops` top-level page is missing

**File:** `app/[locale]/dashboard/ops/page.tsx` — absent  
**Impact:** The `ops/performance/` sub-route exists but there is no landing page for `/dashboard/ops`.

**Fix:** Create `app/[locale]/dashboard/ops/page.tsx` (redirect to `ops/performance` or render an ops overview).

---

#### P2-3 · No `loading.tsx` at dashboard root

**File:** `app/[locale]/dashboard/loading.tsx` — absent  
**Impact:** On slow connections, there is no Suspense fallback at the dashboard root level. Pages that use server-side data fetching (operations, billing-admin, settings) will show a blank white screen during the initial server render.

**Fix:** Create `app/[locale]/dashboard/loading.tsx` with a skeleton/spinner that matches the sidebar layout.

---

#### P2-4 · `/dashboard/documents` — library, templates, and approvals sub-tabs pass empty stub arrays

**File:** `app/[locale]/dashboard/documents/page.tsx`  
**Status:** RESOLVED  
**Impact (historical):** `DocumentLibraryBrowser` and related tabs previously received empty arrays and rendered as stubs.

**Resolution:** `DocumentsConsole` now maps governed repository responses into library/search/template/approval/retention/bulk tab props and handlers.

---

#### P2-5 · `cases/[id]` and `members/[id]` are client components with layout-only auth

Both use client-side RBAC (`useHasPermission` / layout session) rather than server-side role checks. A steward navigating directly to a case that belongs to another local can trigger the full page render; access control depends entirely on the API layer.

**Recommendation:** Add a server component wrapper or use Next.js middleware to apply `hasMinRole` checks for these detail routes.

---

### P3 — Minor / Quality

#### P3-1 · `claims/new` uses `alert()` fallback

`alert(t('alerts.submitFailed'))` is used on API error. This is a functional fallback but inconsistent with the rest of the app which uses `toast.error()`.

---

#### P3-2 · `pilot-request` uses `alert()` fallback

Same as P3-1 — `alert(t('alerts.submitFailed'))` on submission failure. Acceptable for a marketing page but inconsistent.

---

#### P3-3 · `bargaining/new/page.tsx` has raw English `placeholder` strings

Two `<input>` placeholders in `bargaining/new/page.tsx` use hardcoded English text (`"e.g. 2026 Collective Agreement Renewal"`, `"Brief overview of the negotiation scope and objectives"`) rather than i18n keys. This is outside the pilot-critical scope but will break FR locale.

---

## Test Coverage Gaps

### E2E Tests Present

The `e2e/` and `tests/e2e/` directories contain Playwright tests covering:

| Test File | Covers |
|---|---|
| `dashboard.spec.ts` | Dashboard load and navigation |
| `authenticated-role-navigation.spec.ts` | Role-based navigation flows |
| `pilot-mode-gating.spec.ts` | Pilot mode feature flags |
| `smoke.spec.ts` | Basic health of all major routes |
| `ue-workflow.spec.ts` / `tests/e2e/ue-workflow.spec.ts` | Full member workflow |
| `member-intake.spec.ts` | Member intake flow |
| `case-escalation.spec.ts`, `case-resolution.spec.ts` | Case lifecycle |
| `steward-review.spec.ts` | Steward review flow |
| `admin-assignment.spec.ts` | Admin assignment |
| `auditor-readonly.spec.ts` | Auditor read-only enforcement |
| `cross-org-block.spec.ts`, `org-isolation-negative.spec.ts` | Org isolation |
| `evidence-misuse.spec.ts` | Evidence access control |
| `auth-failure-handling.spec.ts`, `auth-session-switch.spec.ts` | Auth edge cases |
| `tests/api/rbac.spec.ts` | API-level RBAC |

### Missing Test Coverage

| Gap | Priority | Rationale |
|---|---|---|
| E2E: `/dashboard/grievances` list page | P1 | Route does not exist — test would catch the 404 |
| E2E: `/dashboard/cases` list page | P1 | Route does not exist |
| E2E: `/dashboard/claims` list page | P1 | Route does not exist |
| E2E: Non-admin accessing `/dashboard/admin` (should be redirected) | P1 | Currently would show admin shell |
| E2E: Non-steward accessing `/dashboard/documents` (should be redirected) | P1 | No server gate |
| E2E: `/dashboard/loading` skeleton visible during server render | P2 | No loading.tsx |
| Unit: `calculateReadinessScore` boundary conditions | P3 | Scoring algorithm has no test file visible in scope |
| E2E: Bargaining pages (FR locale placeholder text) | P3 | Locale regression |

---

*Report generated by static code analysis. Runtime behaviour may differ. Re-run after implementing P1 fixes.*
