# Phase 4 — Institutional Observability Audit

> Companion to: `phase3-architecture-audit.md`, `phase2-projection-implementation-report.md`, `governance-graph-audit.md`.
> Scope: read-only inventory and convergence plan for institutional chronology, evidence lineage, continuity intelligence, and governance-safe observability surfaces.
> Doctrine: additive, read-only, governance-safe, constitutionally neutral. **No** automation, surveillance, behavioural analytics, predictive overlays, influence ranking, or exposure of protected governance mechanics.

---

## 0. Purpose

Phase 4 advances the Institutional Governance Graph (IGG) from "isolated governance projection primitives" toward an **explainable institutional chronology infrastructure** that can answer:

> *"How did this institutional state emerge?"*

…not:

> *"How do we optimize institutional behaviour?"*

This audit identifies (a) what chronology / evidence / continuity material **already exists implicitly** across the monorepo, (b) where it remains disconnected, (c) what convergence is governance-safe, and (d) what **must remain forbidden** to preserve constitutional neutrality and protected fences (Class B, Reserved Matters, Golden Share progression, vetoes, overrides, holds).

---

## 1. Scope of Inventory

Source material reviewed (read-only):

- `packages/institutional-governance-graph/` — full Phase 1–3 surface (ontology, projection, governance modules: `protected.ts`, `chronology.ts`, `queries.ts`).
- `packages/platform-governance/` — `auditTimeline.ts`.
- `packages/platform-ontology/` — substrate types (decision/event/entity).
- `packages/ai-registry/src/governance-lifecycle.ts` — replay-style state projection + role-gated transitions.
- `packages/ue-assistant/src/audit.ts` — hash-chained assistant audit log.
- `apps/union-eyes/` — governance APIs, evidence pack pipeline, audit logs, case timelines, continuity narratives, voting evidence, signature audit, pilot governance, institutional continuity surfaces.
- `apps/control-plane/lib/audit-db.ts`, `lib/governance-experience/sample-readings.ts`, `lib/demoSeed.ts`.
- `apps/flow/lib/platform-adapters/evidence-adapter.ts`.
- `tooling/staging-certification/phase6-union-workflow.cert.ts`.
- Doctrine docs under `docs/categories/products-and-market/{union-eyes,nzila-assurance}/...` and `docs/nzila-runtime-integrity/`.

---

## 2. Inventory by Category

### 2.1 Existing Chronology / Timeline Surfaces

| Surface | Location | Today's Role | Phase 4 Convergence |
|---|---|---|---|
| Decision chronology (IGG) | `packages/institutional-governance-graph/src/governance/chronology.ts` | `orderDecisionsChronologically`, `chronologyForEntity`, `lineageChain` (SUPERSEDES/OVERRIDES walk) | Becomes the **canonical chronology kernel**; everything else converges into it. |
| Audit timeline (platform) | `packages/platform-governance/src/auditTimeline.ts` | Filters/sorts heterogeneous audit events into governance timelines | Adapter → IGG `ChronologyEntry` (read-only). |
| Case timeline (UE) | `apps/union-eyes/app/[locale]/dashboard/member/timeline/[caseId]/page.tsx` | Sequential case transitions / notes / determinations | Stays case-scoped; **does not** ingest IGG protected kinds. Optional convergence: render IGG `chronologyForEntity` alongside case events when a case is institutionally linked. |
| Activities / system event lineage | `apps/union-eyes/app/api/activities/route.ts` | Read-only listing from `audit_security.audit_logs` | Adapter source for `buildInstitutionalTimeline` (governance-relevant rows only, redaction via `redactProtected`). |
| Governance events stream | `apps/union-eyes/app/api/governance/events/route.ts` | Streams formal board/council events | Source for `governanceEpochTimeline`. |
| Sample governance readings | `apps/control-plane/lib/governance-experience/sample-readings.ts` | Reference structure for heterogeneous timeline entries | Reference shape for `buildInstitutionalTimeline` output. |
| AI registry replay | `packages/ai-registry/src/governance-lifecycle.ts` | Replays event history to project current state | **Not** ingested — domain-specific to AI governance, kept separate. |

