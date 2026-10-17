---
goal: Build provider-neutral Cora continuity and institutional evidence capabilities without assuming Deere rights
version: 1.0
date_created: 2026-10-09
last_updated: 2026-10-10
owner: Cora
status: In progress
tags: [architecture, feature, agriculture, continuity, evidence, governance]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan advances Cora as Agricultural Institutional Infrastructure while
keeping source authority, acquisition channel, transport, institutional
decision authority, and action-specific rights distinct. Deere remains
`REFERENCE_CONNECTOR_001`; its live integration is blocked at the existing
rights gate. All initial implementation and cross-route proof use synthetic
fixtures only. Institutional evidence work proceeds independently of JD001.

## 1. Requirements & Constraints

- **REQ-001**: Preserve the invariants `SOURCE_PROVIDER != ACQUISITION_CHANNEL`
  and `TRANSPORT != AUTHORITY`. Every acquisition path resolves to shared Cora
  canonical objects while retaining source identity, source authority, and
  acquisition channel separately.
- **REQ-002**: Model the four channel classes: Native Strategic Connector,
  Aggregated Connector, Standard/File Connector, and Operator Import. A
  provider may support more than one channel; the channel never replaces
  source attribution.
- **REQ-003**: Every connector capability carries capability, source-right,
  retention-right, transformation-right, disclosure-right,
  rehydration-right, and freshness states. Any required absent, unknown,
  expired, or out-of-scope right fails closed.
- **REQ-004**: Implement source capture, versioned semantic mappings, identity
  resolution, provenance, rights/retention controls, continuity capsules,
  continuity ledger, export, rehydration, revocation, and deletion as separable
  provider-neutral Cora capabilities.
- **REQ-005**: Prove provider independence only through synthetic or
  rights-cleared tests that exercise more than one lawful acquisition route,
  compare canonical meaning, record route-specific semantic loss, test
  intermediary loss, and demonstrate replaceable export/rehydration.
- **REQ-006**: Continue Canada Organic and cross-institutional evidence
  resolution independently of JD001. Keep Organic Alpha source access at
  `CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
  `PHASE_3_PERMISSION = NONE_GRANTED`, and
  `PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.
- **SEC-001**: Use synthetic/provider-neutral fixtures unless the exact
  provider, purpose, data scope, operation, retention, transformation,
  disclosure, and rehydration rights have been approved. Synthetic results
  must never be labeled provider runtime proof.
- **CON-001**: Deere remains frozen: no API implementation, credentials, app
  registration, source access, producer data, persistence, normalization,
  export, sharing, or rehydration. Do not weaken or bypass JD001 gates.
- **CON-002**: Do not start broad connector implementation. Public-evidence
  qualification may identify a candidate, but does not select it for
  production or authorize access.
- **CON-003**: Do not change Organic Alpha source-rights gates or infer that
  public availability, operator consent, an API scope, a file format, or an
  intermediary grant creates source rights.
- **CON-004**: Cora must not become a farm-management system, national data
  lake, OEM replacement, aggregator clone, or generic ETL platform.
- **GUD-001**: Preserve existing Cora organization/identity, authorization,
  evidence-foundation, and audit patterns; do not alter current dirty worktree
  changes in `apps/cora/lib/resolve-org.ts` or its tests as part of this plan.
- **PAT-001**: Follow
  [CORA_CONNECTOR_GOVERNANCE_CONTRACT.md](../docs/categories/products-and-market/agri/CORA_CONNECTOR_GOVERNANCE_CONTRACT.md),
  [CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md](../docs/categories/products-and-market/agri/CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md),
  the evidence-foundation contracts, and the existing synthetic fixture/test
  patterns in `apps/cora/lib/organic-evidence/`.

### Context map reviewed

| Existing surface                                                                            | Purpose                                                                                    | Plan relationship                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `apps/cora/lib/evidence-foundation/contracts.ts` and `service.ts`                           | Cora evidence/conclusion contracts, consent/policy ports, audit-aware persistence boundary | Reuse the evidence identity and authorization seams; do not treat them as source ingestion or live permission.      |
| `apps/cora/lib/organic-evidence/contracts.ts` and `pro-cert-directory.ts`                   | Organic evidence, source rights, provenance and normalization contracts; offline adapter   | Preserve as a source-specific domain adapter behind provider-neutral capture; keep its source-right gate unchanged. |
| `apps/cora/lib/organic-evidence/pro-cert-directory.fixture.ts` and `contracts.test.ts`      | Synthetic source fixture and isolated contract tests                                       | Follow fixture isolation and non-production labeling patterns.                                                      |
| `apps/cora/lib/farmer-360/contracts.ts`, `service.ts`, and `adapters.ts`                    | Existing assertion/provenance and identity-related service patterns                        | Reuse only after mapping authority/ownership; do not make Farmer 360 the generic source model.                      |
| `docs/categories/products-and-market/agri/CORA_CONNECTOR_GOVERNANCE_CONTRACT.md`            | Connector registration, lifecycle and rights gates                                         | Normative governance contract for capability execution.                                                             |
| `docs/categories/products-and-market/agri/CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md`           | Proposed portability, rights, integrity and rehydration contract                           | Normative starting point for schema and conformance tests.                                                          |
| `docs/categories/products-and-market/agri/CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md` | Defines institutional independence and reuse proof requirements                            | Continue in parallel with provider work; do not assert a second consumer is selected.                               |
| Existing worktree changes to Cora org resolution, README, and test setup                    | In-progress changes already present before this plan                                       | Preserve; inspect and integrate before any overlapping implementation.                                              |

