# Phase 1B.2a - Server authentication and boundary census

Source-only inventory of executable server entries and observable boundaries. This report does not prove runtime reachability, authentication correctness, organization isolation, authorization, RLS correctness, or product readiness.

## Gate and phase state

```text
PHASE_1A = SOURCE_CEILING_ACCEPTED
PHASE_1B_1 = SOURCE_CEILING_ACCEPTED
PHASE_1B_2A = CENSUS_COMPLETE
PHASE_1B_2A_GATE = PASS
PHASE_1B_2B = AUTHORIZED
PHASE_1B_2B_STARTED = NO
PHASE_1C_STARTED = NO
PHASE_1D_STARTED = NO
PHASE_2_STARTED = NO
STATIC_WORK_REMAINING = 0
TARGETLESS_DATABASE_EFFECTS_REMAINING = 56
R2B_AUTHORITY_SOURCE_CEILING_CARRY_FORWARD = 207
R2B_KNOWN_AUTHORITY_DEFECT_CARRY_FORWARD = 3
AUTHORIZATION_PROVEN = NO
ORG_SCOPE_ENFORCEMENT_PROVEN = NO
RLS_CORRECTNESS_PROVEN = NO
AUDIT_COMPLETENESS_PROVEN = NO
RUNTIME_PROVEN = NO
PRODUCT_READY = NO
PHASE_1B_2A_CENSUS_GATE = PASS
PHASE_1B_2B_AUTHORIZATION_AND_ORG_RESOURCE_ENFORCEMENT_CENSUS = AUTHORIZED
PHASE_1B_2B_STARTED = NO
```

## Scope and accounting

Source-only inventory of executable Union Eyes App Router HTTP exports, file-level server actions, explicitly client-exposed server functions, production-mounted financial-service Express handlers, and financial-service scheduled jobs.

- App Router route files: 967 (965 under App API; 2 outside App API).
- Executable entries: 1910; unique IDs: 1910.
- Financial-service mounted router files: 19.
- Production source files represented: 1008.

| Entry class                 | Entries |
| --------------------------- | ------: |
| APP_ROUTER_ROUTE_METHOD     |    1604 |
| NEXTAUTH_AUTH_HANDLER       |       3 |
| OTHER_EXPLICIT_SERVER_ENTRY |      99 |
| SCHEDULED_OR_CRON_HANDLER   |       6 |
| SERVER_ACTION               |     190 |
| WEBHOOK_HANDLER             |       8 |

## Observable boundary classifications

### AUDIENCE

| Classification        | Entries |
| --------------------- | ------: |
| ADMIN                 |     151 |
| AUTHENTICATED_GENERAL |     527 |
| EXECUTIVE             |       4 |
| GOVERNANCE            |     104 |
| MEMBER                |     142 |
| MIXED_OR_CONTEXTUAL   |     923 |
| PROVIDER_CALLBACK     |       5 |
| PUBLIC_INTENTIONAL    |      36 |
| STAFF                 |      12 |
| SYSTEM_INTERNAL       |       6 |

### AUTH_BOUNDARY_CLASS

| Classification               | Entries |
| ---------------------------- | ------: |
| AUTH_REQUIRED_DIRECT         |     322 |
| AUTH_REQUIRED_VIA_WRAPPER    |     386 |
| INTERNAL_TRUST_BOUNDARY      |       6 |
| NO_AUTH_BOUNDARY_OBSERVED    |    1177 |
| PROVIDER_SIGNATURE_OR_SECRET |       9 |
| PUBLIC_EXPLICIT              |      10 |

### ORG_CONTEXT_CLASS

| Classification             | Entries |
| -------------------------- | ------: |
| NO_ORG_CONTEXT_OBSERVED    |    1215 |
| ORG_CONTEXT_DIRECT         |     583 |
| ORG_CONTEXT_NOT_APPLICABLE |      25 |
| ORG_CONTEXT_VIA_WRAPPER    |      87 |

