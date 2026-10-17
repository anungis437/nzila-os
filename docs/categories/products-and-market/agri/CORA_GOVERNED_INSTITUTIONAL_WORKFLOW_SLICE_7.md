# Cora Governed Institutional Workflow — Slice 7

**Disposition:** `CORA_INSTITUTIONAL_WORKFLOW_SLICE_7_PASS_WITH_LIMITATIONS`

## Scope and context map

Slice 6 remains accepted. Slice 7 operationalizes its local contracts without
new provider qualification, live rights assumptions or canonical redesign.

| Reviewed surface                                                                                                                                                                            | Relationship                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [Slice 6 proof](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md), [reuse](CORA_CROSS_INSTITUTIONAL_REUSE_EVENT_CONTRACT.md), [friction](CORA_EVIDENCE_MOBILITY_FRICTION_CONTRACT.md)           | Preserve governed identity, exact issuer authority and independent interpretation/decision.                 |
| [6A](CORA_SYNTHETIC_CROSS_INSTITUTIONAL_RESOLUTION_PROOF.md), [first proof contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)                                                      | Preserve seven states and unproven live acceptance/latency.                                                 |
| [Authorization composition](CORA_AUTHORIZATION_COMPOSITION.md), [resolver](../../../../apps/cora/lib/resolve-org.ts), [evidence foundation](../../../../apps/cora/lib/evidence-foundation/) | Canonical actor/org port, explicit separate permissions, atomic record/audit pattern; no changes or grants. |
| [Capsule](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md), [resolution](../../../../apps/cora/lib/evidence-resolution/), [reuse implementation](../../../../apps/cora/lib/evidence-reuse/)          | Existing helpers unchanged; no source rights/truth/freshness mutation.                                      |

Implementation is isolated under
[institutional-workflow](../../../../apps/cora/lib/institutional-workflow/):
contracts, service, ledger/local transactional adapter, synthetic fixture and
tests. No route, UI, source client, production adapter or migration is added.

## Runtime proof

- Strict request refs only; server-owned identity, authority, definitions,
  authorizations, results, classification, clock and metrics.
- Exact evidence/provenance/requirement/interpretation/authorization bindings;
  later catalog edits do not rewrite historical runs.
- Staged lifecycle and append-only snapshots; impossible transitions rejected.
- Concurrent identical requests create one run; revision-bound retries advance
  once; changed versions/context create new identities and supersession links.
- Current source/recipient rights, issuer authority, expiry and requirement
  supersession are checked at each boundary.
- Revocation before resolution/reuse/disposition stops future execution.
  Past valid reuse and external decisions remain history, not current approval.
- Wrong org/actor/recipient, cross-tenant catalog rows/run IDs, missing
  permission/authorization and unresolved authority fail closed.
- Reuse ledger deduplicates; friction derives from recorded verified events.
- External dispositions require separate authenticated recipient permission
  and lineage. Cora generates no decision value.
- Complete audit fields and hash lineage; tampering and commit failures reject.

## Synthetic end-to-end result

```text
synthetic operator -> existing issuer-bound evidence
 -> A workflow: MATCHED
 -> same evidence bound to independent B workflow: PARTIAL
 -> QUALIFIED_REUSE
 -> external synthetic recipient disposition reference
 -> event-derived metrics and append-only audit lineage
```

B records one qualified opportunity, **EvidenceReuseRatio 1/1**, and **3**
modeled local actions (permission verification, interpretation and external
recipient-reference verification). Retrieval/re-entry/duplication/reconstruction
remain zero. These are runtime event counts, not measured labor, latency or
institutional acceptance.

Capsule bytes stay unchanged; source rights and `NOT_VERIFIED` freshness are
not upgraded. Technical resolution, reuse and recipient decision remain
separate. The operator preparation model exposes these distinctions.

## Validation and next gate

Bounded reference UX successor:
[Slice 8 proof](CORA_OPERATOR_WORKFLOW_UX_SLICE_8.md),
[view contract](CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md) and
[truth/authority guide](CORA_WORKFLOW_UX_TRUTH_AND_AUTHORITY_GUIDE.md).
This does not upgrade Slice 7's production or live-source limits.

Focused tests cover creation, trusted identity, strict inputs, binding,
concurrency/replay, changed versions, boundary revocation, expiry/supersession,
isolation, authority ambiguity, ledger dedupe, friction, external disposition,
lifecycle, audit, rollback and unchanged capsule.

Required checks: focused workflow tests, full Cora suite, Cora typecheck/lint,
scoped Prettier, docs validation, `git diff --check`, governance audit.
Exact execution results accompany the final disposition.

**Ready for bounded operator-facing synthetic workflow UX preparation: yes**,
using the reference-only view contract and non-approval language. Application
identity/permission/route/error integration must still be separately reviewed.
No polished UX or live-source workflow is activated here.

Remaining limitations: process-memory storage rather than durable/distributed
storage or recovery; synthetic authority/rights/recipient ports rather than
production canonical services; no platform audit integration, live currentness,
correction/deletion/retention enforcement, actual recipient acceptance,
operator field trial, authenticated HTTP proof or observed latency.
No permission to persist unknown-rights assertion content in a database.

```text
CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION
PHASE_3_PERMISSION = NONE_GRANTED
PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN
```

JD001/FV001 remain gated. Synthetic/local data only; no real producer/farm/
certifier data, credentials, external APIs, outreach, consumer selection,
commit or push.

See [runtime contract](CORA_INSTITUTIONAL_WORKFLOW_RUNTIME_CONTRACT.md)
and [audit/idempotency](CORA_WORKFLOW_AUDIT_AND_IDEMPOTENCY_CONTRACT.md).