The baseline review found no provider-neutral `SourceCapture`, capsule, ledger,
exporter, or rehydrator. Slice 1 now adds pure contracts and in-memory
synthetic conformance operations under `apps/cora/lib/source-continuity/`.
There is still no database adapter, production authorization resolver,
provider client, independent-reader implementation, or provider runtime
proof. See
[CORA_PROVIDER_NEUTRAL_CONTINUITY_KERNEL_SLICE_1.md](../docs/categories/products-and-market/agri/CORA_PROVIDER_NEUTRAL_CONTINUITY_KERNEL_SLICE_1.md)
for the precise implementation ceiling.

## 2. Implementation Steps

### Implementation Phase 1 — Provider-neutral domain and rights contracts

- **GOAL-001**: Define stable Cora-owned contracts for source identity,
  acquisition channel, transport, authority, rights states, freshness, and
  versioned semantic mappings without provider-specific assumptions.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                          | Completed | Date       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Add `apps/cora/lib/source-continuity/contracts.ts` with Zod contracts for `SourceCapture`, namespaced source references, capture context, source authority, acquisition channel, transport, identity binding, versioned mapping references, provenance edges, freshness, and independent rights states. Enumerate all four channel classes and keep provider ID separate from channel and transport. | ✅        | 2026-10-09 |
| TASK-002 | Add `apps/cora/lib/source-continuity/rights.ts` with pure capability evaluation requiring all rights relevant to the requested action; return explicit deny reasons and never coerce `UNKNOWN`, `EXPIRED`, `CONDITIONAL`, or missing states to allow. Cover capture, map, persist, export, disclose, rehydrate, revoke, and delete separately.                                                       | ✅        | 2026-10-09 |
| TASK-003 | Add `apps/cora/lib/source-continuity/contracts.test.ts` for strict parsing, namespace isolation, channel/provider separation, required rights-state fields, unknown-state preservation, and rejected malformed identity/provenance/version references. Use synthetic data only.                                                                                                                      | ✅        | 2026-10-09 |
| TASK-004 | Update `apps/cora/lib/source-continuity/index.ts` to export only reviewed provider-neutral domain contracts and pure operations; do not add an API route, database adapter, provider client, or credential configuration.                                                                                                                                                                            | ✅        | 2026-10-09 |

**Phase completion:** the provider-neutral contracts, rights evaluator, and
targeted source-continuity tests pass; no Deere identifiers, production
credentials, or live-source capability is introduced; unknown rights
demonstrably deny protected actions.

**Slice 1 status:** Synthetic-only implementation now covers the core of
Phases 1–3. The targeted suite passes (10 files, 34 tests), and Cora
typecheck/lint pass. The richer production capsule manifest and full
revocation/deletion propagation remain open; this does not authorize
production/runtime use.

**Slice 2 status:** The bounded ADAPT-shaped standard-file qualification and
synthetic ingestion adapter are implemented behind the provider-neutral seam.
The work preserves upstream-provider identity separately from the standard-file
acquisition channel, records mapping evidence and semantic loss, and keeps
ambiguous identity/time semantics unresolved. Slice 2 is accepted with
limitations; this adapter is not an official ADAPT file parser and does not
authorize use of real source data.

**Slice 3 status:** A provider-neutral evaluator compares synthetic native and
ADAPT-shaped standard-file routes, reports per-dimension fidelity and
conflicts, evaluates rights separately per route, and retains route-specific
provenance. The baseline proves only the explicitly required synthetic claims;
spatial and temporal fidelity remain partial. Capsule export/rehydration
works for the synthetic captures without live source availability and keeps
currentness unverified. No live provider or producer data was used. See
[CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md](../docs/categories/products-and-market/agri/CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md)
and [CORA_CONTINUITY_FIDELITY_CONTRACT.md](../docs/categories/products-and-market/agri/CORA_CONTINUITY_FIDELITY_CONTRACT.md).

**Slice 4 status:** Climate FieldView has been qualified as a documentation-only
reference connector surface. Its public v4 docs establish a bounded native
field/farm/boundary/activity/export shape, but do not establish Deere-like
organization hierarchy, source-currentness, or any Cora rights to persist,
transform, disclose, or rehydrate data. Slice 4 remains rights-gated and
implementation-frozen.

**Slice 5 status:** A bounded synthetic multi-provider proof now compares
Deere-shaped native, FieldView-shaped native, and ADAPT-shaped standard-file
routes without allowing any route to define the canonical model. The proof
layer classifies canonical pressure, records route-specific fidelity and
rights outcomes, packages a synthetic combined capsule under an explicit
shared proof purpose, and fails if routes conflict on canonical meaning. The
result is `CORA_MULTI_PROVIDER_SLICE_5_PASS_WITH_LIMITATIONS`: bounded
provider-neutrality is synthetically supported, but the proof remains
synthetic-only and does not establish live rights, currentness, or
production readiness. See
[CORA_MULTI_PROVIDER_PROOF_SLICE_5.md](../docs/categories/products-and-market/agri/CORA_MULTI_PROVIDER_PROOF_SLICE_5.md).

**Capsule retention clarification:** The generic retention manifest records
retention duration and expiry as unknown and carries the capture's rights
decision reference, retention-after-disconnect state, and deletion state. It
does not establish or extend retention rights.

**Validation snapshot (2026-10-10):**

- `pnpm exec prettier --check apps/cora/lib/source-continuity docs/categories/products-and-market/agri/CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md docs/categories/products-and-market/agri/CORA_PROVIDER_NEUTRAL_CONTINUITY_KERNEL_SLICE_1.md plan/architecture-cora-parallel-provider-neutral-1.md` — passed.
- `pnpm --filter @nzila/cora exec vitest run lib/source-continuity` — passed, 10 files / 34 tests.
- `pnpm --filter @nzila/cora typecheck` — passed.
- `pnpm --filter @nzila/cora lint` — passed.
- `pnpm validate:docs` — passed with zero documentation errors.
- `git diff --check` — passed.
- `pnpm governance:audit` — passed; existing warnings were reported.
- `pnpm test:fast` — 2,176 tests passed and one unrelated Union Eyes runtime-schema-authority oracle test failed because its expected count was 23 and the observed count was 10.

