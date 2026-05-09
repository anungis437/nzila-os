# Governance Evidence Emission

> **Status:** Canonical runtime integration · **Layer:** Evidence execution · **Inherits:** [governance-evidence-ledger.md](../nzila-runtime-governance/governance-evidence-ledger.md)

## 1. Objective

Continuously emit governance evidence — append-only, content-addressable, retention-classified — for every governance-bearing runtime act, so that any future review, audit, or attestation can be reconstructed from the ledger.

## 2. Evidence categories

| Category | Triggering event | Retention class |
|---|---|---|
| Deployment legitimacy | `deployment_legitimacy_event` | `extended` |
| Pilot boundary | `pilot_boundary_event` | `extended` |
| Environment isolation | `governance_event:isolation_check` | `standard` |
| Doctrine enforcement | `doctrine_enforcement_event` (severity ≥ `warning`) | `extended` |
| Continuity-safe routing | `continuity_signal:route_resolved` (sampled) | `short` |
| AI governance | `ai_governance_event` | `extended` |
| Operational calmness validation | `cognitive_safety_signal:threshold_exceeded` | `standard` |
| Executive cognitive safety validation | `governance_event:executive_density_assessed` | `standard` |

## 3. Storage shape

- **Hot path:** local append to `proof-artifacts/evidence/<date>/<id>.json` during CI runs.
- **Warm path:** Azure Blob (`nzilacanadastore` → `evidence` container) for production environments. Evidence is keyed by `<releaseId>/<contentHash>.json`.
- **Cold path:** archival container for `extended` and `archival` retention classes after the standard window elapses.

All paths are append-only. The ledger writer enforces this in process via `GovernanceEvidenceLedger.append` (which rejects `id` collision) and at the storage tier via blob immutability policies.

## 4. Required wiring

`tooling/runtime-governance/write-evidence.mjs`:

1. Reads the canonical event envelope from stdin or a file.
2. Validates against `governanceEventEnvelopeSchema`.
3. Computes `contentHash` over the canonicalized payload.
4. Constructs a `LedgerRecord` with the appropriate retention/access class.
5. Appends to the local hot-path ledger and queues the upload.

The writer never mutates an existing record. Updates flow through `supersede()`.

## 5. Access discipline

| Access class | Default visibility |
|---|---|
| `platform-only` | Platform engineering on-call only. |
| `governance-forum` | Governance forum members + platform engineering. |
| `product-team` | Owning product team. |
| `external-attestation` | Released under attestation manifests for procurement / certification. |

Access classes are set at write time and cannot be relaxed without a supersession that explicitly cites the doctrine basis for the change.

## 6. Discipline

Evidence emission that turns into ungoverned data accumulation becomes a liability rather than an asset. Retention classes are not suggestions — they are governance instruments. The system should produce less evidence and more meaningful evidence over time, not more evidence and noisier evidence.