### 2.2 Existing Evidence Surfaces

| Surface | Location | Role | Convergence |
|---|---|---|---|
| Evidence pack builder | `apps/union-eyes/lib/evidence.ts` (bridge to `@nzila/os-core`) | Build / seal (HMAC-SHA256) / upload | Source for `evidenceChronology` — read refs, never re-seal. |
| Case export | `apps/union-eyes/app/api/cases/[caseId]/export/route.ts` | Sealed JSON/PDF evidence package | Read-only consumer; surfaces evidence refs back to IGG `DecisionNode.evidenceRefs`. |
| Voting evidence | `apps/union-eyes/app/api/voting/sessions/[id]/vote/route.ts`, `apps/union-eyes/app/api/voting/sessions/route.ts` | Implicit evidence emission per vote / session | Already the primary substrate for `MOTION_OUTCOME` decisions; Phase 4 only **reads** the resulting evidence refs. |
| Signature audit | `apps/union-eyes/app/api/signatures/audit/[documentId]/route.ts` | Tamper-check / verification history | `evidenceChronology` source for documents tied to decisions. |
| Flow evidence adapter | `apps/flow/lib/platform-adapters/evidence-adapter.ts` | Exports domain events as compliance artifacts | Out-of-scope substrate — not ingested by IGG (different bounded context). |

### 2.3 Existing Audit / Decision-History Surfaces

| Surface | Location | Role | Convergence |
|---|---|---|---|
| Hash-chained audit ledger | `apps/control-plane/lib/audit-db.ts` | Tamper-evident org action log; constants for `MEMBER_ROLE_CHANGE` etc. | Read-only adapter source; never mutated. |
| Document audit trail | `apps/union-eyes/db/schema/domains/documents/correspondence.ts` | Immutable chain of custody (schema only) | Source for `lineageEvidenceRefs` for document-bearing decisions. |
| Assistant audit | `packages/ue-assistant/src/audit.ts` | Hash-chained AI interaction log | **Excluded** from IGG (assistant ≠ institutional decision actor). |
| Audited case mutations | `apps/union-eyes/lib/audited-case-mutations.ts` | Enforces audit logging on critical case ops | Already produces the substrate `audit_logs` row used by §2.1 adapter. |

### 2.4 Existing Continuity / Membership / Representation Surfaces

| Surface | Location | Role | Convergence |
|---|---|---|---|
| `ContinuityTimeline` (UE landing) | `apps/union-eyes/app/[locale]/page.tsx` | Read-only narrative of steward transitions | Optional consumer of `representationTimeline` once Phase 4 utilities land. |
| Institutional continuity page | `apps/union-eyes/app/[locale]/institutional-continuity/page.tsx` | Narrative surface for institutional memory | Primary candidate for governance-safe Phase 4 surface (deferred to gated approval). |
| Pilot governance page | `apps/union-eyes/app/[locale]/pilot-governance/page.tsx` | Pilot legitimacy / stabilization windows | Independent — does not converge. |
| Pilot readiness API | `apps/union-eyes/app/api/pilot/readiness/route.ts` | Continuity posture gate | Independent. |
| Lineage/clc copy | `apps/union-eyes/messages/*.json` (`clcCupeLineageNote`, hierarchy notes) | Localization for institutional lineage | Reused by `phase4-implementation-report.md` copy. |
| IGG affiliations projection | `packages/institutional-governance-graph/src/projection/affiliations.ts` | AFFILIATED_WITH edges | Already first-class — Phase 4 builds `continuityCohort`-derived breakpoints on top. |
| IGG representation projection | `packages/institutional-governance-graph/src/projection/representation.ts` | REPRESENTS / TENURED_AS edges | Source for `representationGaps`. |

### 2.5 Existing Lineage / Supersedes Semantics