### Implementation Phase 2 — Capture, identity, mapping, and provenance

- **GOAL-002**: Convert authorized synthetic/source-neutral captures into
  stable canonical evidence observations without erasing the original
  provider, authority, route, or semantic uncertainty.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                           | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-005 | Add `apps/cora/lib/source-continuity/capture.ts` with a pure capture validator that accepts an explicit provider namespace, source reference, authority reference, acquisition channel, transport, schema version, observed/effective times, payload digest, and rights decision reference. Reject any capture missing identity, provenance, or required transient-processing rights. | ✅        | 2026-10-09 |
| TASK-006 | Add `apps/cora/lib/source-continuity/identity-resolution.ts` with deterministic, provider-namespaced identity bindings and explicit `MATCHED`, `AMBIGUOUS`, `UNMATCHED`, and `CONFLICT` outcomes. Never merge subjects on display-name or address similarity alone.                                                                                                                   | ✅        | 2026-10-09 |
| TASK-007 | Add `apps/cora/lib/source-continuity/semantic-mapping.ts` with immutable authority/mapping ID/version references, source-to-canonical field mappings, units/qualifiers, and declared loss/uncertainty. Preserve raw source values separately from derived canonical values; an unrecognized mapping version fails closed for canonicalization.                                        | ✅        | 2026-10-09 |
| TASK-008 | Add `apps/cora/lib/source-continuity/provenance.ts` to append source, capture, mapping, identity, and transformation provenance edges using the repository's shared provenance conventions; do not claim issuer attestation from Cora packaging or transport.                                                                                                                         | ✅        | 2026-10-09 |
| TASK-009 | Add `apps/cora/lib/source-continuity/capture.test.ts`, `identity-resolution.test.ts`, and `semantic-mapping.test.ts` using paired synthetic fixtures that deliver the same canonical assertion through native, aggregated, standard/file, and operator-import channels; assert retained source authority, route-specific loss, and conflict behavior.                                 | ✅        | 2026-10-09 |

**Phase completion:** equivalent synthetic evidence on different channels
produces the same canonical meaning only when mappings explicitly preserve
required semantics; test output records all losses and never upgrades
source authority.

### Implementation Phase 3 — Continuity ledger, capsule, export, and rehydration

- **GOAL-003**: Produce an integrity-verifiable portable evidence capsule and
  a testable rights-aware history/rehydration contract independent of a source,
  intermediary, or live Cora service.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                               | Completed | Date       |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-010 | Add `apps/cora/lib/source-continuity/continuity-ledger.ts` with append-only, validated lifecycle transitions for capture, validation, mapping, capsule assembly, export, rehydration, revocation, deletion request, and deletion completion. Record actor/org/purpose/recipient, rights snapshot, timestamps, evidence identity, integrity digest, and transition outcome; reject impossible transitions. | ✅        | 2026-10-09 |
| TASK-011 | Add `apps/cora/lib/source-continuity/capsule.ts` with a versioned, deterministic manifest, namespaced item identity, schema/media type, mapping version, provenance, rights/retention states, integrity digest, limitations, and explicit omitted-payload states. Include only payload whose persistence and export rights are allowed; the manifest itself is subject to rights review.                  |           |            |
| TASK-012 | Add `apps/cora/lib/source-continuity/export.ts` and `rehydrate.ts` as pure, independently callable operations. Export requires recipient/purpose-specific disclosure and export rights; rehydration validates capsule version, digest, mapping availability and rights state, and restores evidence state without refreshing source currentness or granting source/recipient authority.                   | ✅        | 2026-10-09 |
| TASK-013 | Add `apps/cora/lib/source-continuity/deletion.ts` to propagate explicit revocation/deletion events through synthetic in-memory capsule items, mappings, derived outputs, and ledger references; report unresolved replicas/backup obligations rather than claiming deletion succeeded.                                                                                                                    |           |            |
| TASK-014 | Add `apps/cora/lib/source-continuity/capsule.test.ts`, `continuity-ledger.test.ts`, `export.test.ts`, `rehydrate.test.ts`, and `deletion.test.ts` for deterministic serialization, tamper/missing-item detection, rights denial, loss of one aggregator, offline independent reading, revocation, deletion, and explicit non-currentness after rehydration.                                               |           |            |

**Phase completion:** synthetic capsule can be exported and parsed by an
independent test reader without Cora service calls or provider credentials;
digest/tampering, unknown rights, expiry, revocation, and unsupported version
all fail closed. Passing tests establish synthetic conformance only.

### Implementation Phase 4 — Institutional proof work in parallel

- **GOAL-004**: Advance requirement representation and evidence resolution
  without making JD001 or a live organic source a prerequisite.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                         | Completed | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-015 | Keep evidence-resolution contracts isolated under `apps/cora/lib/evidence-resolution/`; represent stable evidence references, recipient-specific requirements, technical resolution, and recipient-owned disposition separately, reusing the source-continuity rights and provenance model without storing source payload or conferring source rights.                              | ✅        | 2026-10-10 |
