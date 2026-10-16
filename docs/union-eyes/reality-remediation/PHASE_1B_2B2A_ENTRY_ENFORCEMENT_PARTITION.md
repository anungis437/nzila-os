# Phase 1B.2b2-A — Entry Enforcement Requirement & Equivalence Partition

## Gate

```
PHASE_1B_2B2_A_GATE = SOURCE_CEILING
PHASE_1B_2B2_A = SOURCE_CEILING_ACCEPTED
ENTRY_ENFORCEMENT_REQUIREMENT_UNIVERSE = CLOSED_WITH_EXPLICIT_SOURCE_CEILINGS
ENFORCEMENT_EQUIVALENCE_PARTITION = CLOSED
PHASE_1B_2B2_B_ENFORCEMENT_ADJUDICATION = AUTHORIZED
PHASE_1B_2B2_B_STARTED = NO
```

This is a source-only requirement model and lossless partition. It does not determine whether any entry is adequately authorized, secure, or vulnerable. Any `SOURCE_CEILING` value means the frozen accepted evidence does not establish that dimension; no application source was newly inspected.

## Denominator and partition

| Measure                                   |  Value |
| ----------------------------------------- | -----: |
| Accepted executable server entries        |   1910 |
| Unique entry records                      |   1910 |
| Enforcement cohorts                       |    249 |
| Compression ratio                         | 7.6707 |
| Cohorts eligible for shared adjudication  |    124 |
| Cohorts requiring entry-local review      |    125 |
| Entries requiring entry-local review      |    700 |
| Entries with a requirement source ceiling |    425 |

## Requirement arithmetic

| Dimension                           | Counts                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| IDENTITY_AUTHENTICATION_REQUIRED    | REQUIRED: 1868; NOT_REQUIRED: 19; CONTEXTUAL: 0; SOURCE_CEILING: 23                                                                  |
| ORGANIZATION_MEMBERSHIP_REQUIRED    | REQUIRED: 461; NOT_REQUIRED: 18; CONTEXTUAL: 1431; SOURCE_CEILING: 0                                                                 |
| ORGANIZATION_SCOPE_REQUIRED         | REQUIRED: 669; NOT_REQUIRED: 18; CONTEXTUAL: 1223; SOURCE_CEILING: 0                                                                 |
| ROLE_OR_PERMISSION_REQUIRED         | REQUIRED: 574; NOT_REQUIRED: 400; CONTEXTUAL: 936; SOURCE_CEILING: 0                                                                 |
| ADMIN_SCOPE_REQUIRED                | NOT_REQUIRED: 1632; APPLICATION_ADMIN: 0; ORGANIZATION_ADMIN: 0; SYSTEM_ADMIN: 8; SUPER_ADMIN: 0; CONTEXTUAL: 267; SOURCE_CEILING: 3 |
| RESOURCE_SCOPE_REQUIRED             | REQUIRED: 104; NOT_REQUIRED: 850; CONTEXTUAL: 926; SOURCE_CEILING: 30                                                                |
| SYSTEM_IDENTITY_REQUIRED            | REQUIRED: 6; NOT_REQUIRED: 1904; CONTEXTUAL: 0; SOURCE_CEILING: 0                                                                    |
| PROVIDER_AUTH_REQUIRED              | REQUIRED: 12; NOT_REQUIRED: 1898; CONTEXTUAL: 0; SOURCE_CEILING: 0                                                                   |
| ENTITLEMENT_REQUIRED                | REQUIRED: 77; NOT_REQUIRED: 0; CONTEXTUAL: 1833; SOURCE_CEILING: 0                                                                   |
| RLS_CONTEXT_EXPECTED                | REQUIRED: 208; NOT_REQUIRED: 1278; SYSTEM_BYPASS_EXPECTED: 89; CONTEXTUAL: 50; SOURCE_CEILING: 285                                   |
| PRIVILEGED_DB_PRECONDITION_REQUIRED | REQUIRED: 89; NOT_REQUIRED: 0; CONTEXTUAL: 1447; SOURCE_CEILING: 374                                                                 |

## Primitive linkage arithmetic

| Linkage status                          | Entries |
| --------------------------------------- | ------: |
| FULLY_LINKED_TO_RESOLVED_PRIMITIVES     |       0 |
| PARTIALLY_LINKED_TO_RESOLVED_PRIMITIVES |     568 |
| ENTRY_LOCAL_ENFORCEMENT                 |     381 |
| BOUNDARY_LINKAGE_SOURCE_CEILING         |     110 |
| NO_ENFORCEMENT_SIGNAL_OBSERVED          |     851 |
| NO_ENFORCEMENT_REQUIRED_BY_CONTRACT     |       0 |

## Historical page expectations

Preserved 43 records: 22 auth expectations and 21 organization-context expectations. Each is linked to its accepted server entry/cohort when a link exists, or explicitly marked not applicable when the census found no server-boundary link.

## Preserved carry-forwards

```json
{
  "AUTHORITY_SOURCE_CEILING_CARRY_FORWARD": 207,
  "R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD": 3,
  "R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS": 56,
  "R2C_RESOLVED_TARGET_CHAINS": 43,
  "TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD": 13,
  "TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD": 0,
  "TARGETLESS_EFFECT_STATIC_WORK_REMAINING": 0,
  "FROZEN_PHASE_1A_UNKNOWN_EFFECT_CARRY_FORWARD": 247,
  "STATIC_WORK_REMAINING": 0
}
```

The 20 accepted B2B1 primitive records are referenced without mutation; frozen primitive-array SHA-256: `dd2a7b990956870b0ada147b75c1696207687229c748ac3276bb610a6555aace`.

## Validation and scope

- Exact-once entries and a lossless cohort partition: PASS (0 multiple memberships; 0 missing memberships).
- Complete requirement fields and one linkage status/signature/cohort per entry: PASS.
- 1B.2a boundary findings and all B2B1 source-signal findings are linked or explicitly not applicable.
- No authorization-sufficiency verdict, runtime authentication, runtime database inspection, or product code change.
- B2B2-B is authorized but not started; Phase 1B.2 remains incomplete.
