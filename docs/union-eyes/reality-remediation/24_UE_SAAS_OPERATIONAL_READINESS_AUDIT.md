# 24 — Union Eyes SaaS Operational Readiness Audit (Phase 3A)

**Gate:** `UE_SAAS_OPERATIONAL_READINESS`
**Provisional ruling (this snapshot):** `NO_GO`
**Audited SHA (`origin/main`):** `cebe1d520aeb6d95e7a3e4cd70ddf071eff93428`
**Audit date:** 2026-08-31
**Audit branch:** `docs/ue-saas-readiness-audit` (evidence/discovery only — not a remediation branch)
**Prior context:** post-merge of PR #721 (dues-context truth), #722 (deadline continuity), #720
(capability-registry reconciliation), #719 (Member Management console truth fixes).

## Methodology

This is an evidence-discovery pass, not an optimization-for-PASS exercise. Findings are
derived from:

1. Static route-tree inspection (`app/[locale]/dashboard/**`) cross-referenced against the
   canonical navigation source, `lib/dashboard/role-experience.ts`.
2. Backend-reality tracing: for each supported page, which API route(s)/DB queries its
   component tree actually calls, and whether those routes return real data or a
   fabricated/empty fallback.
3. The repository's own existing anti-theatre static scanner
   (`tooling/reality/anti-theatre-scan.ts`, run via `pnpm reality:anti-theatre`) — reused as
   the authoritative mechanism for false-truth pattern detection (R-1 through R-8) rather than
   re-deriving equivalent regex sweeps by hand.
4. Direct reconciliation of `apps/union-eyes/maturity.json` against currently-merged code,
   currently-running CI gates, and currently-present evidence artifacts.
5. `git ls-files` / directory listings as ground truth for page existence — filesystem
   presence is treated as necessary but **not sufficient** proof of operability (see
   classification vocabulary below).

No source files were modified during this pass. Only this ledger was authored.

## Supported-surface definition

A "supported/navigable" surface is one reachable via a `href` returned by
`getNavigationForExperience()` or `getRoleLandingPath()` in `lib/dashboard/role-experience.ts`,
for at least one of the five `DashboardExperience` values (`member`, `staff`, `executive`,
`governance`, `admin`). Components/routes that exist in the repository but are not imported by
any such reachable page are **latent**, not supported, per this audit's scope — they are
recorded but not counted as SaaS blockers unless directly reachable by predictable URL.

## Classification vocabulary

Per-surface classification (as specified for this audit; distinct from, but cross-referenced
against, the existing `CapabilityState` vocabulary in `lib/reality/capability-registry.ts`):

| Class | Meaning |
|---|---|
| `OPERATIONAL_AND_CODE_PROVEN` | Page exists, backend is real and DB-backed, no fabricated fallback found. |
| `OPERATIONAL_PENDING_RUNTIME_PROOF` | Code looks correct but has never been proven against deployed staging infrastructure (live Postgres/RLS, concurrent workers, real auth). |
| `LIMITED` | Real, but with a documented, bounded limitation. |
| `HIDE_REMOVE` | Should not be reachable in its current form; either broken or misleading. |
| `LATENT_UNEXPOSED` | Code exists, not wired to any reachable navigation surface. |
| `FUTURE_OPTIONAL` | Deliberately out of scope for this readiness gate. |

Route-existence sub-states used in §2:
`PAGE_EXISTS` / `PAGE_MISSING` / `PAGE_REDIRECT` / `PAGE_EXISTS_BUT_BACKEND_BROKEN` /
`PAGE_EXISTS_PENDING_RUNTIME_PROOF`.

---

## 1. Confirmed finding — staff Members navigation is broken

**`UE-STAFF-MEMBER-DIRECTORY = DEFECT / SAAS_BLOCKER`**

`getNavigationForExperience('staff')` and `ALLOWED_PREFIXES_BY_EXPERIENCE.staff` both advertise:

```
{ label: 'Members', href: '/dashboard/members', group: 'Operations' }
```

The actual route directory `apps/union-eyes/app/[locale]/dashboard/members/` contains **only**:

```
members/new/page.tsx
members/[id]/...
```