| TASK-016 | Add pure evidence-resolution contracts and tests under `apps/cora/lib/evidence-resolution/` that map synthetic evidence references to independently scoped recipient requirements and return the normative states `MATCHED`, `PARTIAL`, `UNKNOWN`, `CONFLICT`, `EXPIRED`, `NOT_AUTHORIZED`, or `NOT_SATISFIED` with traceable reasons. Cora must not make the recipient's decision. | ✅        | 2026-10-10 |
| TASK-017 | Add a synthetic-only two-recipient scenario under `apps/cora/lib/evidence-resolution/fixtures/` and acceptance tests. Keep real consumers unselected, preserve `CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`, and never report the scenario as live-source proof or institutional acceptance.                                                                      | ✅        | 2026-10-10 |
| TASK-018 | Compare implementation behavior against `docs/categories/products-and-market/agri/CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md`; retain its normative state vocabulary and source-rights / second-consumer boundaries. No contract change was needed.                                                                                                                           | ✅        | 2026-10-10 |

**Phase completion:** synthetic requirements and assertions resolve through
the same capsule/provenance model, preserve separate recipient dispositions,
and have no code or test dependency on JD001, a producer record, or Phase 3
permission.

**Slice 6A accepted seam:** `SLICE_6A_CROSS_INSTITUTIONAL_RESOLUTION_PASS_WITH_LIMITATIONS`,
recorded in [the resolution proof](../docs/categories/products-and-market/agri/CORA_SYNTHETIC_CROSS_INSTITUTIONAL_RESOLUTION_PROOF.md).
TASK-015 through TASK-018 establish resolution and disposition separation,
not the entire institutional reuse proof.

### Implementation Phase 4B — Synthetic institutional reuse

| Task     | Description                                                                                                                                                                                                                                                                                                                                           | Completed | Date       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-027 | Add provider-neutral governed assertion/support and `CrossInstitutionalEvidenceReuseEvent` contracts under `apps/cora/lib/evidence-reuse/`. Require exact issuer binding, provenance, evidence identity/version, independent contexts and recipient authorizations. Preserve REQ-003, REQ-004, REQ-006 and SEC-001. Depends on TASK-015 and TASK-016. | ✅        | 2026-10-10 |
| TASK-028 | Prove a synthetic Organic-related A → independent B journey through capture, capsule, support, issuer-bound assertion and reuse. Test A matched/B matched, partial and not satisfied, authority rejection, temporal/version/conflict/rights asymmetry and pseudo-reuse exclusion. Depends on TASK-027 and the synthetic capture/mapping/capsule seam. | ✅        | 2026-10-10 |
| TASK-029 | Add internal `EvidenceReuseRatio` and `EvidenceMobilityFriction` contracts with eligible opportunity denominator, excluded pseudo-reuse, idempotent evaluation and bound reconstruction traces. Report synthetic action counts only. Depends on TASK-027 and TASK-028.                                                                                | ✅        | 2026-10-10 |
| TASK-030 | Document and validate the bounded first complete synthetic institutional loop; preserve independent recipient dispositions, unchanged capsule semantics and frozen live-source gates. Depends on TASK-028 and TASK-029.                                                                                                                               | ✅        | 2026-10-10 |

**Slice 6 disposition:** `CORA_INSTITUTIONAL_REUSE_SLICE_6_PASS_WITH_LIMITATIONS`.
See [institutional reuse proof](../docs/categories/products-and-market/agri/CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md),
[reuse event contract](../docs/categories/products-and-market/agri/CORA_CROSS_INSTITUTIONAL_REUSE_EVENT_CONTRACT.md),
and [friction contract](../docs/categories/products-and-market/agri/CORA_EVIDENCE_MOBILITY_FRICTION_CONTRACT.md).
Only the bounded synthetic loop is demonstrated. Production issuer/rights
services, durable storage/audit, actual institutional acceptance, source
currentness, operator workflow and measured real-world latency remain unproven.
No live-source rights, Phase 3 permission or second consumer selection follows.

### Implementation Phase 4C — Server-owned synthetic workflow runtime

| Task     | Description                                                                                                                                                                                                                                      | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| TASK-031 | Add exact workflow/run/binding/resolution/reuse/disposition contracts under `apps/cora/lib/institutional-workflow/`. Server ports derive actor/org and current rights, preserving REQ-003/004/006 and SEC-001. Depends on TASK-027 and TASK-028. | ✅        | 2026-10-10 |
| TASK-032 | Implement lifecycle, immutable snapshots, atomic audit/reuse/friction ledger contract, workflow/revision idempotency and external recipient disposition ingestion. Adapter is synthetic process-memory only. Depends on TASK-031 and TASK-029.   | ✅        | 2026-10-10 |
| TASK-033 | Test A/B runtime, revocation/expiry/supersession, isolation, replay/concurrency, external disposition, event-derived metrics and unchanged capsule. Depends on TASK-032.                                                                         | ✅        | 2026-10-10 |
| TASK-034 | Document runtime/audit contracts, operator preparation model and validation without live-source access or application grants. Depends on TASK-033.                                                                                               | ✅        | 2026-10-10 |

**Slice 7 disposition:** `CORA_INSTITUTIONAL_WORKFLOW_SLICE_7_PASS_WITH_LIMITATIONS`.
See [workflow proof](../docs/categories/products-and-market/agri/CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md),
[runtime contract](../docs/categories/products-and-market/agri/CORA_INSTITUTIONAL_WORKFLOW_RUNTIME_CONTRACT.md),
and [audit/idempotency](../docs/categories/products-and-market/agri/CORA_WORKFLOW_AUDIT_AND_IDEMPOTENCY_CONTRACT.md).
The server boundary is exercised through synthetic ports and an atomic
process-memory adapter. Durable storage, canonical provisioning, authenticated
HTTP, platform audit integration and real acceptance remain unproven.
Slice 8 builds the bounded reference UX below without live connector access
or source-rights activation.

### Implementation Phase 4D - Operator-facing synthetic workflow UX

