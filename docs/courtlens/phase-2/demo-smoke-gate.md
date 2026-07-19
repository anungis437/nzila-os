# CourtLens Demo Smoke Gate — Phase 2G

## Purpose

The no-external-demo-until-passed gate for CourtLens Phase 2. This document is the single source of truth for whether an external stakeholder demo may proceed. Every criterion is a hard gate. Any single failure blocks external demo.

## Scope

- Phase 2A–2F CourtLens surface only.
- Public intake, tenant matter queue, tenant matter detail, reviewer workflow controls.
- Both the read paths (queue, detail) and the write paths (public intake, AI packet status, referral status, matter status transition).

## Demo Environment Assumptions

- `NODE_ENV !== 'production'` OR `NODE_ENV === 'production'` with all env-gated dev fallbacks explicitly unset.
- `ABR_ALLOW_HEADER_ROLE` unset (or explicitly `false`).
- `ABR_ALLOW_UNVERIFIED_ORG` unset (or explicitly `false`).
- `abr_users` populated (in DB mode) with real `(userId, orgId, role)` triples matching authenticated demo users.
- Or in-memory mode active with `DEMO_ORGS` / `DEMO_USERS` seed used only for internal walkthroughs.
- `POST /api/*` requests must include `Idempotency-Key` (enforced by `apps/abr/proxy.ts`).

## Test Accounts and Role Assumptions

- Reviewer persona → maps to `investigator` or `organization_admin` role.
- Executive persona → maps to `executive_viewer` (aggregate/redacted only).
- No demo persona uses `super_admin` for the public walkthrough.
- No demo persona is a real client. All personas are synthetic.

## Synthetic-Only Data Rule

- No real client names, contact information, court file numbers, or case facts.
- All submitted intakes during demo must use fabricated scenarios.
- Any accidental real-data submission voids the demo and requires cleanup.

## Legal-Boundary Checklist

| Check | Status |
|---|---|
| Public intake page shows "not legal advice" copy at top | PASS (Phase 2F test) |
| Public intake page shows "supervised human review" copy | PASS |
| Public intake page shows "no AI-generated legal opinion" copy | PASS |
| Consent checkbox required before submit is enabled | PASS (Phase 2F test) |
| Public confirmation carries server `legalBoundaryNotice` verbatim | PASS |
| Tenant matter queue shows "operational status only. It is not legal advice." | PASS (Phase 2D) |
| Tenant matter detail shows `legalBoundaryNotice` from `buildMatterDetailView` | PASS (Phase 2D + 2C.6) |
| AI packet non-approved states labelled "draft — not for external use" | PASS |
| No UI copy claims eligibility, outcome, or legal advice | PASS by construction |
| **Counsel review of all customer-facing legal-boundary copy** | **PENDING — human review required** |

## Tenant-Isolation Checklist

| Check | Status |
|---|---|
| Public intake API resolves `tenantSlug` via `verifyAbrOrgMembership` chain | PASS (Phase 2B/2C.6) |
| Unknown/malformed `tenantSlug` returns generic error (no leak) | PASS (Phase 2F test) |
| `listMatterQueueForOrg(orgId)` returns only that org's matters | PASS (Phase 2C test) |
| `getMatterDetail(orgId, matterId)` returns null for cross-tenant lookup | PASS (Phase 2C test) |
| Detail API returns 404 (not 403) for cross-tenant matter — no existence leak | PASS (Phase 2C.5 route test) |
| Cross-tenant matter never appears in queue after public intake | PASS (Phase 2G smoke test) |
| Public confirmation never exposes internal `orgId` | PASS (Phase 2F test) |
| Raw event `payloadJson` never rendered in UI | PASS (Phase 2D test) |

## Idempotency Checklist

| Check | Status |
|---|---|
| Proxy enforces `Idempotency-Key` on all non-dev `POST /api/*` | PASS (proxy.ts) |
| `createIdempotencyKey()` helper generates fresh UUIDs | PASS (Phase 2E.5 test) |
| `ReviewerActions.tsx` sends `Idempotency-Key` on every mutation | PASS (Phase 2E.5 tests) |
| `PublicIntakeForm.tsx` sends `Idempotency-Key` on submit | PASS (Phase 2F test) |
| Sequential mutations produce distinct keys | PASS (Phase 2E.5 test) |
| No client mutation POST is missing the header | PASS (audit + tests) |