There is no `members/page.tsx`. Clicking the canonical staff "Members" navigation link 404s
(App Router has no matching segment for the bare `/dashboard/members` path). Confirmed via
directory listing — no `layout.tsx` redirect or catch-all exists under `dashboard/members/`,
and `dashboard/layout.tsx` contains no special-case redirect for this path.

This is **distinct** from the platform-admin console fixed by PR #719
(`/dashboard/admin/members`, `components/admin/members-console.tsx`) — that surface is
cross-tenant platform administration and is correctly gated on the platform-ops role
hierarchy (`support_manager`+), not the union-tenant staff role hierarchy. They must not be
conflated, and staff must **not** be redirected into the platform-admin console (which exposes
an "All Organizations" cross-tenant selector inappropriate for ordinary union staff).

**A candidate reusable component already exists and is currently orphaned:**
`apps/union-eyes/components/members/members-console.tsx` — a tenant-scoped
(`useOrganization()`-based, not cross-org) member directory client component with search,
filter, role/status badges, and CSV export intent. Its own header comment says *"Rendered by
the server-side page wrapper after auth check"*, implying a page wrapper was intended but was
never built or was removed. It is not imported by any file under `apps/union-eyes/app/**`
(confirmed via repo-wide search) — it is `LATENT_UNEXPOSED`, not currently a live defect on
its own, but it is the most plausible pre-built substrate for closing
`UE-STAFF-MEMBER-DIRECTORY`.

Caution for remediation (not performed in this pass): the component's data-fetch strategy
tries multiple candidate `organizationId` sources and keeps whichever response has the
**highest member count** (`bestCount` tracked across `/api/members`,
`/api/users/me/organizations`, `/api/users/me/profile` candidates). This "pick the biggest
result" heuristic is itself a truth-integrity smell — it should be replaced with a single
authoritative org-resolution call (matching the `getOrganizationIdForUser()` pattern already
used in `dashboard/layout.tsx`) rather than reused as-is.

---

## 2. Canonical supported-route matrix

Derived from `getNavigationForExperience()` for all five experiences plus each
`getRoleLandingPath()` destination. Existence checked by directory listing under
`app/[locale]/dashboard/`.

