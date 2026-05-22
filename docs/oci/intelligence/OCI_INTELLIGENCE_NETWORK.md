# OCI Intelligence Network™

**Artifact type:** Doctrine
**Module:** OCI Intelligence Network
**Doctrine version:** 1.0.0
**Posture:** reviewer-led · refusal-first · anti-surveillance · opt-in only

---

## What this is

The OCI Intelligence Network™ is the longitudinal continuity intelligence
backbone of OCI. It aggregates **anonymised** continuity readings contributed
**voluntarily** by institutions, so that reviewers can understand how
institutional continuity evolves over time without reducing institutions to
metrics.

## What this is not

This is not predictive governance AI, surveillance analytics, enterprise
observability, workforce scoring, or institutional ranking infrastructure.

The network does not — and will not — rank institutions, expose institutions
publicly, infer worker performance, or operationalise institutional reputation.

## What it aggregates

The network may aggregate, for institutions that have opted in per scope:

| Scope                       | Reading kind                                |
| --------------------------- | ------------------------------------------- |
| `continuity_trajectory`     | Maturity bands over time                    |
| `governance_drift`          | Entropy drift bands over time               |
| `stewardship_evolution`     | Redistribution bands over time              |
| `survivability_progression` | Onboarding survivability bands over time    |
| `continuity_debt`           | Continuity debt trend over time             |

## Hard ethical floors

The network always enforces, in order:

1. **Anonymisation integrity.** Every record carries only an opaque
   `institutionRefHash`, the institution's declared `sector`, and a contribution
   timestamp. Anything else is refused at ingest.
2. **Opt-in participation.** Each scope is granted separately. A grant for
   `governance_drift` does not imply a grant for `stewardship_evolution`.
3. **Reviewer reference.** Every record carries the reviewer reference inside
   the contributing institution. Records without a reviewer reference are
   refused.
4. **k-anonymity floor.** Sector aggregations refuse to return a readable
   envelope below `K_ANONYMITY_FLOOR = 5` contributing institutions. The
   refusal envelope carries zeroed distributions and `readable: false`.
5. **No ranking payload.** Aggregation outputs are scanned for forbidden keys
   (`rank`, `ranking`, `leaderboard`, `percentile`, `peerScore`,
   `reputationScore`, `prestige`, `topPerformers`, `bestInClass`,
   `worstInClass`). Any such key refuses the output.

## Withdrawal

Withdrawal removes the institution from future aggregations from the withdrawal
timestamp onward. The network never claims previously-published aggregations
were "wrong"; it simply stops including the institution.

## Modules

| Module                                                          | Role                                            |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `continuityIntelligenceRegistry.ts`                             | Opt-in participation registry                   |
| `intelligenceNetworkEngine.ts`                                  | Ingest + compose pipeline                       |
| `networkAggregationModel.ts`                                    | Sector baseline composition with k-anonymity    |

## Cross-references

- `docs/oci/intelligence/OCI_INTELLIGENCE_ETHICS.md`
- `docs/oci/intelligence/OCI_INTELLIGENCE_CONTRACTS.md`
- `docs/oci/intelligence/OCI_OBSERVATORY_FOUNDATIONS.md`
- `docs/oci/intelligence/OCI_INTELLIGENCE_PLATFORM_ALIGNMENT.md`
- `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/oci/OCI_AI_BOUNDARY.md`
- `docs/oci/OCI_DATA_HANDLING.md`
