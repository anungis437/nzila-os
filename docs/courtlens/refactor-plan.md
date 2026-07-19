# CourtLens Refactor — Phase 0 Plan (Verified, v3)

**Status:** `PHASE_0_READY_FOR_REVIEW`
**Planning branch:** `docs/courtlens-refactor-phase0-v3`
**Planning branch head:** self-referential; run `git rev-parse origin/docs/courtlens-refactor-phase0-v3` for the authoritative tip. See [reports/phase0/scope-report.json](../../reports/phase0/scope-report.json) for the machine-readable diff scope with `reconciliation: "RECONCILED"`.
**Baseline (approved product line):** `integration/courtlens-gap3-product-line-v2 @ c191c5db3`
**Baseline lineage:** integration branch = `main @ 6b6d3736dd3692112690165823a0702e1b6deea9` + 7 clean product-only commits (chronological). The union-eyes/sage repair commit (`2c8154e54`, original `f2188d74b`) is **excluded entirely**; every remaining Gap-3 commit is a file-selective replay documented in [gap3-product-commit-disposition.json](gap3-product-commit-disposition.json). See [refactor-branch-base.json](refactor-branch-base.json) for the frozen SHA map.
**Supersedes:**
- `docs/courtlens-refactor-phase0` (v1 @ `70b327b81`) — bundled Windows lint-staged fix + union-eyes/sage repairs + CourtLens artifacts in one commit off pre-Gap-3 main.
- `docs/courtlens-refactor-phase0-v2` (v2 @ `c2cbf9eb3`) — inherited the mixed union-eyes/sage repair commit via wholesale cherry-picks.
- `integration/courtlens-gap3-product-line` — old integration branch contaminated with `2c8154e54`.

All superseded branches remain on the remote as forensic references and MUST NOT be re-opened as Phase 0 PRs.

---

## 0. What Phase 0 is (and is not)

Phase 0 delivers **verified planning artifacts only**. It does not touch product code.

| In scope | Out of scope |
| --- | --- |
| Verified `refactor-plan.md` (this file) | Any UI implementation |
| Legacy inventory generator + tests | Any API route or schema change |
| Real inventory CSV + manifest + review ledger | Any DB migration |
| Branch-base contract (which commits Phase 1 inherits) | Any test fixture or Playwright config |
| Phase 1 data contracts, permission matrix, visual/a11y criteria, release plan | Any product-code cherry-pick from `proof/*` branches |

Every fact-claim below has been read from source in this planning worktree. Contradictions with the earlier draft are called out inline as **Correction**.

---

## 1. Verified architecture snapshot

Read from `apps/abr/**` and `packages/**` at commit `c191c5db3` (integration branch v2 tip). Every claim below was re-verified against this baseline on 2026-07-19.

### 1.1 Data model — matter IDs are **text**, not UUIDs

Source: [apps/abr/modules/incidents/service.ts](../../apps/abr/modules/incidents/service.ts)

```sql
create table if not exists abr_incidents (
  id text primary key,
  org_id text not null,
  ...
);
```

IDs are generated via `genId('inc')` → `` `inc_${Date.now()}_${randomBase36}` ``. Rows look like `inc_1732400512345_abc123`.

