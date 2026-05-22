# OCI Intelligence Contracts

**Artifact type:** Doctrine
**Module:** OCI Intelligence Network
**Doctrine version:** 1.0.0
**Posture:** narrow · anonymised · reviewer-traceable · refusal-first

---

These contracts are the single source of truth for the shapes that flow
between OCI intelligence engines. They are intentionally narrow: every
contract carries the minimum institutional context required for the network
to remain readable while preserving anonymity.

## Shared bands

| Band family                          | Members                                                          |
| ------------------------------------ | ---------------------------------------------------------------- |
| `ContinuityTrajectoryBand`           | `not_yet_readable`, `holding`, `stabilizing`, `regressing`       |
| `GovernanceDriftBand`                | `not_yet_readable`, `stabilizing`, `holding`, `regressing`       |
| `StewardshipEvolutionBand`           | `not_yet_readable`, `redistributing`, `holding`, `reconcentrating` |
| `SurvivabilityProgressionBand`       | `not_yet_readable`, `strengthening`, `holding`, `weakening`      |
| `ContinuityDebtTrend`                | `not_yet_readable`, `reducing`, `holding`, `accumulating`        |
| `InstitutionalResilienceBand`        | `not_yet_readable`, `persisting`, `holding`, `eroding`           |

Every band family carries `not_yet_readable` so refusal is a first-class outcome.

## Sectors

`IntelligenceSector` is a closed set:

- `labour_union`
- `federated_organization`
- `healthcare`
- `nonprofit_advocacy`
- `regulatory_governance`
- `membership_organization`

Sectors are intentionally coarse so the network cannot infer specific
institutions from sector membership alone.

## Anonymisation handle

`AnonymisedInstitutionHandle` carries exactly three fields: `institutionRefHash`,
`sector`, and `contributedAt`. Any additional key on the handle is treated as
an exposure breach and refused at ingest.

## Record kinds

| Contract                              | Purpose                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `ContinuityTrajectoryRecord`          | Single longitudinal reading of continuity posture             |
| `GovernanceEntropyDriftRecord`        | Successive reading of governance entropy                      |
| `StewardshipEvolutionRecord`          | Single reading of stewardship concentration evolution         |
| `SurvivabilityProgressionRecord`      | Single reading of onboarding survivability progression        |
| `ContinuityDebtEvolutionRecord`       | Single reading of continuity debt evolution                   |
| `SectorBaselineEnvelope`              | Sector aggregation envelope; refuses below k-anonymity floor  |
| `InstitutionalResilienceSignal`       | Reviewer-readable signal carried with a resilience reading    |

## Participation

`IntelligenceParticipationGrant` is the opt-in record. `ParticipationScope` is
a closed set covering each record kind. Granting one scope does **not** imply
consent for another.

## Cross-references

- `docs/oci/intelligence/OCI_INTELLIGENCE_NETWORK.md`
- `docs/oci/intelligence/OCI_INTELLIGENCE_ETHICS.md`
- `docs/oci/runtime/OCI_RUNTIME_CONTRACTS.md`
- `docs/oci/OCI_DATA_HANDLING.md`