| Surface | Location | Role | Convergence |
|---|---|---|---|
| IGG `lineageChain` | `governance/chronology.ts` | Walks SUPERSEDES/OVERRIDES on decisions | Already canonical — Phase 4 wraps it in `timelineForDecision` and `governanceEpochTimeline`. |
| Doctrine: append-only / superseding records | `docs/categories/products-and-market/nzila-assurance/governance-evidence-pipeline-architecture.md` | Architectural rule | Confirms doctrine alignment; no code change. |
| Evidence traceability doctrine | `docs/categories/historical-archive/.../governance-evidence-ledger.md` | Forward-to-certifications, backward-to-source | Confirms `lineageEvidenceRefs` design direction. |
| Payroll parent-linked chain | `docs/.../union-eyes/employer-execution/architecture.md` | Implementation pattern for chained official runs | Out of IGG scope; referenced for doctrine consistency only. |

### 2.6 Read-Only Observability Touchpoints (Existing)

- `apps/control-plane/lib/demoSeed.ts` — seed structure for governance timeline visualization (reference shape).
- `tooling/staging-certification/phase6-union-workflow.cert.ts` — certifies presence of read-only audit/timeline routes (a Phase 4 surface, once added, must satisfy similar certification gates).
- `apps/union-eyes/app/api/governance/dashboard/route.ts` — already aggregates golden-share status and reserved-matter votes. **PROTECTED** intersection: must continue exposing only the *fact of existence/status* (its current behaviour), never the IGG-internal mechanics added in Phase 3 (CLASS_B, RESERVED_MATTER kinds, VETOES/HOLDS/OVERRIDES edges, CLASS_B_VETO/GOLDEN_SHARE_SUNSET_PROGRESSION events).

---

## 3. Answers to the Ten Audit Questions

### Q1. Where does chronology already exist but remain disconnected?

- Case timeline (`dashboard/member/timeline/[caseId]/page.tsx`) — case-local, no link to IGG `DecisionNode` chronology.
- Activities log (`api/activities/route.ts`) — flat audit rows, never lifted into `ChronologyEntry`.
- Governance events stream (`api/governance/events/route.ts`) — formal events, but never reconciled with IGG `IggEventKinds`.
- Audit timeline utility (`packages/platform-governance/src/auditTimeline.ts`) — useful sort/filter logic, not exposed as institutional chronology.
- `ContinuityTimeline` UI — narrative-only, no graph backing.

**Convergence:** introduce `buildInstitutionalTimeline(decisions, events, edges)` and family in `governance/timeline.ts` that reads each existing source via thin adapters and emits a single normalized `InstitutionalTimelineEntry[]`.

### Q2. Where can evidence become institutional lineage?

- `DecisionNode.evidenceRefs` (already in substrate) — under-utilized; Phase 4 introduces `decisionEvidenceRefs(decision)` and `lineageEvidenceRefs(decisions)` (walks SUPERSEDES + concatenates evidence refs in chronological order).
- Voting / case-export evidence packs — already produced; just need a read-only `evidenceChronology(entityId)` projection.
- Document signature audit — bind to decisions via `decisionEvidenceRefs` when the document ID appears in a decision's evidence refs.

### Q3. Which runtime surfaces are safe for observability?

Safe (read-only, no protected leakage, no automation):

- `app/[locale]/institutional-continuity/page.tsx` (existing).
- A future read-only page rendering `buildInstitutionalTimeline` output (deferred under gated approval — todo item 8).
- `api/activities`, `api/governance/events`, signature audit endpoints — already read-only, already hardened.

Unsafe / explicitly out-of-scope:

- Any path that would surface CLASS_B / RESERVED_MATTER / VETOES / HOLDS / OVERRIDES / CLASS_B_VETO / GOLDEN_SHARE_SUNSET_PROGRESSION mechanics.
- `pilot-governance` page (operational, not institutional chronology).
- Anything that aggregates per-actor behaviour over time.

### Q4. What continuity intelligence already exists implicitly?

- AFFILIATED_WITH edges (Phase 2 projection) → cohort membership over time is implicit.
- REPRESENTS / TENURED_AS edges → representation continuity is implicit.
- `MEMBER_ROLE_CHANGE` audit events (control-plane) → role-transition continuity is implicit.
- Voting session open/close events → procedural epochs are implicit.
- CBA_RATIFIED events → bargaining-cycle epochs are implicit.

Phase 4 elevates these into first-class primitives (§5.3).

### Q5. Which governance transitions matter institutionally?