| Task     | Description                                                                                                                                                                                                                     | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-035 | Add server-derived operator view, explicit current/history viewing authorization and independent current source/recipient disclosure checks. Preserve REQ-003/006 and SEC-001. Depends on TASK-031 and TASK-032.                | Yes       | 2026-10-10 |
| TASK-036 | Add route-free Overview/Evidence/Permissions/Requirement/Reuse/Decision/Lineage components and local synthetic HTML renderer; no browser authority reconstruction or connector setup. Depends on TASK-035.                      | Yes       | 2026-10-10 |
| TASK-037 | Prove matched, partial/reuse, revoked, superseded/successor, conflict, denied, stale, expired and reconstruction journeys; test isolation, native disclosure and browser navigation/wrapping. Depends on TASK-033 and TASK-036. | Yes       | 2026-10-10 |
| TASK-038 | Document view/truth boundaries and validation; prepare bounded synthetic comprehension exercise without outreach or grants. Depends on TASK-037.                                                                                | Yes       | 2026-10-10 |

**Slice 8 disposition:** `CORA_OPERATOR_WORKFLOW_UX_SLICE_8_PASS_WITH_LIMITATIONS`.
See [operator UX proof](../docs/categories/products-and-market/agri/CORA_OPERATOR_WORKFLOW_UX_SLICE_8.md),
[view contract](../docs/categories/products-and-market/agri/CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md)
and [truth/authority guide](../docs/categories/products-and-market/agri/CORA_WORKFLOW_UX_TRUTH_AND_AUTHORITY_GUIDE.md).
Ready for bounded human comprehension validation using synthetic scenarios
only; comprehension has not been measured. Pause architectural expansion
for that milestone. No source rights, live integrations, real acceptance,
production persistence or application grants follow from this proof.

### Implementation Phase 5 — Multi-route harness and operator continuity UX

- **GOAL-005**: Demonstrate route independence in synthetic conformance tests
  and expose rights/freshness/continuity states without promising unsupported
  provider coverage.

| Task     | Description                                                                                                                                                                                                                                                                                                                                   | Completed | Date |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| TASK-019 | Add `apps/cora/lib/source-continuity/test-harness.ts` for table-driven provider/channel/transport fixtures. Require each case to declare expected canonical meaning, preserved provenance, field-level losses, rights states, intermediary dependencies, and replaceable-export assertions.                                                   |           |      |
| TASK-020 | Extend the harness tests to disable one synthetic acquisition intermediary after export and prove an independent reader still interprets the authorized capsule; separately test source-provider loss, route switch, incompatible mapping version, and withheld data.                                                                         |           |      |
| TASK-021 | Add Cora operator-facing continuity-state components under `apps/cora/components/continuity/` only after the contracts stabilize. Display source authority, acquisition channel, capture time, freshness, rights/retention, provenance, missing/withheld data, and explicit recipient decision ownership; no connector-setup or Deere screen. |           |      |
| TASK-022 | Add component tests under `apps/cora/components/continuity/__tests__/` for unknown/expired/denied state visibility, accessible labels, non-success error presentation, stale evidence, and no implied institutional approval.                                                                                                                 |           |      |

**Phase completion:** every implemented route pair has a passing synthetic
independence test; the UX distinguishes source truth, Cora processing, rights,
freshness, and recipient disposition and makes no provider runtime claim.

### Implementation Phase 6 — Public-evidence provider qualification

- **GOAL-006**: Qualify the next candidate from official public material only;
  select no live connector and contact no provider.

**Preliminary qualification ranking:** The reach column is an official-document
coverage proxy, not a producer-count or market-share claim. “Rights clarity”
means public clarity for Cora's exact data operations; a published API, open
format, or intermediary's onboarding documentation does not grant those
rights.

| Rank | Candidate                            | Producer reach proxy                                                                                         | Technical openness                                                                                  | Public documentation quality                                                                                      | Rights clarity                                                                         | Continuity value                                                                               | Deere overlap                                                     | Independence value                                                            | Rationale                                                                                                                                                                                                 |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | AgGateway ADAPT / standard-file path | Medium potential; adoption not quantified                                                                    | High for public framework/reference material                                                        | Medium; verify current scope and maintenance                                                                      | Unknown for real source data and each use                                              | High for portable, non-native interchange                                                      | High for machine-file and agronomic interchange                   | Very high                                                                     | Best first qualification for testing a standard/file acquisition route without making one OEM or aggregator the canonical model. The format/framework does not prove source authority or data-use rights. |
| 2    | Climate FieldView                    | Medium; a substantial direct source, but comparative reach is unverified                                     | High documentation visibility; actual API use is onboarded and usage-plan controlled                | Very high; public OpenAPI 4.0.11 specifies endpoints and common request behavior                                  | Unknown; partner access is not a persistence, transformation, export, or sharing grant | High; fields, boundaries, operations and exports are in its documented API surface             | High; same broad land/operation classes as JD001                  | High; direct strategic-source comparison                                      | Best next direct native provider after the standard/file qualification; its detailed public schema makes technical comparison feasible while rights remain gated.                                         |
| 3    | Leaf Agriculture                     | High documented channel breadth across multiple providers plus file upload; actual producer reach unverified | High public API documentation; account and provider credentials are required                        | High; public docs describe provider auth, canonical conversion, operations, and alerts                            | Low/unknown for Cora's rights; adds a separate intermediary agreement and terms layer  | High technical breadth, but source authority and intermediary continuity need explicit testing | High; expressly lists Deere, FieldView, CNHi, and Trimble sources | Medium; aggregator can bridge routes but is itself an intermediary dependency | Qualify as an aggregated route only after the direct and standard/file authority model is stable; do not let normalized outputs erase upstream provenance or terms.                                       |
| 4    | Trimble / PTx                        | Medium; public sources confirm API/product surfaces, not comparative producer counts                         | Medium; some official API overviews are public while detailed schemas/access remain to be qualified | Medium; PTx overview describes partner workflows, while a detailed public schema was not established in this pass | Unknown                                                                                | High potential for field, boundary, terminal and operation continuity                          | High                                                              | High as a direct route, subject to exact product/API identification           | Keep in queue; first distinguish product/API scope and inspect exact public schemas and terms.                                                                                                            |
| 5    | CNH / Case IH                        | Medium; public developer portal exists, but breadth is not quantified here                                   | Medium/unknown; portal is public but the inspected content is client-rendered                       | Low in this pass; endpoint-level content was not independently inspectable                                        | Unknown                                                                                | High potential for equipment/field-operation continuity                                        | High                                                              | High as a direct route                                                        | Do not conclude docs are absent; defer ranking confidence until the official portal's technical contracts can be inspected without account or API access.                                                 |