## Verified-Auth Checklist

| Check | Status |
|---|---|
| `x-abr-role: super_admin` in production is IGNORED | PASS (Phase 2C.6 test) |
| `ABR_ALLOW_HEADER_ROLE=true` in production is IGNORED | PASS (Phase 2C.6 test) |
| `x-org-id` non-member org is rejected 403 `ORG_MEMBERSHIP_REQUIRED` | PASS (Phase 2C.6 test) |
| Inactive user rejected fail-closed | PASS (Phase 2C.6 test) |
| CourtLens routes use `requireVerifiedOrgAccess` / `requireVerifiedPermission` | PASS (Phase 2C.6 migration) |
| CourtLens UI never sends `x-abr-role` or `x-org-id` | PASS (Phase 2D + 2E + 2F tests) |
| Human-only AI packet approval enforced server-side | PASS (Phase 2E service + test) |
| Legacy `/api/abr/incidents/*` migrated to verified guards | **PENDING** — legacy incidents still use non-verified guards. **Not in the CourtLens demo path.** |

## Accessibility Quick-Check

| Check | Status |
|---|---|
| Public intake form uses native `<label>` / `<select>` / `<input>` controls | PASS |
| All form controls have associated labels via `htmlFor` | PASS |
| Consent checkbox has visible label | PASS |
| Error state uses text (not colour alone) | PASS |
| Submit button has clear disabled state | PASS |
| **Formal WCAG 2.1 AA audit** | **PENDING** — required before external demo |
| Keyboard-only navigation smoke | **PENDING** — required before external demo |
| Screen reader smoke (VoiceOver or NVDA) | **PENDING** — required before external demo |

## Bilingual-Readiness Status

- Message catalogs: `apps/abr/messages/en-CA.json` and `apps/abr/messages/fr-CA.json` exist.
- CourtLens namespace (`courtlens.*`) added to both catalogs in Phase 2H.
- All CourtLens UI (public intake page, form, tenant matter queue, matter detail, reviewer actions) migrated to `useTranslations`/`getTranslations`.
- Bilingual parity regression test in [apps/abr/messages/__tests__/bilingual-parity.test.ts](../../../apps/abr/messages/__tests__/bilingual-parity.test.ts) enforces:
  - Every EN `courtlens.*` key has a matching FR key (and vice versa).
  - No empty FR strings.
  - FR legal-boundary framing carries the explicit "n'est pas un avis juridique" denial.
- FR-CA UI copy status: **PRESENT**. Requires counsel review before external demo — see [legal-boundary-copy-review-packet.md](legal-boundary-copy-review-packet.md).
- Server-side legal notices (`LEGAL_BOUNDARY_NOTICE` in `public-intake.ts`, `MATTER_LEGAL_BOUNDARY_NOTICE` in `matter-service.ts`) are still EN-only. Documented as a remaining item if the demo audience requires FR public confirmation.
- Pre-existing gap closed: `abrDashboard.*` namespace was referenced in dashboard pages but not present in either catalog. Phase 2H added it to both.

## Pass/Fail Criteria

### Automated (all currently PASS)
- Full `@nzila/abr` test suite: **297/297** across 20 test files.
- `pnpm --filter @nzila/abr typecheck`: clean.
- `pnpm validate:docs`: 0 errors.
- End-to-end smoke test in `modules/incidents/__tests__/smoke-e2e.test.ts` passes: intake → queue → detail → role-gated redaction → AI approval (with forge attempt rejected) → full referral chain → FSM advance → cross-tenant isolation.

### Human/manual (must be completed by demo owner before external walkthrough)
- Counsel review of customer-facing legal-boundary copy on `PublicIntakeForm`, `MatterQueue`, `MatterDetail`, and `ReviewerActions`.
- WCAG 2.1 AA audit + keyboard + screen reader smoke.
- FR-CA translation for every CourtLens UI string.
- Live end-to-end smoke test performed by demo owner against a running demo environment.
- Synthetic-data-only verification: confirmation that no real-client PII is present in the demo tenant.