### ROLE_CHECK_CLASS

| Classification                       | Entries |
| ------------------------------------ | ------: |
| NO_ROLE_OR_PERMISSION_CHECK_OBSERVED |    1837 |
| ROLE_CHECK_DIRECT                    |      73 |

### PERMISSION_CHECK_CLASS

| Classification                       | Entries |
| ------------------------------------ | ------: |
| NO_ROLE_OR_PERMISSION_CHECK_OBSERVED |    1910 |

### ADMIN_CHECK_CLASS

| Classification                       | Entries |
| ------------------------------------ | ------: |
| ADMIN_CHECK_DIRECT                   |       5 |
| NO_ROLE_OR_PERMISSION_CHECK_OBSERVED |    1905 |

### RESOURCE_CHECK_CLASS

| Classification                | Entries |
| ----------------------------- | ------: |
| NO_RESOURCE_CHECK_OBSERVED    |     956 |
| RESOURCE_CHECK_DIRECT         |     104 |
| RESOURCE_CHECK_NOT_APPLICABLE |     850 |

### ENTITLEMENT_CHECK_CLASS

| Classification                | Entries |
| ----------------------------- | ------: |
| ENTITLEMENT_CHECK_DIRECT      |      77 |
| NO_ENTITLEMENT_CHECK_OBSERVED |    1833 |

### RLS_CONTEXT_CLASS

| Classification          | Entries |
| ----------------------- | ------: |
| NOT_APPLICABLE          |    1297 |
| NO_RLS_CONTEXT_OBSERVED |     404 |
| RLS_CONTEXT_DIRECT      |     209 |

Entries missing a required classification: 0.

These values describe source signals only. `NO_*_OBSERVED` does not mean that a route is intentionally public or reachable without controls; `MIXED_OR_CONTEXTUAL` does not prove an audience boundary.

## Follow-up signals

- Entries marked as direct security-boundary follow-up: 679.
- Explicit privileged database paths: 0.
- These are census signals for Phase 1B.2b, not security findings or proof of an exploitable condition.

## Historical page expectations

- Auth expectations preserved: 22.
- Organization-context expectations preserved: 21.
- Separate category-specific records preserved: 43 across 23 page files.
- Overlapping page expectations remain separate obligations; server-entry links are bounded static references only.

| Expectation type                      | Records |
| ------------------------------------- | ------: |
| PAGE_AUTH_EXPECTATION_UNPROVEN        |      22 |
| PAGE_ORG_CONTEXT_EXPECTATION_UNPROVEN |      21 |

## Frozen prior-phase state

- Phase 1B.1: `SOURCE_CEILING_ACCEPTED`; static work remaining: 0.
- R2B authority source ceilings: 207; known authority defects: 3.
- R2C targetless effects: 56; explicit target ceilings: 13.
- Phase 1B.2b is authorized but not started.

## Limitations and handoff

- Static source references do not establish that authentication, organization scope, role/permission, resource ownership, entitlement, or RLS checks are correct or sufficient.
- Absence of a source-level boundary signal does not establish anonymous reachability; external middleware and deployment controls are outside this census.
- The page-to-entry links are bounded static references and do not prove runtime journey reachability.

TypeScript AST and bounded source-text classification only. No application launch, runtime authentication, runtime database, migration, or database write.

## Determinism and validation

```text
node --check scripts/ue/census-server-auth-boundaries.mjs
node scripts/ue/census-server-auth-boundaries.mjs
node scripts/ue/census-server-auth-boundaries.mjs --check
pnpm exec prettier --check scripts/ue/census-server-auth-boundaries.mjs docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.json docs/union-eyes/reality-remediation/PHASE_1B_2A_SERVER_AUTH_BOUNDARY_CENSUS.md
pnpm validate:docs
```

No application, runtime authentication, runtime database, migration, or database write was executed.