**Initial sequencing recommendation (now completed):** Qualify the AgGateway
ADAPT/standard-file path before the next direct strategic provider. Slice 2
qualified ADAPT as a standard-file route, and Slice 4 completed a public-doc
qualification of Climate FieldView. This sequence selected no connector,
proved no real-data rights, and authorized no outreach.

**FV001 qualification status:** Official FieldView v4 API documentation,
OAuth/security guidance, FAQ, terms, privacy statement, and the separate
preview v5 specification have been recorded in the linked FV001 evidence
pack. The v4 API has a documented field/farm/boundary shape, operation and
agronomic activity routes, and export mechanisms. FieldView v4 does not
document a Deere-equivalent organization/client hierarchy or field-change
feed; its FAQ says shared-user operations are not currently exposed through
the API. Public docs do not establish Cora's partner production access or
rights to persist, transform, disclose, or rehydrate data. Keep FV001
documentation-only and rights-gated. The next sequence is a provider-neutral
synthetic comparison of documented route semantics; any later provider
qualification remains a separate decision.

That comparison is now complete for the bounded synthetic slice: Deere-shaped
native, FieldView-shaped native, and ADAPT-shaped standard-file routes can be
compared without canonical contamination, while route-specific provenance and
rights limitations remain visible.

The comparison prioritizes channel independence before a second native
provider; neither the original order nor this completion status selects a
connector, proves real-data rights, or authorizes outreach.

| Task     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| TASK-023 | Record and maintain the candidate comparison in `docs/categories/products-and-market/agri/CORA_PROVIDER_QUALIFICATION_QUEUE.md`, ranking the five candidates by documented reach proxy, technical openness, official documentation quality, rights clarity, continuity value, Deere overlap, and acquisition-independence value. Preserve the preliminary scores above with evidence dates and mark actual producer reach and all Cora-specific data-use rights unknown unless official evidence establishes them. |           |            |
| TASK-024 | Qualify the AgGateway ADAPT standard/file route first, then complete a documentation-only public-evidence pass on Climate FieldView as the next direct strategic provider. Do not create an account, app, token, API call, or connector.                                                                                                                                                                                                                                                                           | Yes       | 2026-10-09 |
| TASK-025 | Gate future provider selection on source attribution/authority, documented schema and version, lawful acquisition method, action-specific terms, persistence/transformation/disclosure/rehydration rights, freshness/change semantics, and a measured synthetic/rights-cleared route comparison. An open file format or integration intermediary does not satisfy these gates.                                                                                                                                     |           |            |

**Phase completion:** dated evidence ledgers and comparison records cite
official public sources, distinguish published capability from Cora rights,
record unresolved technical/contractual/privacy gaps, and make no provider
selection or authorization. The FieldView pack is
[CORA_FV001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md](../docs/categories/products-and-market/agri/CORA_FV001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md),
[CORA_FV001_AUTHORIZATION_MODEL.md](../docs/categories/products-and-market/agri/CORA_FV001_AUTHORIZATION_MODEL.md),
[CORA_FV001_CAPABILITY_RIGHTS_MATRIX.md](../docs/categories/products-and-market/agri/CORA_FV001_CAPABILITY_RIGHTS_MATRIX.md),
[CORA_FV001_CONTINUITY_FEASIBILITY_MATRIX.md](../docs/categories/products-and-market/agri/CORA_FV001_CONTINUITY_FEASIBILITY_MATRIX.md),
[CORA_FV001_DISCOVERY_GAPS.md](../docs/categories/products-and-market/agri/CORA_FV001_DISCOVERY_GAPS.md),
[CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md](../docs/categories/products-and-market/agri/CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md),
and [CORA_FV001_JD001_COMPARISON.md](../docs/categories/products-and-market/agri/CORA_FV001_JD001_COMPARISON.md).

### Implementation Phase 7 — Acceptance and governance

- **GOAL-007**: Validate the provider-neutral implementation and retain the
  current rights/product ceilings.

| Task     | Description                                                                                                                                                                                                                                                                                                                                            | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| TASK-026 | Run the smallest targeted Cora test set first, then `pnpm --filter @nzila/cora typecheck`, `pnpm --filter @nzila/cora lint`, `pnpm --filter @nzila/cora test`, `pnpm validate:docs`, `git diff --check`, and `pnpm governance:audit` when changes are ready for integration. Record exact results; do not repair unrelated baseline warnings in scope. | Yes       | 2026-10-10 |
| TASK-027 | Verify by repository search and tests that JD001 has no runtime connector, credential/configuration, source fixture, migration, endpoint, or grant; Organic Alpha remains blocked; synthetic fixtures cannot emit `PUBLIC_SOURCE_RUNTIME_PROOF`, `PROVEN_IN_STAGING`, `complete`, `green`, `ready`, or `delivered`.                                    |           |            |
| TASK-028 | Update the Cora ceiling and connector governance documents only to reflect implemented, tested behavior. Keep proposed, synthetic, rights-cleared, pilot-authorized, and production-proven states distinct.                                                                                                                                            |           |            |