## Live Smoke Sequence (Manual)

To be performed against a running demo environment before external stakeholder demo:

1. Open `/en-CA/courtlens/t/{demo-tenant-slug}/intake`.
2. Confirm legal-boundary framing visible at top.
3. Fill valid housing intake (fabricated scenario). Attempt submit without consent — verify button disabled. Check consent. Submit.
4. Confirm safe confirmation page renders with `matterId`, status label, `legalBoundaryNotice`. Confirm no `orgId`, no AI content, no reviewer notes.
5. Sign in as reviewer persona. Set `x-org-id: {demo-tenant-slug}` at the browser/proxy layer (server-verified).
6. Open `/en-CA/dashboard/courtlens/matters`. Confirm the new matter appears in the queue with correct practice area, sub-issue, urgency.
7. Open the matter detail. Confirm role-appropriate fields visible (risk flags, client profile for investigator).
8. Click "needs_verification". Confirm state updates after refresh.
9. Click "approved". Confirm state advances; `isPacketExternalizable` becomes true.
10. Advance referral status through `suggested → approved → sent → completed`. Confirm each step persists.
11. Advance matter FSM through `triage → assigned → investigating`. Confirm each step persists.
12. Sign in as executive_viewer persona in the same tenant. Confirm risk flags, client profile, client goal, hearing date, deadline date all null/hidden.
13. Attempt to open a matter from another demo tenant by URL. Confirm 404 with generic message.
14. Confirm all reviewer POSTs in browser devtools include `Idempotency-Key` and do NOT include `x-abr-role`.

Any step failing = smoke test FAIL = demo blocked.

## Final Demo Readiness Verdict

**YELLOW — internal-only demo allowed, external stakeholder demo blocked.**

### What is proven
- The full technical value chain works end-to-end (automated smoke test passes).
- Tenant isolation, verified authorization, idempotency, human-only approval, and legal-boundary redaction all pass automated tests.
- CourtLens surface is safe for internal walkthroughs and QA sessions.

### Blockers before GREEN (external stakeholder demo allowed)
1. **Counsel review of all customer-facing legal-boundary copy** — a formal review packet exists at [legal-boundary-copy-review-packet.md](legal-boundary-copy-review-packet.md); the sign-off table is not yet completed by counsel. Required before public exposure.
2. ~~**FR-CA bilingual copy**~~ — closed in Phase 2H. FR-CA catalog present for all CourtLens UI. Server-side legal notices remain EN-only; only a blocker if the demo audience requires FR public confirmation text.
3. **WCAG 2.1 AA audit** — no formal audit yet. Required for accessibility-focused stakeholders.
4. **Live manual smoke sequence execution** — the 14-step sequence above must be performed by the demo owner against a running environment. Automated smoke covers the service layer but not real browser/network/proxy interaction.
5. **Synthetic-data-only verification** — must be confirmed against the actual demo environment tenant.

### Non-blocking notes
- Legacy `/api/abr/incidents/*` routes still use non-verified guards. Not in the CourtLens demo path. Migrate before those routes ship to public production traffic.
- N+1 event replay in queue list is unchanged. Deferred until proven blocker.
- Document upload UI, status check page, and note authoring UI are out of Phase 2 scope. Not blockers for a scoped demo, but must be declared as out-of-scope in the demo talk track.

### If any blocker is not resolved
- External stakeholder demo remains blocked.
- Internal demos (Nzila team, controlled QA) may proceed against the demo environment.
- Do not soften any blocker to a "known limitation" for external audiences.

## Related

- [Public intake UI](public-intake-ui.md)
- [Tenant matter UI](tenant-matter-ui.md)
- [Reviewer workflow UI](reviewer-workflow-ui.md)
- [Tenant matter queue API](tenant-matter-queue-api.md)
- [Pilot readiness plan](../pilot-readiness-plan.md)