- **Correction (blocker #1 in the review):** The earlier draft's data contract typed matter IDs as `string (UUID)`. This is wrong. Phase 1 contracts must type them as `string (opaque, prefixed "inc_")` and Phase 1 routes must not attempt any `uuid()` parse on them.

### 1.2 Domain module surface

Source: [apps/abr/modules/incidents/matter-service.ts](../../apps/abr/modules/incidents/matter-service.ts), [apps/abr/modules/incidents/types.ts](../../apps/abr/modules/incidents/types.ts)

**Phase-1-relevant read-path exports** (unchanged from earlier Phase 0 draft):

- `listMatters(orgId): Promise<CourtLensMatter[]>`
- `getMatterDetail(orgId, matterId, options?: { role?; includeSensitiveNotes? }): Promise<{ matter, detail } | null>`
- `buildMatterDetailView(matter, detail, role: AbrRole): CourtLensMatterDetailView`
  - Return value already contains `legalBoundaryNotice: MATTER_LEGAL_BOUNDARY_NOTICE`.
  - Sensitive fields (`clientGoal`, `hearingDate`, `deadlineDate`, `riskFlags`, `clientProfile`) are gated by `canSeeEvidence && !canSeeAggregateOnly`.

**Additional exports on the v2 baseline (introduced by Gap 3 product commits) — out of Phase 1 scope but noted for completeness:**

- Types / validators: `CourtLensEventPayload`, `CourtLensValidationError`, `assertValidPracticeArea`, `assertValidSubIssue`, `assertValidRiskKeys`
- Field-level recorders: `deriveCourtLensFields`, `recordCourtLensFieldUpdate`, `recordAiSummaryStatusChanged`, `recordReferralStatusChanged`, `recordRiskFlagsUpdated`, `recordClientProfileUpdated`, `recordReviewPacketDrafted`, `recordReviewPacketApproved`
- Mutation surfaces: `createMatter`, `transitionMatterStatus`, `updateAiSummaryStatus`, `updateReferralStatus`, `CourtLensMatterCreateInput`
- Queue: `MatterQueueItem`, `toMatterQueueItem`, `listMatterQueueForOrg`
- View: `CourtLensMatterDetailView` (interface)

**Phase 1 posture:** Phase 1 does not call any of the mutation, recorder, or queue exports. It consumes only `listMatters`, `getMatterDetail`, and `buildMatterDetailView`. Adding a Phase 1 dependency on any of the additional exports requires an amendment to this contract.

`IncidentTimelineItem` shape (`types.ts`):

```ts
{ id: string; incidentId: string; happenedAt: Date; actorId: string; type: string; description: string; data?: Record<string, unknown>; }
```

- **Correction (blocker #4):** The earlier draft named a field `actorRole`. It does not exist. The actor's role is not stored on timeline rows; if Phase 1 needs role labels it must derive them by joining on `actorId → users.role`, and that join is not in scope for Phase 1.

### 1.3 Permission model

Source: [apps/abr/lib/rbac.ts](../../apps/abr/lib/rbac.ts), [apps/abr/lib/visibility.ts](../../apps/abr/lib/visibility.ts)

- `ABR_ROLES = ['super_admin', 'organization_admin', 'investigator', 'hr_lead', 'dei_lead', 'legal_counsel', 'executive_viewer', 'learner', 'auditor']`
- `hasPermission(role, permission)` is real.
- `'incident.read'` is a valid `AbrPermission`.
- Role-based redaction is enforced through `getIncidentVisibilityPolicy(role)` returning `{ canSeeAggregateOnly, allowedNoteScopes, canSeeSensitiveTimeline, canSeeEvidence }`.

### 1.4 Server page — the Phase 1 target surface

Source: [apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/page.tsx](apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/page.tsx)

- Server component (RSC), no `"use client"`.
- Imports auth from `@nzila/platform-auth/entra/server` and `@/lib/trusted-auth`; enforces `hasPermission(membership.role, 'incident.read')`.
- Resolves `orgId` from `?org=` query param then `process.env.ABR_DEMO_ORG_ID` then literal `'metro-university'`.
- Renders a `<dl>` with the matter summary + context fields.
- **Emits no `logAuditEvent` calls** — re-verified on v2 baseline: 0 hits for `logAuditEvent` in this file.

**Sibling files already present on v2 baseline (introduced by Gap 3 product commits):**

- `ReviewerActions.tsx` — reviewer state controls.
- `ReviewPacketExportControls.tsx` — review-packet export UI (calls the review-packet API route).
- `__tests__/ReviewerActions.test.tsx`, `__tests__/ReviewPacketExportControls.test.tsx`, `__tests__/pages.test.tsx`.

Phase 1 does not modify these files. Phase 1's three new components (`_ui/badges.tsx`, `RiskPanel.tsx`, `CaseTimelinePanel.tsx`) slot into the same directory and are imported into the existing `page.tsx`.

### 1.5 Read-audit doctrine — asymmetric, deliberately

Verified on v2 baseline (`apps/abr/app/api/**/route.ts` audit-call inventory):

| Route | `logAuditEvent` calls |
| --- | ---: |
| `api/courtlens/matters/[matterId]/route.ts` | 2 (incl. `action: 'courtlens.matter.viewed'`) |
| `api/courtlens/matters/route.ts` | 2 |
| `api/courtlens/matters/[matterId]/transition/route.ts` | 2 |
| `api/courtlens/matters/[matterId]/ai-summary-status/route.ts` | 2 |
| `api/courtlens/matters/[matterId]/referral-status/route.ts` | 2 |
| `api/courtlens/matters/[matterId]/review-packet/route.ts` | 9 |
| `api/courtlens/public-intake/route.ts` | 2 |
| `api/abr/incidents/**` | 12 (across five routes) |
| `app/[locale]/dashboard/courtlens/matters/[matterId]/page.tsx` | **0** |

**Phase 1 posture:** Preserve the asymmetry. Phase 1's new components (badges, RiskPanel, CaseTimelinePanel) render inside the server page, share its `matterDetailView`, and do not emit audit events. If a future phase needs page-view audit, it must be a deliberate, reviewed policy change, not a side effect of the badges refactor. In particular, Phase 1 must not import or reuse the recorder helpers in `matter-service.ts` (see §1.2) — those write audit rows and are reserved for the mutation surfaces.

### 1.6 Typography — ABR uses Poppins, not Inter

- Canonical `packages/ui/src/tokens.ts` declares `typography.fontSans = 'Inter'`.
- `apps/abr/app/layout.tsx` loads Poppins with `variable: '--font-poppins'`.
- `apps/abr/app/globals.css` uses `body { font-family: var(--font-poppins); }`.

This is an **intentional local override**, not a bug. All Phase 1 components must use `font-poppins` (via Tailwind class or `--font-poppins`) to stay consistent with the rest of ABR. Do not introduce `font-inter` classes.

### 1.7 Status color tokens — NOT wired into ABR

- `packages/ui/src/globals.css` defines `--color-status-ok`, `--color-status-info`, `--color-status-warning`, `--color-status-critical`, `--color-status-neutral` (plus `-soft` variants) in both light and dark scopes.
- `apps/abr/app/globals.css` does **not** import `@nzila/ui`'s `globals.css`. It defines its own token set (`--navy`, `--electric`, `--gold`, `--emerald`, `--coral`, `--violet`) plus shadcn HSL variables.

**Consequence:** Tailwind arbitrary classes like `text-status-critical` **do not resolve** in `apps/abr`. Phase 1 has two choices:

1. **Recommended:** Use existing ABR tokens (`text-coral`, `text-electric`, `text-emerald`, `text-gold`) for status colors. Zero new plumbing.
2. **Alternative:** Add an explicit `@import '@nzila/ui/globals.css';` at the top of `apps/abr/app/globals.css`. That is a cross-cutting UI change that touches every ABR route; treat it as its own PR ahead of Phase 1, not a Phase 1 change.

- **Correction (blocker #7):** The earlier draft's visual criteria referenced `text-status-critical` / `text-status-warning`. Those classes silently render as no-ops today. Rewritten in [Phase 1 visual & accessibility](#7-phase-1-visual-accessibility) below.

### 1.8 Feature-flag runtime — does not exist at the platform level

- Grepped `packages/**/src/**/*.ts` for `setFeatureFlag|isFeatureEnabled|listFeatureFlags`.
- Only match: `packages/zonga-control-plane/src/ai-controller.ts` — an in-memory `Map<string, boolean>` scoped to Zonga, not shared.
- `@nzila/os-core` has **no** feature-flag module.

**Consequence:** Any Phase 1 statement of the form "component X is behind flag Y" is a **missing dependency**, not an implementation detail. See [Phase 1 release plan](#8-phase-1-release-plan) for the concrete approach (env-var gate + code path split, no runtime flag service).

### 1.9 Telemetry — infrastructure exists, product contract does not

- `packages/os-core/src/telemetry/otel.ts`, `packages/otel-core/**`, `packages/governance-telemetry/**`, `packages/platform-event-fabric/src/analytics-bridge.ts` all provide OpenTelemetry-based telemetry infrastructure.
- **No product-level contract** exists for tenant-hashed page-view analytics of the shape `usage.pageView { orgIdHash, roleHash, page }`.

**Consequence:** Phase 1 will not emit product usage analytics. If maintainers want them, that's a separate design decision requiring a documented `usage.*` contract, tenant-hash algorithm, and consent posture — none of which exist today.

### 1.10 i18n message catalog — already partly populated

Source: [apps/abr/messages/en-CA.json](../../apps/abr/messages/en-CA.json) lines 113–220.

Existing `courtlens.*` sub-namespaces on `main`:

- `publicIntake.*` (form labels, framing text)
- `tenantQueue.*` (queue titles, row labels, access-denied variants)
- `matterDetail.*` (`backToQueue`, `subtitle`, `accessDenied*`, `sectionSummary`, `sectionContext`, `sectionRiskFlags`, `sectionClientProfile`, `sectionNotes`, `sectionLegal`, `fieldStatus`, `fieldPracticeArea`, `fieldSubIssue`, `fieldUrgency`, `fieldAiPacket`, `fieldReferral`, `fieldAssigned`, `fieldOpened`, `fieldClientGoal`, `fieldHearingDate`, `fieldDeadlineDate`, `fieldClientName`, `fieldHouseholdSize`, `fieldConsent`, `noRiskIndicators`)
- `reviewerActions.*`
- `errors.*`

**Phase 1 additions** will extend `courtlens.matterDetail` (badges, risk panel headings, timeline labels). No new top-level namespace is created.

### 1.11 Playwright / e2e — present on v2 baseline (via Gap 3 product commits)

Verified on v2 baseline (`apps/abr/`):

- `apps/abr/playwright.config.ts` — **exists** (introduced by product commit `353013d76`, originally `a622c8fbe`).
- `apps/abr/e2e/` — **exists**. Contents include `courtlens-review-packet.spec.mjs` (from product commit `0cc948a62`, originally `d7adb10ff`).
- `apps/abr/package.json` scripts include: `test`, `test:coverage`, `test:unit-integration`, `test:playwright:list`, `test:playwright:courtlens-gap3`.

**Phase 1 e2e posture (revised from v1):** Phase 1 no longer owns the "first Playwright install" work — the infrastructure is on the baseline. Phase 1 extends this by adding one Playwright spec for the badges + RiskPanel + timeline surface (name TBD by refactor branch). Phase 1 does NOT modify `playwright.config.ts`, `courtlens-review-packet.spec.mjs`, or the existing `test:playwright:*` scripts.

- **Correction (v2 revalidation):** The v1 draft's blocker #10 ("apps/abr/tests/e2e/** does not exist") was correct for pre-Gap-3 `main` but is now obsolete on the v2 baseline. `@axe-core/playwright` is still not in the workspace — Phase 1's accessibility validation remains a manual keyboard + screen-reader pass (see §7.3, §8.6).

---

## 2. Branch topology — what Phase 1 inherits

Full detail: [refactor-branch-base.json](refactor-branch-base.json) and file-level classifications in [gap3-product-commit-disposition.json](gap3-product-commit-disposition.json).

Summary (v3):

- **Refactor branch** `refactor/courtlens-from-legacy` will branch from `integration/courtlens-gap3-product-line-v2 @ c191c5db3` (rebuilt cleanly on `main @ 6b6d3736`).
- **Inherited product commits (7, chronological on the v2 integration branch):**

  | # | New SHA | Original SHA | Kind | Subject |
  | --- | --- | --- | --- | --- |
  | 1 | `555d47c1b` | `053ab0bce` | chore-tooling | chore(tools): Windows-safe lint-staged-eslint |
  | 2 | `d94ef09b1` | *(reconstructed)* | chore-security | chore(security): allowlist CourtLens e2e local-dev DB fingerprint |
  | 3 | `da734fcfa` | `d7adb10ff` → `0cc948a62` | feature | feat(abr): close CourtLens Gap 3 implementation (product only) |
  | 4 | `439800936` | `41e884a44` → `bf1f40de8` | fix | fix(abr): harden CourtLens review-packet audit persistence (product only) |
  | 5 | `6bade989d` | `a622c8fbe` → `353013d76` | fix | fix(abr): separate vitest/playwright runners and stabilize audit org resolution |
  | 6 | `0ebdccc7a` | `802f7834a` → `74bacc34a` | fix | fix(abr,audit): persist canonical hash timestamp and version for independent recomputation |
  | 7 | `c191c5db3` | `c5288b080` → `1d0388c25` | chore | chore(db): regenerate schema snapshot |

- **Excluded entirely (unrelated commit):** `f2188d74b` (replayed `2c8154e54`) — repairs pre-existing test failures in `apps/union-eyes` and `packages/sage-core` that are unrelated to CourtLens Gap 3. Bundling it would contaminate the CourtLens diff and mask the true workspace differential. See [gap3-product-commit-disposition.json](gap3-product-commit-disposition.json) `excludedCommits[]`.
- **Excluded (evidence-only) commits (3):** `c7d5318bb`, `42f145b4b`, `f526f9c9b` — see [refactor-branch-base.json](refactor-branch-base.json) `excludedEvidenceOnlyCommits` for per-commit reason. Their artifacts (`artifacts/courtlens-gap3-*/`, `reports/gap3*/`, `docs/gap3/`) are also blocked via `excludedRuntimeArtifactPaths`.
- **Excluded per-file paths from otherwise-inherited commits:** `apps/abr/scripts/courtlens-gap3-fixture.ts`, `apps/abr/scripts/__tests__/courtlens-gap3-fixture.test.ts`, `artifacts/courtlens-gap3-closure/**`, `artifacts/courtlens-gap3-fixture/**`, `docs/courtlens/phase-2/**` — see per-commit `excludedFiles[]` in [gap3-product-commit-disposition.json](gap3-product-commit-disposition.json).
- **Companion prerequisite branch** (retained on origin per no-branch-deletion rule): `chore/windows-lint-staged-fix` — the commit landed on the v2 integration branch as #1 above.

The refactor branch does **not** inherit `docs/gap3/**` or `docs/courtlens/phase-2/**` — those are Gap 3 evidence documents, not Phase 1 planning material.

---

## 3. Legacy inventory — deterministic generator

Source: [scripts/courtlens/build_legacy_inventory.py](../../scripts/courtlens/build_legacy_inventory.py). Tests in [scripts/courtlens/tests/](../../scripts/courtlens/tests/).

**Scope:** walks `Downloads/court-lens-ready-extracted/` for `.jsx` files, excluding `node_modules`, `dist`, `build`, `.next`, `coverage`, `.git`, `.turbo`, `__pycache__`.

**Verified numbers (from `docs/courtlens/legacy-inventory.manifest.json`):**

- `actualRowCount: 380`
- `expectedJsxCount: 340` (the historic plan claim)
- `scopeDelta: +40` — **the plan under-counted the legacy tree by 40 files.**
- `unreviewedCount: 156` (rows currently classified `review-required` — every one must be resolved by a human via the review ledger before Phase 1 opens).
- Disposition split: `port: 3`, `duplicate: 2`, `defer: 146`, `discard: 73`, `review-required: 156`.
- `csvBodySha256: 9668c0102676613bca8f43e166fc040506c34722466346cafcaa6b0cd590d261`.
- `legacyRootFingerprint: 56e42b0b568b59e40f1d5ddf701d70da0aa83ef3b139ac62227acd1284a29bb3`.

Every `port` row (n=3) has both `phase` and `targetPath`. Every non-`port` row has both empty. Enforced by `validate_rows` in the generator; no way to write a violating CSV.

**Determinism:** proven by regenerating into a scratch directory and byte-comparing the CSV. Both hashes matched (`C2F4…AF8D`). The `test_generate_is_deterministic` test also enforces this.

**Content-aware scans** on each file body:

- `usesBase44` (`\bbase44\b|from ['\"]@base44/`)
- `usesUpload` (`UploadFile|FileUploader|blob|multipart|FormData`)
- `usesAppLanguageContext` (`AppLanguageContext|useAppLanguage`)
- Aggregated `securityNotes` covers privilege/consent/retention terms and PII terms.

**Safety rule:** any file that does not match an explicit `_FILE_OVERRIDES` entry or a category default in the generator resolves to `review-required`. **A file can never silently become `discard`.**

**Sign-off gate:** the accompanying [legacy-inventory-review.json](legacy-inventory-review.json) contains one entry per CSV row (380 total, all `reviewed: false` today). Phase 1 open is gated on every entry being reviewed by a maintainer (see [Phase 1 release plan §8.5](#85-preflight-checks)).

---

## 4. Phase 1 scope — precisely enumerated

Phase 1 delivers three widgets and nothing else.

### 4.1 Includes

1. **`_ui/badges.tsx`** — three named exports:
   - `UrgencyBadge({ urgency: 'low' | 'medium' | 'high' | 'urgent' })`
   - `StatusBadge({ status: CourtLensMatterStatus })`
   - `AiSummaryBadge({ hasSummary: boolean; requiresReview: boolean })`
2. **`RiskPanel.tsx`** — renders `view.riskFlags: string[]` inside the existing "Risk indicators" `<section>`. Falls back to the existing `courtlens.matterDetail.noRiskIndicators` message when empty. Does not add a new section title.
3. **`CaseTimelinePanel.tsx`** — renders `view.detail?.timeline: IncidentTimelineItem[]` in reverse-chronological order. Read-only, no filtering, no expand/collapse. Applies role redaction via the already-computed `view` (which was built with the role).

All three files live under `apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/` and are imported into the existing `page.tsx`.

### 4.2 Explicitly excluded from Phase 1

| Feature | Why deferred |
| --- | --- |
| `EvidencePanel` / document upload | No `incident_documents` table exists on the v2 baseline. Needs schema + blob storage + antivirus. |
| `CommunicationPanel` / notes mutation | No note-write authorization contract exists for the refactor. |
| `ReviewerActions` extensions | Existing `ReviewerActions.tsx` already ships on baseline (§1.4). |
| `ReviewPacketExportControls` extensions | Existing `ReviewPacketExportControls.tsx` and `api/courtlens/matters/[matterId]/review-packet/route.ts` already ship on baseline (§1.4, §1.5). Phase 1 does not modify them. |
| `ReviewerPicker` / matter assignment | No `listReviewersForOrg` export on `matter-service.ts`. |
| `BulkActionBar` | No bulk-transition route exists. |
| Sortable `MatterTable` for the queue | Queue is a separate surface, not Phase 1. |
| Any new API route | Phase 1 is view-layer only. |
| Any new DB migration | No schema change. |
| Any new audit event | Preserves §1.5 asymmetry. |
| Read-path audit unification | Explicit non-goal; deliberate deferral. |
| Any mutation-recorder helper in `matter-service.ts` | `record*` helpers are reserved for the existing mutation surfaces. |

### 4.3 `CaseOverview.jsx` — the decision

The legacy `CaseOverview.jsx` renders status, practice area, sub-issue, urgency, AI packet, referral, assigned reviewer, and opened date in a labelled list. The existing [page.tsx](../../apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/page.tsx) already renders exactly the same `<dl>` via `view.status`, `view.practiceArea`, etc.

**Decision:** `duplicate`. Phase 1 does not add a `CaseOverview` component. The three widgets above slot into the existing page.

- **Correction (blocker #3):** The earlier draft left `CaseOverview.jsx` disposition undecided. Recorded above and in the inventory.

---

## 5. Phase 1 data contracts (verified)

Every contract below is expressed in terms of exports that exist in `main`.

### 5.1 View builder — no signature change

```ts
buildMatterDetailView(
  matter: CourtLensMatter,
  detail: CourtLensMatterDetail,
  role: AbrRole
): CourtLensMatterDetailView
```

Phase 1 does not change this signature or the returned shape. Badges/panels consume the existing fields.

### 5.2 Fields consumed by Phase 1 components

| Component | Field | Source | Notes |
| --- | --- | --- | --- |
| `UrgencyBadge` | `view.urgency` | `matter.urgency` | Enum. Copy from `courtlens.matterDetail.fieldUrgency`. |
| `StatusBadge` | `view.status` | `matter.status` | FSM value. Copy from `courtlens.matterDetail.fieldStatus`. |
| `AiSummaryBadge` | `view.aiPacket` | `matter.aiPacket` (redacted per role) | Suffix from `courtlens.matterDetail.fieldAiPacketDraftSuffix`. |
| `RiskPanel` | `view.riskFlags: string[] \| null` | Redacted by `applyIncidentRedaction` | Null when `canSeeAggregateOnly` or `!canSeeEvidence`. |
| `CaseTimelinePanel` | `view.detail.timeline: IncidentTimelineItem[]` | Existing (already returned by `getMatterDetail`) | Fields: `happenedAt`, `type`, `description`, `actorId`. No `actorRole`. |

### 5.3 Matter ID type — mandatory correction

```ts
type MatterId = string;   // opaque, prefix "inc_", not a UUID
```

Any Phase 1 code that parses or validates matter IDs must use `id.startsWith('inc_')` or a full regex `/^inc_\d+_[a-z0-9]+$/`, not `uuid.parse`.

---

## 6. Permission matrix

Roles from `ABR_ROLES` (§1.3). Permission gate on the server page is `hasPermission(role, 'incident.read')`; the page returns an access-denied UI otherwise. The redaction table below is what each role sees **inside** the Phase 1 components once the page is accessible.

| Role | Access to page | RiskPanel | Timeline entries | AI summary badge | Client PII (name, household) |
| --- | --- | --- | --- | --- | --- |
| `super_admin` | ✅ | full | full | full | visible |
| `organization_admin` | ✅ | full | full | full | visible |
| `investigator` | ✅ | full | full | full | visible |
| `legal_counsel` | ✅ | full | full | full | visible |
| `hr_lead` | ✅ | full | full | full | visible |
| `dei_lead` | ✅ | aggregate-only (empty flags) | redacted (`canSeeSensitiveTimeline=false`) | shown with draft suffix | hidden |
| `executive_viewer` | ✅ | aggregate-only | redacted | shown with draft suffix | hidden |
| `learner` | ❌ | — | — | — | — |
| `auditor` | ✅ | full | full | full | visible |

Source of truth: `getIncidentVisibilityPolicy(role)` in [apps/abr/lib/visibility.ts](../../apps/abr/lib/visibility.ts). Phase 1 components do not implement their own gating — they render only what `buildMatterDetailView` already exposes for that role.

---

## 7. Phase 1 visual & accessibility

### 7.1 Color tokens (ABR-native only)

- Urgency `urgent` → `text-coral` background chip.
- Urgency `high` → `text-gold`.
- Urgency `medium` → `text-electric`.
- Urgency `low` → `text-emerald`.
- Status open / in-progress → `text-electric`.
- Status closed / referred → `text-emerald`.
- AI summary draft → `text-gold` with `border-gold/30 bg-gold/10`.

**Rationale:** These are the tokens actually defined in [apps/abr/app/globals.css](../../apps/abr/app/globals.css). Using `text-status-*` classes (which live in `packages/ui/src/globals.css`) would silently no-op in ABR.

### 7.2 Typography

- Headings: `font-poppins font-semibold`.
- Body: default (`font-poppins` inherited from `<body>`).
- Do not introduce `font-inter` classes anywhere in Phase 1.

### 7.3 Accessibility criteria

- Every badge is a `<span>` with a `role="status"` and an accessible label matching the visible text.
- `RiskPanel` and `CaseTimelinePanel` render inside `<section aria-labelledby="…">` with the existing heading `id`.
- Empty states use polite messaging via the existing `courtlens.matterDetail.noRiskIndicators` key.
- Contrast: every color pairing above passes WCAG AA against `--navy` (the ABR page background). Verified by cross-referencing the token OKLCH values in `apps/abr/app/globals.css`.
- No keyboard traps, no `tabindex > 0`, no `outline: none` without a replacement `focus-visible` ring.
- Screen-reader semantics: timeline is an ordered list (`<ol>`) so entry order is announced.

### 7.4 Non-goals (a11y)

- Live-region announcements for status changes — not Phase 1 (no mutations).
- Keyboard-driven expand/collapse on timeline — not Phase 1 (no interactive controls).

---

## 8. Phase 1 release plan

### 8.1 Rollout mechanism (no feature-flag service)

- Phase 1 does **not** wrap components in a runtime feature flag.
- Instead, the refactor branch's PR 1 imports the three components inconditionally. Reviewers see the change surface directly.
- If a reviewer needs to disable Phase 1 in staging, the rollback is a `git revert` of the PR — this is the same pattern already used for CourtLens changes on `main`.
- **Rationale:** no `@nzila/os-core` feature-flag runtime exists (§1.8). Fabricating one for Phase 1 would be scope creep and would need its own tests + config surface.

### 8.2 i18n release gate

- Phase 1 adds ~12 new keys to `courtlens.matterDetail.*` in both `en-CA.json` and `fr-CA.json`.
- French copy is **draft**. It ships with the code (translations are not a separate deploy step in next-intl), but every new fr-CA value carries a `[FR-DRAFT]` prefix visible in the UI when the draft flag is set.
- **`[FR-DRAFT]` is a runtime-conditional UI badge**, not part of the translated string. Implementation: a small `<DraftBanner locale={locale} />` component in the section header, gated by `process.env.NEXT_PUBLIC_COURTLENS_FR_DRAFT === 'true'`. The string itself is a real translation.
- Every fr-CA row is tracked in [phase-1-fr-review-ledger.schema.json](phase-1-fr-review-ledger.schema.json). Rows are keyed by `keyPath` and store SHA-256 hashes of the en-CA and fr-CA values, not the strings themselves — cheaper diffs, harder to accidentally leak untranslated content into review PRs.

### 8.3 Telemetry — none

Per §1.9, Phase 1 emits **no** product analytics events. If the maintainers later approve a `usage.*` contract, adding page-view events is a follow-up PR.

### 8.4 Audit — preserved asymmetry

Per §1.5, Phase 1 emits **no** new `logAuditEvent` calls from server components. The existing `courtlens.matter.viewed` event fires only via the API route, which Phase 1 does not touch.

### 8.5 Preflight checks

| Gate | Command / Artifact |
| --- | --- |
| Inventory generator tests pass | `python -m pytest scripts/courtlens/tests` |
| Inventory CSV is deterministic | Regenerate → byte-compare against committed CSV |
| Every inventory row is reviewed | `legacy-inventory-review.json` → `unreviewedCount == 0` |
| Branch base is approved | `refactor-branch-base.json` → `maintainerApproval.state == "approved"` |
| Fr-CA ledger schema is approved | `phase-1-fr-review-ledger.schema.json` reviewed |
| Repo checks pass | `pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm validate:docs`, `pnpm governance:audit` |
| Hooks run normally | No `LEFTHOOK=0`, no `git commit --no-verify` |

### 8.6 Phase 1 test plan

- **Unit** (vitest, already available): one test file per new component. Snapshot + role-permutation coverage.
- **Integration** (vitest, server): `pages.test.tsx` (already present) extended with a case per role from §6.
- **E2E** (Playwright): Playwright infrastructure is already on the v2 baseline (§1.11). Phase 1 adds one new spec under `apps/abr/e2e/` for the badges + RiskPanel + timeline surface, and registers a new `test:playwright:phase1-view` script in `apps/abr/package.json`. It does not modify the existing `courtlens-review-packet.spec.mjs`, `playwright.config.ts`, or the existing `test:playwright:*` scripts.
- **Accessibility**: manual keyboard + screen-reader pass (voice-over / NVDA), documented in the PR description. No `@axe-core/playwright` in Phase 1 — adding it is a separate DevX PR.

---

## 9. Phase 1 fixture policy

- Phase 1 does **not** reuse `apps/abr/scripts/courtlens-gap3-fixture.ts`. That fixture was purpose-built for Gap 3 audit-chain proof and lives on `proof/courtlens-gap3-final`.
- Phase 1 will define its own fixture at `apps/abr/scripts/courtlens-phase1-fixture.ts` (created in the refactor branch, not here). Contents: three matters (open/in-progress/closed), one timeline entry each, one riskFlag on the open matter, no PII beyond synthetic names.
- Fixture cleanup is a Phase 1 sub-task with its own DB assertions ("no `court%` rows remain post-run").

---

## 10. Deliverables produced by this Phase 0

Committed on `docs/courtlens-refactor-phase0-v3`:

- [docs/courtlens/refactor-plan.md](refactor-plan.md) — this file.
- [docs/courtlens/refactor-branch-base.json](refactor-branch-base.json)
- [docs/courtlens/gap3-product-commit-disposition.json](gap3-product-commit-disposition.json)
- [docs/courtlens/legacy-inventory.schema.json](legacy-inventory.schema.json)
- [docs/courtlens/legacy-inventory.csv](legacy-inventory.csv)
- [docs/courtlens/legacy-inventory.manifest.json](legacy-inventory.manifest.json)
- [docs/courtlens/legacy-inventory-review.json](legacy-inventory-review.json)
- [docs/courtlens/legacy-inventory-review.schema.json](legacy-inventory-review.schema.json)
- [docs/courtlens/phase-1-fr-review-ledger.schema.json](phase-1-fr-review-ledger.schema.json)
- [scripts/courtlens/build_legacy_inventory.py](../../scripts/courtlens/build_legacy_inventory.py) — bumped to `0.2.0`; adds `dispositionMatrix` (incl. `phase1PortCandidates`) to the manifest.
- [scripts/courtlens/build_review_ledger.py](../../scripts/courtlens/build_review_ledger.py) — new; emits `phase1Metrics` (`phase1PortCandidates`, `phase1Reviewed`, `phase1Approved`, `phase1Unresolved`) as a strict subset of `rowCount`.
- [scripts/courtlens/tests/test_build_legacy_inventory.py](../../scripts/courtlens/tests/test_build_legacy_inventory.py)
- [scripts/courtlens/tests/test_build_review_ledger.py](../../scripts/courtlens/tests/test_build_review_ledger.py)
- [scripts/courtlens/__init__.py](../../scripts/courtlens/__init__.py)
- [scripts/courtlens/tests/__init__.py](../../scripts/courtlens/tests/__init__.py)
- [scripts/courtlens/tests/conftest.py](../../scripts/courtlens/tests/conftest.py)

Not committed (build artifacts):

- `.scratch/regen/**` — used for the deterministic-regeneration proof; git-ignored.
- `reports/phase0/**` — validation logs (see [§11](#11-validation-runs)).

---

## 11. Validation runs

Captured in `reports/phase0/`.

| Check | Result |
| --- | --- |
| `python -m pytest scripts/courtlens/tests -v` | 43/43 passing on v3 — see [reports/phase0/pytest.log](../../reports/phase0/pytest.log) |
| Regenerate CSV twice, compare SHA-256 | Byte-identical: `csvBodySha256 = 9668c0102676613bca8f43e166fc040506c34722466346cafcaa6b0cd590d261`, `legacyRootFingerprint = 56e42b0b568b59e40f1d5ddf701d70da0aa83ef3b139ac62227acd1284a29bb3` (rowCount = 380, generatorVersion `0.2.0`) |
| Inventory disposition matrix | `total=380, port=3, defer=146, discard=73, duplicate=2, reviewRequired=156, phase1PortCandidates=3`. **Phase 1 candidates are 3, not 380.** |
| Review-ledger `phase1Metrics` | `{ phase1PortCandidates: 3, phase1Reviewed: 0, phase1Approved: 0, phase1Unresolved: 3 }`. |
| `pnpm validate:docs` | See [reports/phase0/validate-docs.log](../../reports/phase0/validate-docs.log) |
| `pnpm ownership:audit` | Regenerated on v3 — see [docs/ops/ownership-registry.md](../ops/ownership-registry.md) and [reports/ownership-registry.json](../../reports/ownership-registry.json) |
| `pnpm docs:index` | Regenerated on v3 — see [docs/documentation-index.md](../documentation-index.md) and [reports/documentation-index.json](../../reports/documentation-index.json) |
| `pnpm governance:audit` | See [reports/phase0/governance-audit.log](../../reports/phase0/governance-audit.log) |
| `pnpm exec tsx scripts/link-check.ts docs/courtlens/refactor-plan.md` | All links valid |
| `pnpm test:fast` | See [reports/phase0/test-fast.log](../../reports/phase0/test-fast.log). Failures unrelated to CourtLens (union-eyes / sage-core) are reported as differential, NOT re-added to this branch. |
| Contract tests | Ran via pre-push hook (see [reports/phase0/contract-tests.log](../../reports/phase0/contract-tests.log)) |
| Scope diff (v3 vs integration branch v2) | See [reports/phase0/scope-report.json](../../reports/phase0/scope-report.json) — `reconciliation: RECONCILED`; includes `controlledExclusions`, `gitDiffFileCount`, `githubPrFileCount` |
| Lefthook | Ran with hooks enabled (no `LEFTHOOK=0`, no `--no-verify`) |

---

## 12. Open items for maintainer decision

1. **Approve the branch-base contract.** `refactor-branch-base.json` → `maintainerApproval.state`. Set to `approved` with reviewer name + timestamp before Phase 1 opens.
2. **Approve the CourtLens Phase 0 v3 review PR.** This branch (`docs/courtlens-refactor-phase0-v3`) supersedes v1 (`docs/courtlens-refactor-phase0` @ `70b327b81`) and v2 (`docs/courtlens-refactor-phase0-v2` @ `c2cbf9eb3`). v1 and v2 must NOT be re-opened. Superseded branches remain on the remote as forensic references per the no-branch-deletion rule.
3. **Sign off `docs/courtlens/legacy-inventory-review.json`.** The ledger contains 380 entries, of which **3 are Phase 1 candidates** (`proposedDisposition == 'port' && proposedPhase == '1'`). Every Phase 1 candidate must have `reviewed=true`, `reviewer`, `reviewedAt`, `notes`, and matching `approvedDisposition`/`approvedPhase`/`approvedTargetPath` before Phase 1 opens. Current `phase1Metrics`: `{ phase1PortCandidates: 3, phase1Reviewed: 0, phase1Approved: 0, phase1Unresolved: 3 }`.
4. **Land the companion tooling PR.** `chore/windows-lint-staged-fix` is a prerequisite Windows-safety fix; land it on `main` independently of Phase 0 v2.
5. **Status-token strategy.** Either accept §7.1 (ABR-native tokens) or fund a preceding "wire `@nzila/ui/globals.css` into ABR" PR before Phase 1 opens.
6. **French translations.** Confirm the `[FR-DRAFT]` runtime banner approach in §8.2 is acceptable, or specify an alternative (parallel `fr-CA.draft.json` file, etc.).