**Phase completion:** all applicable Cora checks pass, the rights gates remain
fail-closed, no provider-specific assumption enters canonical contracts,
and documentation accurately distinguishes synthetic validation from live
provider proof.

## 3. Alternatives

- **ALT-001**: Build a Deere adapter first. Rejected because JD001 is blocked
  at contractual rights discovery and a Deere-shaped contract would make
  provider assumptions foundational.
- **ALT-002**: Route all provider access through an aggregator. Rejected
  because it adds intermediary dependence, may obscure source authority and
  source-specific terms, and cannot alone prove replaceable continuity.
- **ALT-003**: Treat open standards or operator-uploaded files as inherently
  rights-cleared. Rejected because format access, possession, and transport
  do not grant rights to source content, persistence, transformation, reuse,
  or disclosure.
- **ALT-004**: Use a generic integration/ETL framework as Cora's canonical
  model. Rejected because the product boundary is institutionally governed
  evidence and continuity, not undifferentiated movement of farm data.
- **ALT-005**: Wait for source rights before building any Cora capability.
  Rejected because synthetic contracts, integrity, resolution, and
  replaceability tests do not require source access and do not establish
  provider runtime proof.

## 4. Dependencies

- **DEP-001**: Existing canonical organization/actor authority and the
  current Cora identity resolver; use server-derived organization context and
  preserve in-progress modifications.
- **DEP-002**: Existing Cora evidence foundation and `@nzila/agri-provenance`
  semantics; confirm the canonical provenance API before adding or duplicating
  provenance structures.
- **DEP-003**: Repository Zod, Vitest, TypeScript, and Cora package scripts;
  no new dependency is planned.
- **DEP-004**: Connector governance and Continuity Capsule v1 documentation;
  implementation must record mismatches as review items, not silently widen
  permissions.
- **DEP-005**: Institutional proof contracts and Organic Alpha source-rights
  decision; requirement-resolution code is independent, but any live source
  remains blocked until its separate rights gate is cleared.
- **DEP-006**: JD001 rights discovery for Deere implementation only; no
  provider-neutral or institutional phase may take an implementation
  dependency on the Deere outcome.

## 5. Files

- **FILE-001**: `apps/cora/lib/source-continuity/contracts.ts` — provider-neutral
  capture, provenance, mapping, channel, freshness, and rights contracts.
- **FILE-002**: `apps/cora/lib/source-continuity/rights.ts` and `capture.ts` —
  fail-closed capability decisions and synthetic/source-neutral capture
  validation.
- **FILE-003**: `apps/cora/lib/source-continuity/identity-resolution.ts`,
  `semantic-mapping.ts`, and `provenance.ts` — provider-namespaced identity,
  immutable semantics, and source-attributed lineage.
- **FILE-004**: `apps/cora/lib/source-continuity/continuity-ledger.ts`,
  `capsule.ts`, `export.ts`, `rehydrate.ts`, and `deletion.ts` — portable
  integrity-checked continuity and lifecycle handling.
- **FILE-005**: `apps/cora/lib/source-continuity/*.test.ts` and
  `apps/cora/lib/source-continuity/fixtures/` — synthetic conformance and
  provider-independence cases.
- **FILE-006**: `apps/cora/lib/evidence-resolution/` — provider-neutral
  institutional requirements, evidence resolution, synthetic fixtures, and
  tests, without an institutional decision engine.
- **FILE-007**: `apps/cora/components/continuity/` — eventual operator
  continuity status UI after service contracts stabilize.
- **FILE-008**: `docs/categories/products-and-market/agri/CORA_PROVIDER_QUALIFICATION_QUEUE.md`
  — official-public-evidence comparison and unresolved-gaps register.
- **FILE-009**: Existing source/authority, Organic Alpha, evidence-foundation,
  connector-governance, capsule, institutional-proof, product-ceiling, and
  Cora package documents/files; update only when implemented behavior or a
  verified contract mismatch requires it.
- **FILE-010**: `docs/categories/products-and-market/agri/CORA_PROVIDER_NEUTRAL_CONTINUITY_KERNEL_SLICE_1.md` — exact synthetic implementation boundary and non-claims.

## 6. Testing

- **TEST-001**: Source namespace/channel/transport/authority distinction and
  strict rejection of missing provenance or identity.
- **TEST-002**: Every required right independently gates its corresponding
  operation; unknown, expired, denied, and unsatisfied conditional states
  cannot execute.
- **TEST-003**: Native, aggregated, standard/file, and operator-import
  synthetic cases preserve canonical meaning and source authority, with
  route-specific semantic loss reported.
- **TEST-004**: Identity matching is deterministic and provider-namespaced;
  ambiguity, conflict, and similar names never silently merge identities.
- **TEST-005**: Mapping version changes are explicit and immutable; unmapped
  or unsupported values remain unavailable/unknown rather than inferred.
- **TEST-006**: Capsule serialization is deterministic; tamper, omitted
  required items, unknown format versions, or absent mapping definitions
  produce explicit failure states.
- **TEST-007**: Rights-denied export/share/rehydration is blocked; portable
  package integrity never claims truth, currentness, source signature, or
  institutional acceptance.
- **TEST-008**: Independent reader rehydrates an authorized synthetic capsule
  after simulated Cora and intermediary loss without source credentials or
  network access; old capture is not labeled current.
- **TEST-009**: Revocation/deletion transitions are auditable, idempotent,
  and report incomplete downstream or backup deletion without a
  success-shaped fallback.
- **TEST-010**: Institution A and B resolve the same synthetic evidence
  identity to separate requirements and separate recipient dispositions;
  copying/re-uploading alone does not count as reuse.
- **TEST-011**: Synthetic tests do not set or emit public-source runtime,
  staging-proven, or production readiness claims.