- Affiliation transitions (member → org, local → federation).
- Steward / role assignments and tenure end.
- Voting session lifecycle (opened → eligibility set → cast → closed → outcome).
- Decision supersession (lineage chain).
- CBA ratification cycles.
- Negotiation-session participation transitions.

Out of scope: any transition tied to protected mechanics (§ Phase 3 fence).

### Q6. What institutional states should become explainable?

- "Why does this organization currently have this representation?" → `timelineForOrganization` + `representationTimeline`.
- "How did this decision become the active version?" → `timelineForDecision` (wraps `lineageChain`).
- "What is the documented evidence chain behind this outcome?" → `lineageEvidenceRefs`.
- "When did continuity break, and where?" → `continuityBreakpoints`.
- "Which governance dependencies are unresolved?" → `unresolvedDecisionDependencies`.

Each must be a **pure read** over Phase 1–3 outputs plus thin adapters; no inference, no scoring, no ranking.

### Q7. Which evidence systems should connect to decisions?

- Voting evidence packs → already linked via `evidenceRefs` on motion-outcome decisions; promote via `decisionEvidenceRefs`.
- Case-export evidence → linked when a case generates a decision (e.g., grievance determination).
- Signature audit history → linked when document ID appears in decision evidence refs.
- Document chain-of-custody (correspondence schema) → linked via the same document-ID join.

Explicitly **not** connected:

- AI assistant audit log (different actor class).
- Flow evidence adapter (different bounded context).
- Billing replay (financial audit, not governance).

### Q8. Which observability surfaces risk drifting into surveillance?

High risk — must be permanently forbidden:

- Per-member behavioural timelines.
- Per-steward "activity scoring".
- Caucus / voting-bloc inference from `VOTE_CAST` events.
- Influence / centrality computations over delegation graphs.
- Predictive outcome modelling on motions.
- Any heatmap or ranking of actors.

Structural mitigation:

