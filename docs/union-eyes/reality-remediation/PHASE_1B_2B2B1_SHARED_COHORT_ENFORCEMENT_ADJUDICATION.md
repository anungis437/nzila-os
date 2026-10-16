# Phase 1B.2b2-B1 — Shared-Cohort Source-Enforcement Adjudication

## Gate and state

- **PHASE_1B_2B2_B1_GATE:** `SOURCE_CEILING`
- **PHASE_1B_2B2_B1:** `SOURCE_CEILING_ACCEPTED`
- **Phase 1B.2:** `NOT_YET_COMPLETE`
- **B2 entry-local review:** `AUTHORIZED_NOT_STARTED`
- **B2 started:** `NO`
- **Runtime authorization, organization/resource scope, RLS correctness, and product readiness proven:** `NO`

The source ceiling means this report adjudicates only the shared cohorts supported by the accepted static evidence. It does not imply an entry is absent, unused, runtime-broken, or exploitable.

## Frozen denominators

| Measure                                                   | Count |
| --------------------------------------------------------- | ----: |
| Accepted entries                                          |  1910 |
| Accepted cohorts                                          |   249 |
| Shared-adjudication cohorts in the frozen partition       |   124 |
| Shared-adjudication entries in the frozen partition       |  1210 |
| Entry-local cohorts in the frozen partition               |   125 |
| Entry-local entries in the frozen partition               |   700 |
| Cohorts actually adjudicated after equivalence validation |   124 |
| Entries deferred to B2                                    |   700 |
| Historical page expectations retained open                |    43 |

## Shared cohort dispositions

| Disposition                              | Cohorts |
| ---------------------------------------- | ------: |
| `SOURCE_ENFORCEMENT_MATCH`               |      14 |
| `NO_OBSERVED_ENFORCEMENT_MISSING`        |      52 |
| `OBSERVED_ENFORCEMENT_SEMANTICS_PARTIAL` |      58 |
| `SOURCE_REQUIREMENT_CEILING`             |       0 |
| `SOURCE_BOUNDARY_LINKAGE_CEILING`        |       0 |
| `MIXED_SOURCE_ENFORCEMENT_RESULT`        |       0 |

## Dimension-level known gaps

| Dimension                  | Cohorts with gap | Affected entries | Missing | Partial |
| -------------------------- | ---------------: | ---------------: | ------: | ------: |
| IDENTITY_AUTHENTICATION    |               43 |              969 |      32 |      11 |
| ORGANIZATION_MEMBERSHIP    |               43 |              297 |      23 |      20 |
| ORGANIZATION_SCOPE         |               64 |              187 |       0 |      64 |
| ROLE_OR_PERMISSION         |               31 |              279 |      31 |       0 |
| ADMIN_SCOPE                |                0 |                0 |       0 |       0 |
| RESOURCE_SCOPE             |                0 |                0 |       0 |       0 |
| SYSTEM_IDENTITY            |                0 |                0 |       0 |       0 |
| PROVIDER_AUTH              |                2 |                3 |       2 |       0 |
| ENTITLEMENT                |                0 |                0 |       0 |       0 |
| RLS_CONTEXT                |                0 |                0 |       0 |       0 |
| PRIVILEGED_DB_PRECONDITION |               32 |               89 |       0 |      32 |

Known gaps are bounded findings about the accepted source contracts. A partial semantic signal is not reported as complete enforcement. A direct organization-context signal is not treated as organization membership or as a resource/query predicate. Entitlement checks are not treated as authorization. RLS context setup does not establish RLS policy correctness. Privileged DB context does not establish the expected caller precondition or its order.

## Source ceilings and B2 review

- Requirement source-ceiling entries: 425 (715 dimension records).
- Boundary-linkage source-ceiling entries: 110.
- Source-ceiling register records: 825.
- B2 local-review register: 700 exact entries across 125 cohorts.
- Each B2 register entry names the `SOURCE_FILE` already present in the accepted census as `REQUIRED_SOURCE_PATH`.
- No B2 review was started.

## Historical page expectations (not closed)

| B1 annotation              | Expectations |
| -------------------------- | -----------: |
| `ALL_LINKED_ENTRIES_MATCH` |            0 |
| `KNOWN_ENFORCEMENT_GAP`    |            0 |
| `SOURCE_CEILING`           |           43 |
| `B2_LOCAL_REVIEW_REQUIRED` |            0 |

No historical expectation has a linked B1 entry or cohort in the accepted partition; each is therefore annotated at source ceiling. These annotations leave all 43 expectations open and do not close them.

## Preserved phase carry-forwards

- R2B authority source ceilings: 207.
- R2B known authority/configuration defects: 3.
- R2C targetless database effects: 56; resolved target chains: 43; target-resolution source-ceiling carry-forward: 13.
- Frozen Phase 1A unknown-effect carry-forward: 247.
- Accepted primitive semantics: 20; array SHA-256: `dd2a7b990956870b0ada147b75c1696207687229c748ac3276bb610a6555aace`.

## Validation and scope

- Exact-once entry accounting across B1 adjudications and B2 deferrals: **PASS**.
- Exact-once cohort accounting: **PASS**.
- Cohort results propagated to every adjudicated member: **PASS**.
- Finite census source path recorded for every B2 entry: **PASS**.
- Historical expectation status counts sum to 43 and all remain open: **PASS**.
- Frozen 20-primitive array preserved: **PASS**.
- No new application source or runtime database inspection, migration, or database write: **YES**.
- B2 started: **NO**.

Machine-readable cohort results, entry dispositions, defect/ceiling registers, historical linkage, and validation assertions are in the JSON report (`PHASE_1B_2B2B1_SHARED_COHORT_ENFORCEMENT_ADJUDICATION.json`, not committed).