| Experience | Nav label | Route | Page state |
|---|---|---|---|
| member (landing) | Workspace | `/dashboard/workspace` | `PAGE_EXISTS` |
| member | Home | `/dashboard/inbox` | `PAGE_EXISTS` |
| member | My Cases | `/dashboard/inbox?type=intake` | `PAGE_EXISTS` (same route, query param) |
| member | Open Representation Case | `/dashboard/claims/new` | `PAGE_EXISTS` |
| member | Messages | `/dashboard/inbox?type=message` | `PAGE_EXISTS` |
| member | Documents | `/dashboard/documents` | `PAGE_EXISTS` |
| member | Profile & Settings | `/dashboard/settings` | `PAGE_EXISTS` |
| member | Help & Support | `/dashboard/support` | `PAGE_EXISTS` |
| staff (landing) | Workspace | `/dashboard/workspace` | `PAGE_EXISTS` |
| staff | Operations (Casework Console) | `/dashboard/workbench` | `PAGE_EXISTS` |
| staff | Operations Queue | `/dashboard/inbox?type=intake` | `PAGE_EXISTS` |
| staff | Operations Priorities | `/dashboard/operations` | `PAGE_EXISTS` |
| staff | **Members** | `/dashboard/members` | **`PAGE_MISSING` — see §1** |
| staff | Documents | `/dashboard/documents` | `PAGE_EXISTS` |
| staff | Operations Communications | `/dashboard/correspondence` | `PAGE_EXISTS` |
| staff | Institutional Intelligence Reports | `/dashboard/intelligence` | `PAGE_EXISTS` |
| staff | Notifications | `/dashboard/notifications` | `PAGE_EXISTS` |
| staff | Profile & Settings | `/dashboard/settings` | `PAGE_EXISTS` |
| executive (landing) | Workspace | `/dashboard/workspace` | `PAGE_EXISTS` |
| executive | OCRA Intelligence | `/dashboard/intelligence?scope=executive` | `PAGE_EXISTS` (same route as staff, query param) |
| executive | OCRA Signals | `/dashboard/continuity-intelligence` | `PAGE_EXISTS` |
| executive | Operations Continuity | `/dashboard/executive-operating-intelligence` | `PAGE_EXISTS_PENDING_RUNTIME_PROOF` — see §5 |
| executive | Governance Continuity | `/dashboard/governance-center` | `PAGE_EXISTS` |
| executive | Operations Outcomes | `/dashboard/outcomes` | `PAGE_EXISTS` |
| executive | Onboarding Survivability (Leadership Continuity) | `/dashboard/leadership` | `PAGE_EXISTS` |
| executive | Institutional Intelligence Reports | `/dashboard/intelligence` | `PAGE_EXISTS` |
| executive | Governance Trust & Oversight | `/dashboard/trust` | `PAGE_EXISTS` |
| executive | Profile & Settings | `/dashboard/settings` | `PAGE_EXISTS` |
| governance (landing) | Workspace | `/dashboard/workspace` | `PAGE_EXISTS` |
| governance | Governance Continuity Overview | `/dashboard/governance` | `PAGE_EXISTS` |
| governance | Governance Trust & Explainability | `/dashboard/trust` | `PAGE_EXISTS` |
| governance | Governance Continuity Review | `/dashboard/workbench` | `PAGE_EXISTS` |
| governance | Governance Policy Continuity | `/dashboard/governance` | `PAGE_EXISTS` (dup href of Overview) |
| governance | OCRA Continuity Signals | `/dashboard/continuity-intelligence` | `PAGE_EXISTS` |
| governance | Institutional Intelligence Reports | `/dashboard/intelligence` | `PAGE_EXISTS` |
| governance | Governance Audit & Evidence | `/dashboard/audits` | `PAGE_EXISTS` |
| governance | Profile & Settings | `/dashboard/settings` | `PAGE_EXISTS` |
| admin (landing) | Workspace | `/dashboard/workspace` | `PAGE_EXISTS` |
| admin | Organization | `/dashboard/admin/organizations` | `PAGE_EXISTS` |
| admin | Users & Roles | `/dashboard/admin/members` | `PAGE_EXISTS` (fixed by #719) |
| admin | Pilot Configuration | `/dashboard/admin/onboarding` | `PAGE_EXISTS` |
| admin | Policies | `/dashboard/governance` | `PAGE_EXISTS` |
| admin | Audit | `/dashboard/audits` | `PAGE_EXISTS` |
| admin | Security | `/dashboard/security` | `PAGE_EXISTS` |
| admin | Exports | `/dashboard/movement-insights/export` | `PAGE_EXISTS` |
| admin | Integrations | `/dashboard/integrations` | `PAGE_EXISTS` |
| admin | System Status | `/dashboard/operations` | `PAGE_EXISTS` |

**Result: 1 of 43 canonical navigation destinations is `PAGE_MISSING`** (`/dashboard/members`,
staff experience). All others resolve to an existing page file. This does not certify those
pages are backend-real — see §5 for the subset actually traced to API/DB reality in this pass.

Note on `admin` experience: `getRoleLandingPath()` sends `admin` role users to
`/dashboard/admin/organizations`, which is a genuinely different destination from every other
experience's landing (`/dashboard/workspace`) — confirmed intentional per the code comment
("Each role lands on its primary surface, not the shared Workspace hub").

Note on `PILOT_EXCLUDED_PREFIXES`: in pilot mode, several routes that otherwise exist as pages
(`/dashboard/analytics`, `/dashboard/cognition`, `/dashboard/executive-operating-intelligence`,
`/dashboard/movement-insights`, etc.) are hard-blocked by `canAccessDashboardPath()` regardless
of role. This means `/dashboard/executive-operating-intelligence` — reachable per the nav
table above — is **not actually reachable while `isPilotMode` is true**, which is the current
production posture (`maturity.json` → `status: "pilot"`). This is a real, deliberate
restriction, not a defect — but it means the nav item is presented to executive users while
the underlying route access-guards it away in the pilot's actual deployed configuration. Flag
for the persona audit (§3) as a presentation-vs-access mismatch worth resolving before GA
(showing a nav link to a page you cannot open is itself a minor truth defect, `LIMITED`, not
`SAAS_BLOCKER` — pilot-mode gating is an explicit, documented product decision).

---

## 3. Persona audit

### Member
All 8 nav destinations exist (§2). Not independently backend-traced in this pass beyond the
existing `/api/claims`, `/api/documents`, `/api/inbox`-family routes already exercised by
`ue-persona-access.test.ts` (769 tests, passing on the audited SHA per the last CI run of
PR #719). No new defect found for this persona in this pass.

### Staff / representative
7 of 8 destinations exist. **Members directory is `DEFECT` (§1).** Workbench, operations
queue, priorities, documents, correspondence, intelligence, notifications all resolve to
existing pages; not all individually backend-traced in this pass (see runtime-proof queue,
§9, for what remains unverified).

### Executive / union leadership
All 9 destinations exist as page files. `executive-operating-intelligence` is
pilot-mode-excluded at runtime (§2 note) despite being nav-advertised — `LIMITED`, flag for
resolution before GA, not a `SAAS_BLOCKER` today. `leadership` and
`executive-operating-intelligence` were traced for data-boundary behaviour — see §7
(leadership data-boundary audit): both are single-`organizationId`-scoped, no
hierarchy-spanning aggregation found (neither an over-exposure risk nor yet a delivered
federation-rollup feature — see §7 for the honest double-sided read of this finding).

### Governance / compliance
All 9 destinations exist. `workbench` is shared with the staff experience's "Operations"
landing (same route, different intended lens) — not independently re-traced for a
governance-specific view in this pass; flag as `OPERATIONAL_PENDING_RUNTIME_PROOF` for
whether the governance role actually sees governance-relevant content vs. the identical
staff casework view.

### Tenant administration vs. platform/system administration
The current role model does **not** appear to define a distinct "tenant administrator"
experience separate from `admin` (platform/system administration) — `ADMIN_ROLES` in
`role-experience.ts` (`system_admin`, `admin`, `platform_lead`, `integration_manager`,
`billing_manager`, `data_analytics_manager`) all resolve to the single `admin` experience,
whose nav includes cross-tenant surfaces (`/dashboard/admin/organizations`,
`/dashboard/admin/members` with "All Organizations" selection per the #719 PR body). This is
consistent with today's architecture treating `admin` as platform-ops, not scoped
tenant-admin — matches the finding in §1 that staff and platform-admin member surfaces are
correctly kept separate. No distinct tenant-admin experience currently exists to audit
separately; recorded as `LATENT_UNEXPOSED` product-model gap, not a defect, since nothing
currently claims to offer scoped tenant-administration and fails to deliver it.

### Platform/system administration
Organizations, Users & Roles, Pilot Configuration, Policies, Audit, Security, Exports,
Integrations, System Status — all 9 nav destinations exist as pages (§2).

---

## 4. Supported-surface defect search

Ran the repository's existing anti-theatre static scanner
(`pnpm reality:anti-theatre`, `tooling/reality/anti-theatre-scan.ts`) against the audited SHA
rather than hand-deriving equivalent regex sweeps, since it already implements rules R-1
through R-8 covering: 2xx-disguised-`not_implemented`, hardcoded readiness, demo-import
leakage into production, demo-profile-in-non-dev-env, fabricated cached-provenance,
silent-swallow catches, unregistered routes, and empty-authoritative-payload-as-200.

**Result: 0 errors, 1266 warnings, 4856 files scanned.**

Breakdown by rule:

| Rule | Count | Note |
|---|---:|---|
| R-2 (hardcoded readiness) | 1 | `app/api/admin/database/health/route.ts:39` — literal `status: "healthy"`. Requires verification this is derived from a real measurement, not a placeholder (not independently re-verified in this pass; flagged for runtime-proof queue). |
| R-6 (silent-swallow catches) | 322 | Pre-existing, tracked as a Wave 1 open item since `16_ANTI_THEATRE_BASELINE.md`; not re-triaged individually in this pass. |
| R-7 (route missing capability-registry entry) | 938 | Pre-existing Wave 0 registry-backfill item, warning-severity by design until backfill completes. |
| R-8 (empty authoritative payload as 200) | 5 | See below — one of these is a genuine, actionable finding for this audit. |

**R-8 finding directly relevant to this audit — `app/api/deadlines/upcoming/route.ts:23`:**

```ts
export async function GET(req: NextRequest) {
  const response = await crud.GET(req);
  if (!response.ok) {
    return NextResponse.json({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
  }
  return response;
}
```

Any failure from the underlying CRUD handler (auth failure, DB error, schema mismatch) is
converted into a fake "zero upcoming deadlines" success response. This is directly relevant to
the Sean continuity critical path (§7, step 7 — "deadlines follow successor"): if this were the
route a successor's deadline view called, a real backend failure would be indistinguishable
from "you genuinely have no upcoming deadlines," which is exactly the false-truth failure mode
the programme exists to prevent.

**Consumer-reachability check on this specific finding:** the only in-repo consumer of
`/api/deadlines/upcoming` is `components/dashboards/union-dashboard.tsx` (`UnionDashboard`),
which is exported from `components/dashboards/index.ts` but is **not imported by any page**
under `app/[locale]/dashboard/**` — confirmed via repo-wide search. `UnionDashboard` is
`LATENT_UNEXPOSED`. The route itself remains directly reachable by URL to any authenticated
user with `member`+ read role (`readRole: 'member'` in the `crudRoutes()` config), so it is not
fully inert — it should still be fixed (return a real error status instead of a fabricated
empty success) before being wired into any future successor-facing deadline surface, but it is
**not** currently a live SaaS-blocking defect because nothing reachable renders its output
today. Recorded as `HIDE_REMOVE`-candidate-on-fix (fix the fabricated-success pattern; do not
wire it up as-is) for the remediation phase, not a `SAAS_BLOCKER` for this snapshot.

**`/api/v2/` dead-consumer search:** no occurrences of `/api/v2/` found in any file under
`app/[locale]/dashboard/**`. No finding.

**Demo/mock/sample data in supported paths:** not found via the scanner's R-3 rule (0 errors —
confirmed by `16_ANTI_THEATRE_BASELINE.md`'s documented Stage-1 physical relocation of all demo
code into the separate `apps/union-eyes-demo/` workspace member, re-confirmed present on this
SHA by the fresh scan above). No new finding.

**Debug/developer leakage:** not systematically re-swept in this pass beyond the OCRA
terminology question (§6). Flagged for the runtime-proof/UI-copy pass in a later wave rather
than manufactured here without direct evidence.

---

## 5. OCRA / product-language presentation audit

`OCRA` = **Organizational Continuity Risk (Assessment)**, confirmed via
`docs/union-eyes/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md` and
`UNION_EYES_TAB_SCHEMA.md`. This is a deliberate, governed institutional term with its own
workspace-placement doctrine ("OCI/OCRA must NOT become a separate top-level workspace... it
is part of Continuity") and an existing non-regression guard test protecting its scoring/routing
behaviour. It is **not** internal architecture jargon accidentally leaking into the UI — it has
real, intended meaning consistently used across governance documentation.

**Verdict: RETAIN.** Do not mechanically rename or strip the term.

**Minor presentation-clarity gap (not a blocker):** the raw acronym `OCRA` is never expanded
inline in the navigation UI itself (`"OCRA Intelligence (Executive Overview)"`, `"OCRA Signals
(Continuity Insights)"` — the parenthetical clarifies function, not the acronym). For an
unfamiliar external viewer encountering the term cold, "OCRA" alone provides no expansion.
Classified `LIMITED` — a future copy/tooltip pass, not a rename, not blocking this gate. No
LIUNA-specific labels are introduced or recommended here.

---

## 6. Sean continuity critical path

| # | Step | Classification | Evidence |
|---|---|---|---|
| 1 | Successor takes over responsibility | `RUNTIME_PROOF_REQUIRED` | Role/assignment transition code exists (PR #722); not proven against deployed concurrent-worker/RLS infrastructure. |
| 2 | Organizational context is available | `CODE_PROVEN` | `getOrganizationIdForUser()` + membership auto-linking in `dashboard/layout.tsx`; covered by existing route-level org-scoping contract tests. |
| 3 | Active grievance/matter is visible | `CODE_PROVEN` (staff casework routes exist and are DB-backed per `/dashboard/workbench`, `/dashboard/inbox?type=intake`) | Route existence confirmed §2; not independently re-traced to DB in this pass beyond existing passing contract-test coverage. |
| 4 | Chronology/history is preserved | `RUNTIME_PROOF_REQUIRED` | `case-timeline-service.ts` + test exist; hash-chained audit log claimed in `maturity.json`'s `data_integrity` blocker — not independently re-verified against live staging in this pass. |
| 5 | Evidence/documents retain context | `RUNTIME_PROOF_REQUIRED` | ClamAV-scan-before-persist and sealed manifest export claimed in `maturity.json`; not re-verified against live staging in this pass. |
| 6 | Assignment transition is visible | `CODE_PROVEN` (PR #722 closed this per its own PR body: assignment-triggered reminder recipient refresh) | Not independently re-traced in this pass; accepted on the strength of #722's own test coverage. |
| 7 | Deadlines follow successor | **`DEFECT` (partial) — see §4** | `/api/deadlines/upcoming` fabricates empty success on backend failure; currently unreachable from any live page (`LATENT_UNEXPOSED` consumer), so not yet a live blocker, but must not be wired to any successor-facing surface until fixed. The grievance-specific deadline engine from #722 is a **separate** code path (`db/schema/domains/claims/deadlines.ts`, `deadline-engine-schema.ts`) not audited for the same defect in this pass — flagged as open, not cleared. |
| 8 | Restrictions remain restrictions | `RUNTIME_PROOF_REQUIRED` | Depends on live RLS + role-graph enforcement; contract tests (`ue-role-graph.test.ts`, `org-isolation-runtime.test.ts`) pass in CI but have not been proven against deployed Postgres RLS in staging per this audit's scope. |
| 9 | Audit reconstructs the handoff | `RUNTIME_PROOF_REQUIRED` | Hash-chain drift test (`hash-chain-drift.test.ts`) passes in CI; not independently re-verified against live staging. |
| 10 | Institutional memory surfaces relevant context | `OPERATIONAL_PENDING_RUNTIME_PROOF` | `/dashboard/institutional-memory` route family exists in the directory tree (not in the current canonical nav for any of the 5 experiences — confirmed via `role-experience.ts` grep, meaning it is currently `LATENT_UNEXPOSED` from the audited navigation, not reachable via any documented persona path). |
| 11 | Leadership receives aggregate intelligence without unauthorized raw-record access | See §7 below — **not currently an over-exposure risk, but also not currently a delivered feature.** |

**Overall for this critical path: `RUNTIME_PROOF_REQUIRED`, with one confirmed open code-level
defect (step 7) and one confirmed navigation gap (step 10 — institutional memory is not
reachable from any of the five audited personas' canonical navigation).** Per the audit's
explicit instruction, `UE-DEADLINE-ASSIGNMENT-CONTINUITY` (the capability tracked from #722)
remains `RUNTIME_PROOF_REQUIRED / LIMITED` — this snapshot does not upgrade it to proven merely
because #722 merged.

---

## 7. Leadership data-boundary audit

Traced the two executive-facing "intelligence" surfaces most likely to carry cross-org
aggregation risk:

- `/dashboard/leadership` → `GET /api/dashboard/leadership` — reads `context.organizationId`
  from the auth context only. No child-organization or hierarchy traversal found in the route
  handler.
- `/dashboard/executive-operating-intelligence` → `runFullInstitutionalCognition(organizationId)`
  (single `organizationId` parameter, server component, no hierarchy fan-out visible in the
  page's data-loading function).

**Finding: neither surface currently performs any organization-hierarchy-spanning
aggregation.** This means the specific failure mode the audit asked to guard against — "higher
level sees everything across every local's raw records" — is **not present** as an active
over-exposure defect in either surface traced. However, it also means the converse: federation
or CLC-level executive roles (`clc_executive`, `fed_executive` in `EXECUTIVE_ROLES` /
`GOVERNANCE_ROLES`) currently receive the **exact same single-org-scoped view** as any other
organization's executive — there is no delivered aggregate-across-locals capability today for
those roles to either over-reach into or be correctly bounded within. This is recorded as a
`LATENT_UNEXPOSED` product-completeness gap for a future wave (a federation-aware rollup with
an explicit, tested authorization boundary would need to be built new, not merely un-gated),
**not** a defect for this readiness gate — there is nothing currently leaking.

No other executive/governance surface was traced for hierarchy-drilldown behaviour in this
pass (`outcomes`, `governance-center`, `trust`, `continuity-intelligence` remain
`OPERATIONAL_PENDING_RUNTIME_PROOF` / not independently re-verified for this specific concern).

---

## 8. `maturity.json` reconciliation

`apps/union-eyes/maturity.json` declares `"generated_from": "governance/portfolio/product-catalog.json"`.
**Verified: this is not an actual generation pipeline.** No script in the repository (`scripts/**`,
`tooling/**`) reads `product-catalog.json` and writes `apps/*/maturity.json` — the field is
aspirational/documentation labelling, not a live generator reference. `product-catalog.json`'s
`union-eyes` entry carries only commercial/business metrics (revenue, pipeline, risk scores);
it has no `contracts_complete` / `data_integrity` / `observability` / `access_reviews` /
`analytics_readiness` fields for `maturity.json` to be mechanically derived from. Reconciliation
in this case means **hand-correcting `maturity.json` against current evidence**, not running a
generator — deferred to the remediation phase per this audit's discovery-only scope, but the
specific corrections needed are recorded below with evidence so they are not re-discovered from
scratch.

| Field | Current value | Verdict | Evidence |
|---|---|---|---|
| `analytics_readiness` (top-level) | `"partial"` | **Stale — internally inconsistent.** `maturity_gaps.analytics_readiness.status = "closed"` with a substantive blocker description of real closed work (org-scoped KPI computation, Redis caching, provenance metadata). The top-level field should be reconciled to match the gap's own recorded status (either promote top-level to reflect closure, or correct the gap's `status` back to non-closed if the closure claim itself is not trusted — this audit found no evidence contradicting the closure claim, so the top-level field is the stale one). |
| `access_reviews` | `"partial"`, blocker: *"not yet enforced as a fail-closed CI artifact check"* | **Blocker text is stale/inaccurate.** `.github/workflows/access-review-gate.yml` runs `on: pull_request, branches: [main]` and fails closed unless bypassed (bypass is logged and requires explicit CISO-approval variables). This **is** enforced as a fail-closed CI artifact check today. However, the underlying quarterly attestation (`reports/compliance/access-review/2026-Q3.json`) has `signoffStatus: "attestation-framework-active"` with every substantive finding (`activeAdminCount`, `privilegedRoleCount`, `dormantElevatedAccounts`, etc.) recorded as `null` — *"Live account metrics require Azure Entra read access"* — and `dormantAccountsAudited: false`. **Verdict: the field should remain `"partial"` (substantive account-level review is not yet performed), but the blocker text must be corrected** — it currently describes a problem (no CI enforcement) that no longer exists, while omitting the actual current gap (CI-enforced procedural attestation exists; substantive Azure Entra-backed measurement does not). |
| `contracts_complete` | `false`, blocker: *"case-timeline and org-picker pending final auth assertion coverage"* | `REQUIRES_REVALIDATION` — not closed in this pass. `lib/services/__tests__/case-timeline-service.test.ts` exists and covers `getVisibleScopesForRole`, suggesting partial progress, but this audit did not perform a line-by-line assertion-coverage review sufficient to certify closure. Recorded as open/unverified rather than asserted closed without direct evidence, per the audit's explicit instruction not to infer closure from partial signals. |
| `data_integrity` | `"partial"` | **Blocker text substantively still accurate** for its most specific claim — no CI workflow found enforcing "import reconciliation" (searched `.github/workflows/**`, no match). RLS/FSM/evidence-package/ClamAV claims in the blocker text were not independently re-verified against live staging in this pass (see §9, runtime-proof queue) — field correctly remains `partial`, not upgraded here. |
| `observability` | `"partial"`, blocker: *"per-route latency dashboards not yet published in Azure Monitor"* | **Still accurate.** No evidence of published Azure Monitor dashboards found under `governance/**` or `ops/**`. Field correctly remains `partial`. |
| `status` / `exposure` | `"pilot"` / `"internal"` | **Consistent** with `product-catalog.json`'s own `status: "pilot"` / `deployment: "internal"` for the same app. No reconciliation needed. |

**No edits were made to `maturity.json` in this pass**, per the audit's instruction to gather
evidence before touching declared-generated files — even though this file turned out not to
have a live generator, the same discipline (evidence before edit) was applied.

---

## 9. Runtime-proof queue

| Item | Classification |
|---|---|
| Live PostgreSQL RLS tenant-boundary probes | `REQUIRED_BEFORE_SAAS_PASS` |
| Grievance deadline assignment convergence (#722 scope) | `REQUIRED_BEFORE_SAAS_PASS` |
| Concurrent worker/lease recovery | `REQUIRED_BEFORE_SAAS_PASS` |
| Real successor reminder delivery | `REQUIRED_BEFORE_SAAS_PASS` |
| Real auth/session/offboarding against deployed Entra | `REQUIRED_BEFORE_SAAS_PASS` |
| Actual deployed route health for the 43 canonical nav destinations (§2) | `REQUIRED_BEFORE_SAAS_PASS` |
| Production/staging telemetry (OTEL traces → Azure Monitor dashboards) | `REQUIRED_BEFORE_SAAS_PASS` (per `maturity.json` `observability` gap, §8) |
| Worker/cron scheduling proof | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Backup/restore currency | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` (last drill dated 2026-05-01 per `maturity.json` — currency should be reconfirmed closer to any recording date, not re-run now) |
| Integrations/secrets/configuration | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Mobile layout | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| EN/FR browser parity | `REQUIRED_BEFORE_RECORDING_CERTIFICATION` |
| Audit/history persistence (live staging, not just contract tests) | `REQUIRED_BEFORE_SAAS_PASS` |
| Document/evidence access revocation | `REQUIRED_BEFORE_SAAS_PASS` |
| Legal/client taxonomy validation | `FUTURE_EXTERNAL_VALIDATION` — explicitly outside the recording critical path per audit scope. |

---

## 10. Initial ledger ruling

**`UE_SAAS_OPERATIONAL_READINESS = NO_GO`**

Confirmed blockers this snapshot:

1. `UE-STAFF-MEMBER-DIRECTORY = BLOCKER` (§1) — staff canonical navigation 404s.

Confirmed non-blocking-but-tracked defects:

2. `/api/deadlines/upcoming` fabricates empty-success on backend failure (§4) — not live-reachable
   today, must be fixed before any successor-facing deadline surface consumes it.
3. `analytics_readiness` top-level/gap inconsistency and `access_reviews` stale blocker text in
   `maturity.json` (§8) — documentation-truth defects, not code defects.
4. `executive-operating-intelligence` is nav-advertised to executives but pilot-mode-excluded
   at runtime (§2) — presentation/access mismatch.
5. `/dashboard/institutional-memory` is not reachable from any audited persona's canonical
   navigation despite being directly relevant to the Sean continuity path step 10 (§6).

This is the expected outcome of a discovery-first audit — the goal was to determine truth, not
to manufacture a PASS. Per instruction, Phase 3B (recording environment, LIUNA fixtures,
recording identities, recording certification artifacts) **must not begin** until this gate
reads `PASS`.

## Next steps (not performed in this branch)

Group the confirmed defects into focused remediation clusters, each on its own branch from
latest `main`, each with its own tests, inventory regeneration, and exact-head CI, per the
audit's remediation discipline:

- **Cluster A — Staff member directory**: wire a real `/dashboard/members/page.tsx` using the
  existing `components/members/members-console.tsx` substrate, replacing its
  multi-candidate-org "biggest result wins" fetch heuristic with a single authoritative
  `getOrganizationIdForUser()`-equivalent resolution.
- **Cluster B — `/api/deadlines/upcoming` truth fix**: replace the fabricated empty-success
  fallback with a real error response; leave `UnionDashboard` orphaned or wire it deliberately,
  but do not let it stay silently wrong.
- **Cluster C — `maturity.json` reconciliation**: hand-correct the fields and blocker text
  identified in §8, with evidence citations inline.
- **Cluster D — presentation/access mismatch**: resolve whether
  `executive-operating-intelligence` should be removed from pilot-mode nav or removed from
  `PILOT_EXCLUDED_PREFIXES`.

After all four clusters merge, rerun this ledger from the new exact `main` SHA before
re-evaluating the gate.