- All Phase 4 chronology APIs accept an `entityId` (organization / decision / role) — **never** an actor id as primary key.
- Public projections must redact actor identity beyond what is constitutionally required (e.g., a decision's `actorId` may surface as the role, not the person, on aggregate views).
- `assertNoProtectedKindsInReadSurface` is extended to cover Phase 4 outputs.

### Q9. What chronology primitives are still missing?

- A unified `InstitutionalTimelineEntry` type that can carry decisions, governance events, affiliation transitions, and representation transitions side-by-side with stable ordering and protected-kind redaction.
- `governanceEpochTimeline` — coarse-grained epochs (e.g., between CBA ratifications, between governance protocol amendments) for narrative continuity.
- `continuityTimeline(entityId)` — entity-scoped continuity view combining affiliation + representation + decision lineage.
- Continuity-break detection: `continuityBreakpoints`, `representationGaps`, `unresolvedGovernanceTransitions`, `inactiveAffiliationChains`, `orphanedCommitteeRelationships`, `unresolvedDecisionDependencies`, `governanceStateDrift`.

### Q10. Which continuity concepts should become first-class?

| Concept | New primitive | Lives in |
|---|---|---|
| Institutional timeline | `buildInstitutionalTimeline`, `timelineForOrganization`, `timelineForDecision`, `timelineForAffiliation`, `timelineForRepresentation` | `governance/timeline.ts` |
| Governance epochs | `governanceEpochTimeline` | `governance/timeline.ts` |
| Evidence lineage | `evidenceChronology`, `decisionEvidenceRefs`, `lineageEvidenceRefs`, `continuityEvidenceMap` | `governance/evidence.ts` |
| Continuity intelligence | `continuityTimeline`, `continuityBreakpoints`, `representationGaps`, `unresolvedGovernanceTransitions`, `inactiveAffiliationChains`, `orphanedCommitteeRelationships`, `unresolvedDecisionDependencies`, `governanceStateDrift` | `governance/continuity.ts` |
| Protected visibility | extended `redactProtected` + `assertNoProtectedKindsInReadSurface` for timeline / evidence / continuity outputs | `governance/protected.ts` (extended) |

---

## 4. Hard Constraints (carry into every Phase 4 module)

**DO NOT:**

- Introduce governance automation.
- Expose protected governance semantics (CLASS_B, RESERVED_MATTER, VETOES, HOLDS, OVERRIDES, CLASS_B_VETO, GOLDEN_SHARE_SUNSET_PROGRESSION, RESERVED_MATTER_RAISED, founder/Class-B continuity structures).
- Build caucus, behavioural, predictive, influence, leadership-optimization, political-clustering, power-network, or strategic-simulation tooling.
- Mutate write paths, rewrite persistence, or destabilize runtime systems.

**Everything must remain:** additive, read-only, governance-safe, constitutionally neutral.

---

## 5. Phase 4 Work Plan (derived)

### 5.1 New module: `governance/timeline.ts`

- `InstitutionalTimelineEntry` (discriminated union: decision | event | affiliation-transition | representation-transition).
- `buildInstitutionalTimeline(input)` — pure function; redacts protected kinds; stable sort.
- `timelineForOrganization`, `timelineForDecision`, `timelineForAffiliation`, `timelineForRepresentation`, `continuityTimeline`, `governanceEpochTimeline`.

### 5.2 New module: `governance/evidence.ts`

- `decisionEvidenceRefs(decision)`, `lineageEvidenceRefs(decisions)`, `evidenceChronology(entityId, decisions)`, `continuityEvidenceMap(entityId, decisions, edges)`.
- All return **only references** (IDs / URIs) — never re-seal, never compute hashes, never fetch contents.

### 5.3 New module: `governance/continuity.ts`

- `continuityBreakpoints`, `representationGaps`, `unresolvedGovernanceTransitions`, `inactiveAffiliationChains`, `orphanedCommitteeRelationships`, `unresolvedDecisionDependencies`, `governanceStateDrift`.
- All implemented as graph reads over Phase 2 projection outputs + Phase 3 chronology utilities.

### 5.4 Extended `governance/protected.ts`

- Extend `assertNoProtectedKindsInReadSurface` to cover `InstitutionalTimelineEntry[]` and continuity output shapes.
- Add `redactProtectedTimeline`, `redactProtectedContinuity`, `redactProtectedEvidence` thin wrappers.

### 5.5 Tests (`governance/governance.test.ts` extension or new file)

- Round-trip tests for each new primitive.
- Negative tests: every output passes `assertNoProtectedKindsInReadSurface`.
- Lineage / chronology ordering invariants.
- Continuity-break detection on synthetic gap fixtures.

### 5.6 Trust / explainability convergence layer

- Copy + serializer that translates timeline / continuity outputs into archival, calm, governance-safe narrative form. Reuses `messages/*.json` lineage strings where applicable. Strictly read-only.

### 5.7 Read-only surface (DEFERRED — gated)

- A new institutional-continuity-aligned page consuming the Phase 4 utilities. Only landed after explicit user approval; not part of the default Phase 4 deliverable.

### 5.8 `phase4-implementation-report.md`

- Final report mirroring `phase2-projection-implementation-report.md` cadence.

---

## 6. Visual & UX Direction (when surfaces are eventually scaffolded)

**Use:** chronology rails, lineage chains, institutional pathways, governance epochs, continuity overlays, evidence-linked timelines, procedural breadcrumbs.

**Avoid:** node-link chaos, force-directed social graphs, "network intelligence", predictive overlays, heatmaps of influence.

**Feel:** procedural, archival-modern, continuity-aware, institutional, calm, inspectable, governance-safe, sovereignty-conscious.

---

## 7. Validation Posture

- All Phase 4 modules must pass: `pnpm --filter @nzila/institutional-governance-graph test` and `pnpm typecheck`.
- Every new public function must be covered by at least one negative test asserting protected-kind redaction.
- No new runtime dependencies; pure TypeScript over existing IGG types.

---

## 8. Out of Scope (record for future phases)

- Substrate ontology promotion of IGG kinds into `@nzila/platform-ontology` — gated on user matrix acceptance (carried from Phase 3).
- Live source adapters from UE / control-plane into IGG runtime — read-only proof-of-concept only, after Phase 4 utilities stabilize.
- Any cross-app dashboard convergence — explicitly deferred.

---

*End of Phase 4 observability audit.*
