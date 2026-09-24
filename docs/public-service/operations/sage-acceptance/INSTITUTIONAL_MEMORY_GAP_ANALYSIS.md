# Institutional Memory gap analysis — SAGE vs Leadership Transition pattern

**Date:** 2026-09-23 (America/Toronto)  
**Main SHA context:** `ff98963758de37255ae20cd13433c4c3b8a384b7` (+ branch `civic/omhra-pilot-readiness` changes)  
**Pattern:** reusable Leadership Transition / Institutional Memory (OMHRA = example first case only)

## 1. Can SAGE express decision history?

| Need | SAGE today | Gap |
| --- | --- | --- |
| Human decision + rationale | `SageDecisionRecord` (`decision`, `rationale`, `uncertainty`, `humanReviewerId`) | **Supported** |
| References to evidence items | `referencedEvidenceItemIds: string[]` | **Supported** (ids only) |
| References to boundary flags | `referencedBoundaryFlagIds` | **Supported** |
| Authorization inheritance | `authorizationLevel` + `authorizationBasis` | **Supported** |
| Non-disclosure when evidence inaccessible | list/get paths + export scope resolution | **Supported** in services |
| Claim → evidence → **source** → **date** → **authority** as a first-class chain | Partial | **Gap**: evidence *items* do not carry human-readable claim text, source title, or “authority” actor beyond `createdBy` / classification fields; source has `sourceType`/`authorizationLevel` but not a dedicated “authority” enum; **no first-class event date** on `SageEvidenceItem` (only `createdAt`/`updatedAt`) |

### Practical reading

SAGE can store a **decision record** that points at evidence item ids and inherits authorization. Reconstructing “why choose B / what changed / what unresolved” for a continuity pilot requires:

1. Registering evidence sources/items with classification, and  
2. Putting narrative claim/date/authority into **governed notes / decision rationale / external registers** (CLEAR templates), and/or  
3. Future optional metadata fields (not implemented this pass to avoid schema churn without migration proof).

**This pass:** fixtures encode the chronology externally (`fixtures/leadership-transition-institutional-memory/chronology-2022-2026.json`) and tests enforce authorization-before-context. No new DB migration shipped.

## 2. Synthesis / retrieval

| Need | Status |
| --- | --- |
| Generative AI stack in sage-core | **Absent** (intentional) |
| Authorization-before-context filter | **Added**: `packages/sage-core/src/synthesis-context.ts` + tests |
| DO_NOT_REGRESS leak tests | **Added** (same-tenant allow/deny, cross-workspace, cross-tenant, revoked grant, mixed) |

Any future model path **must** call `buildAuthorizedEvidenceContextPayload` before prompt assembly.

## 3. Authz / audit / idempotency inventory (mandate §5 lens)

| Concern | Existing evidence | Gaps |
| --- | --- | --- |
| Authorization / tenant isolation | `access-model.ts` + tests; `services.ts` authorize*; `records-live-postgres.test.ts` RLS; services non-disclosure tests | Live staging RLS for SAGE tables still blocked on B-005 |
| Auditability | `audit-events.ts` + tests; durable outbox types; platform-admin `audit-adapter.ts` | Deployed audit sink proof = G12/B-001 |
| Idempotency | `apps/platform-admin/lib/sage/__tests__/idempotency.test.ts`; delivery/outbox crash recovery tests | Keep covering new mutation paths as added |
| Synthesis safety | **New** synthesis-context | No production synthesizer yet — filter is the primitive |

## 4. Member365 / LRIS / HRIS

| Item | Status |
| --- | --- |
| Build integrations this pass | **Out of scope** (per mandate) |
| Existing adapter boundary | platform-admin uses **server-only adapters** (`sql-adapter`, `audit-adapter`, `delivery-notifier-adapter`, `records-storage-adapter`) — pattern to copy |
| Minimal reusable design (sketch only) | A future `EvidenceImportAdapter` port: `{ listSources(), fetchAuthorizedBundle(principal) }` → candidates → **must** pass `buildAuthorizedEvidenceContextPayload`. Member365/LRIS would be one adapter implementation behind that port, never inlined into `sage-core`. |

## 5. Role mapping gap

Institutional roles (outgoing/incoming ED, board, auditor) are **not** native `SageApplicationRole` values. They map via reference-config `institution-workspace.yaml` onto existing SAGE roles + evidence grants. Acceptable for v1; avoid prospect-specific role enums in core.

## 6. What would unblock a richer chain (optional future)

1. Optional `occurredAt` / `authorityActorId` / `claimSummary` on evidence items **or** a side table `sage_evidence_annotations` (migration + RLS).  
2. CLEAR register export that syncs into SAGE sources without bypassing authorization.  
3. Proof-run 006 after B-005 deploy.

## 7. Implemented this pass vs documented only

| Item | Action |
| --- | --- |
| synthesis-context filter + tests | **Implemented** |
| Reference-config + fictional fixtures | **Documented / data only** |
| Claim/date/authority columns | **Documented gap only** |
| Member365/LRIS | **Sketch only** |


## 8. Phase 3 update (2026-09-23)

| Item | Status |
| --- | --- |
| `claim-chain.ts` + `institutional-context.ts` | **Implemented** (migration-free register) |
| Wired choke into `listSageEvidenceItems` + export package generate + API | **Implemented** |
| First-class DB columns for occurredAt/authority | Still optional future — register covers pilot Q&A |
| DEMO_PATH | `reference-configs/.../DEMO_PATH.md` |