- **TEST-012**: Cora package lint, typecheck, unit tests, docs validation,
  whitespace check, and governance audit remain clean for changed scope.

## 7. Risks & Assumptions

- **RISK-001**: Existing evidence, Farmer 360, organic-evidence, and shared
  provenance abstractions may overlap. Inspect exact contracts before adding
  parallel identity or provenance models; prefer adapters over duplicate
  authorities.
- **RISK-002**: Rights metadata is itself potentially identifying or
  confidential. Capsule manifests, hashes, and authorization references
  require their own purpose, retention, and disclosure review.
- **RISK-003**: A multi-route test can give a false impression of independence
  if every route ultimately depends on one aggregator or one provider.
  Record the dependency graph and test intermediary loss explicitly.
- **RISK-004**: Route normalization can erase important source distinctions.
  Preserve raw values, source namespaces, units, mapping versions, and declared
  losses; do not call semantic equivalence without conformance evidence.
- **RISK-005**: Adding Cora-owned persistence or user-visible workflow may
  require additional ownership, database, privacy, authorization, and product
  approval. This plan does not authorize schema migrations, app write routes,
  or production deployment.
- **RISK-006**: Public documents may be incomplete, gated, stale, or
  client-rendered. Treat technical coverage and rights clarity as unknown
  unless primary official evidence is inspectable and current.
- **ASSUMPTION-001**: Initial implementation is limited to pure contracts,
  deterministic services, and synthetic in-memory fixtures; durable storage,
  network connectors, credentials, and production authorization are separate
  later gates.
- **ASSUMPTION-002**: Candidate reach rankings are qualitative proxies based
  on official documented platform/provider breadth, not measured producer
  counts or market share.
- **ASSUMPTION-003**: Existing Cora edits are user/worktree state and are
  preserved; overlapping files must be re-read before any implementation.

## 8. Related Specifications / Further Reading

- [Cora Data Sovereignty and Continuity Architecture](../docs/categories/products-and-market/agri/CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md)
- [Cora Connector Governance Contract](../docs/categories/products-and-market/agri/CORA_CONNECTOR_GOVERNANCE_CONTRACT.md)
- [Cora Continuity Capsule v1 Contract](../docs/categories/products-and-market/agri/CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md)
- [Cora Evidence Foundation](../docs/categories/products-and-market/agri/CORA_EVIDENCE_FOUNDATION.md)
- [Cora First Cross-Institutional Proof Contract](../docs/categories/products-and-market/agri/CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)
- [Organic First Live Source Decision](../docs/categories/products-and-market/agri/CORA_ORGANIC_FIRST_LIVE_SOURCE_DECISION.md)
- [Cora Implementation-Seam Audit](../docs/categories/products-and-market/agri/CORA_IMPLEMENTATION_SEAM_AUDIT.md)
- [Climate FieldView OpenAPI specification](https://dev.fieldview.com/openapi/platform.yaml) — public API schema and technical behavior; partner onboarding/API-key usage plan still required, and source/data-use rights are not inferred.
- [Cora FV001 public capability evidence ledger](../docs/categories/products-and-market/agri/CORA_FV001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md), [authorization model](../docs/categories/products-and-market/agri/CORA_FV001_AUTHORIZATION_MODEL.md), [capability-rights matrix](../docs/categories/products-and-market/agri/CORA_FV001_CAPABILITY_RIGHTS_MATRIX.md), [continuity feasibility matrix](../docs/categories/products-and-market/agri/CORA_FV001_CONTINUITY_FEASIBILITY_MATRIX.md), [discovery gaps](../docs/categories/products-and-market/agri/CORA_FV001_DISCOVERY_GAPS.md), [reference connector architecture](../docs/categories/products-and-market/agri/CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md), and [JD001 comparison](../docs/categories/products-and-market/agri/CORA_FV001_JD001_COMPARISON.md) — Slice 4 public-doc qualification; no FieldView access or Cora rights granted.
- [FieldView API Security](https://dev.fieldview.com/api-details/), [developer FAQ](https://dev.fieldview.com/faq/), [Terms of Use](https://climate.com/en-us/legal/terms-of-use.html), and [Privacy Statement](https://climate.com/en-us/legal/privacy-statement.html) — official partner authentication and customer-facing terms/privacy context; none substitutes for Cora-specific partner rights.
- [Leaf provider documentation](https://docs.withleaf.io/providers/overview.md) and [Leaf data-pipeline concepts](https://docs.withleaf.io/getting-started/core-concepts.md) — describe multi-provider and file acquisition plus normalization; add intermediary dependency and do not confer underlying provider rights.
- [AgGateway ADAPT framework repository](https://github.com/AgGateway-ADAPT/ADAPT) — public framework/reference implementation; verify current maintenance, format scope, and applicable code/data licences during qualification.
- [Cora ADAPT Standard-File Qualification](../docs/categories/products-and-market/agri/CORA_ADAPT_STANDARD_FILE_QUALIFICATION.md) and [Cora ADAPT Mapping Contract](../docs/categories/products-and-market/agri/CORA_ADAPT_MAPPING_CONTRACT.md) — Slice 2 records the pinned public-source snapshot, bounded synthetic mapping, rights boundary, route comparison, and remaining limits. The adapter is not an official-format parser or provider connector.
- [PTx FarmENGAGE APIs](https://www.ptxag.com/us/en/partners/developers/api.html) and [Trimble FieldView API documentation](https://help.trimble.com/doc/trimble-field-view/trimble-field-view/apis) — official API/product surfaces; further public schema and access qualification is required.
- [CNH Developer Portal](https://developer.cnh.com/agapidata?section=Migration) — official portal exists, but its client-rendered content must be inspected in a separate public-doc qualification pass before ranking endpoint-level coverage.
