# Deployment Legitimacy Validation Engine

> **Status:** Canonical runtime governance · **Layer:** Deployment legitimacy validation · **Inherits:** [../nzila-assurance/environment-governance-assurance.md](../nzila-assurance/environment-governance-assurance.md), [../nzila-governance/continuity-safe-deployment-governance.md](../nzila-governance/continuity-safe-deployment-governance.md)

The **deployment legitimacy validation engine** continuously validates that every running release is legitimate: identifiable, manifest-bound, environment-isolated, migration-correct, traceable, and reversible. It runs in production, not at deploy time only.

---

## 1. Posture

The engine:

- **Validates** the running release against the deployment manifest
- **Validates** environment identity against expected provenance
- **Validates** migration parity against schema baselines
- **Validates** isolation invariants per scope
- **Validates** rollback legitimacy on demand
- **Emits** governance events on any failure
- **Refuses** unknown-release operation on doctrine-critical paths

A release that cannot be identified is a release that cannot be governed.

---

## 2. Required Validations

| Validation | Reads |
|------------|-------|
| Environment identity | Environment label, provenance, declared isolation class |
| Release metadata | Commit SHA, manifest hash, build provenance |
| Migration parity | Schema version vs. manifest expectations |
| Environment isolation | Cross-environment data flow invariants |
| Seed legitimacy | Seed provenance, seed manifest hash |
| Pilot isolation | Pilot data does not appear on production read paths and vice versa |
| Deployment traceability | Manifest → commit → reviewer chain |
| Rollback legitimacy | Rollback target is itself manifest-bound and attested |

---

## 3. Required Fail States

Emitted (typed in [packages/governance-telemetry](../../packages/governance-telemetry)):

- `unknown_release_state` — running code cannot be identified against any manifest
- `environment_drift_detected` — environment has drifted from declared identity
- `deployment_identity_failure` — release id, commit, and manifest do not coherently bind
- `migration_parity_failure` — schema version mismatches manifest expectations
- `isolation_violation` — pilot/production/demo isolation invariant broken

Each fail state carries severity and the doctrine-bound remediation path.

---

## 4. Required Implementation Surfaces

Materialized in [packages/governance-runtime](../../packages/governance-runtime):

- **Release identity reader** — reads running release id, commit SHA, manifest hash from runtime
- **Manifest store reader** — reads expected manifest from registry
- **Environment identity verifier** — verifies environment provenance
- **Migration parity checker** — verifies schema vs. manifest expectations
- **Isolation invariant checker** — runs cross-environment checks at sampling cadence (aggregation-safe)
- **Rollback legitimacy verifier** — verifies rollback target manifest before rollback execution

---

## 5. Cadence

- **At process start** — full validation; failure is fatal
- **At configuration change** — full validation; failure is event-emitting
- **Continuously** — sampled isolation invariant checks; aggregation-safe
- **At rollback request** — full rollback legitimacy validation; failure aborts rollback
- **At each pilot activation** — full pilot isolation validation

---

## 6. Decision Posture

| Failure | Default Posture |
|---------|-----------------|
| `unknown_release_state` | Fail closed on doctrine-critical paths |
| `environment_drift_detected` | Fail closed on cross-environment paths |
| `deployment_identity_failure` | Fail closed; alert at critical |
| `migration_parity_failure` | Fail closed for write paths; degrade for read paths |
| `isolation_violation` | Fail closed; alert at critical |

Fail-open is permitted only for non-doctrine-critical paths and is explicitly recorded.

---

## 7. Anti-Patterns

- Validation only at deploy time
- Manifest hash assumed but not verified
- Environment label trusted from configuration without provenance verification
- Sampling so sparse that violations pass for hours
- Rollback to unattested target permitted
- Isolation checks downgraded for performance
- Failure events suppressed to "reduce noise"

---

## 8. External Posture

The engine's outputs feed:

- The [governance evidence ledger](governance-evidence-ledger.md)
- The [runtime attestation pipeline](runtime-attestation-pipeline.md) (deployment + environment legitimacy attestations)
- Procurement evidence packs ([../nzila-assurance/procurement-assurance-framework.md](../nzila-assurance/procurement-assurance-framework.md))

A deployment that cannot pass continuous validation cannot honestly be presented as deployed.

---

## 9. Discipline

Deployment legitimacy validation is the institutional discipline of saying *we know exactly what is running, where, under what doctrine, and how to reverse it — at every moment, not just at the moment of release.*

This is what separates a governed deployment from a deployed artifact.
