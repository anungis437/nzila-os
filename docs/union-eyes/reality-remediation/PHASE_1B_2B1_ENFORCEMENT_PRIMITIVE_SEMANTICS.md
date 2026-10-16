# Phase 1B.2b1 — Enforcement Primitive Semantics

## Gate

```
PHASE_1B_2B1 = SOURCE_CEILING_ACCEPTED
PHASE_1B_2B1_GATE = SOURCE_CEILING
PHASE_1B_2B2 = AUTHORIZED
PHASE_1B_2B2_STARTED = NO
```

The accepted census contains 1910 entries (1910 unique IDs). The frozen registry preserves 20 source-resolved primitive semantics. Its source model is `SOURCE_ONLY_STATIC_CALLSITE_REGISTRY`; the qualification is: Static callsites preserve the accepted source-only primitive semantics; no complete wrapper-boundary or privileged-database-path linkage is established. The census-to-reusable-primitive linkage remains `SOURCE_CEILING`. The B2B1 gate therefore remains `SOURCE_CEILING`; this does not negate the 20 preserved primitive semantics.

The primitive array's pre-normalization and post-normalization SHA-256 digests are both `dd2a7b990956870b0ada147b75c1696207687229c748ac3276bb610a6555aace`. Preservation asserted: `YES`.

## Callable primitive registry

| Primitive             | Domain                          | Symbol                       | Entry exposures | Implementation anchor                                                                                                                              |
| --------------------- | ------------------------------- | ---------------------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| UE-B2B1-PRIMITIVE-001 | AUTHENTICATION                  | `auth`                       |              83 | [packages/platform-auth/src/entra/server.ts](../../../packages/platform-auth/src/entra/server.ts)#L76                                              |
| UE-B2B1-PRIMITIVE-002 | AUTHENTICATION                  | `currentUser`                |               3 | [packages/platform-auth/src/entra/server.ts](../../../packages/platform-auth/src/entra/server.ts)#L261                                             |
| UE-B2B1-PRIMITIVE-003 | AUTHENTICATION                  | `getCurrentUser`             |              35 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L449                                                       |
| UE-B2B1-PRIMITIVE-004 | ORGANIZATION_CONTEXT            | `getOrganizationIdForUser`   |              18 | [apps/union-eyes/lib/organization-utils.ts](../../../apps/union-eyes/lib/organization-utils.ts)#L61                                                |
| UE-B2B1-PRIMITIVE-005 | ROLE_PERMISSION                 | `hasMinRole`                 |              71 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1216                                                      |
| UE-B2B1-PRIMITIVE-006 | ADMIN_AUTHORIZATION             | `isSystemAdmin`              |               1 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1016                                                      |
| UE-B2B1-PRIMITIVE-007 | ADMIN_AUTHORIZATION             | `requireSystemAdmin`         |               1 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1039                                                      |
| UE-B2B1-PRIMITIVE-008 | AUTHENTICATION                  | `requireUser`                |               2 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L912                                                       |
| UE-B2B1-PRIMITIVE-009 | ORGANIZATION_MEMBERSHIP         | `requireUserForOrganization` |               4 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L930                                                       |
| UE-B2B1-PRIMITIVE-010 | AUTHENTICATION                  | `requireAuth`                |               4 | [apps/union-eyes/lib/auth/rbac-server.ts](../../../apps/union-eyes/lib/auth/rbac-server.ts)#L295                                                   |
| UE-B2B1-PRIMITIVE-011 | ADMIN_AUTHORIZATION             | `requireAdmin`               |               3 | [apps/union-eyes/lib/auth/rbac-server.ts](../../../apps/union-eyes/lib/auth/rbac-server.ts)#L348                                                   |
| UE-B2B1-PRIMITIVE-012 | API_AUTHENTICATION_WRAPPER      | `withApiAuth`                |              65 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1890                                                      |
| UE-B2B1-PRIMITIVE-013 | ROLE_PERMISSION_WRAPPER         | `withRoleAuth`               |              97 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1266                                                      |
| UE-B2B1-PRIMITIVE-014 | ROLE_PERMISSION_WRAPPER         | `withRoleAuth`               |               6 | [apps/union-eyes/lib/role-middleware.ts](../../../apps/union-eyes/lib/role-middleware.ts)#L78                                                      |
| UE-B2B1-PRIMITIVE-015 | ROLE_PERMISSION_WRAPPER         | `withMinRole`                |              17 | [apps/union-eyes/lib/api-auth-guard.ts](../../../apps/union-eyes/lib/api-auth-guard.ts)#L1348                                                      |
| UE-B2B1-PRIMITIVE-016 | ORGANIZATION_MEMBERSHIP_WRAPPER | `withOrganizationAuth`       |              52 | [apps/union-eyes/lib/organization-middleware.ts](../../../apps/union-eyes/lib/organization-middleware.ts)#L36                                      |
| UE-B2B1-PRIMITIVE-017 | RLS_CONTEXT                     | `withRLSContext`             |             208 | [apps/union-eyes/lib/db/with-rls-context.ts](../../../apps/union-eyes/lib/db/with-rls-context.ts)#L67                                              |
| UE-B2B1-PRIMITIVE-018 | PRIVILEGED_DATABASE_CONTEXT     | `withSystemContext`          |              89 | [apps/union-eyes/lib/db/with-rls-context.ts](../../../apps/union-eyes/lib/db/with-rls-context.ts)#L280                                             |
| UE-B2B1-PRIMITIVE-019 | ENTITLEMENT_CHECK               | `checkEntitlement`           |               7 | [apps/union-eyes/lib/services/entitlements.ts](../../../apps/union-eyes/lib/services/entitlements.ts)#L176                                         |
| UE-B2B1-PRIMITIVE-020 | ENTITLEMENT_CHECK               | `requireEntitlement`         |              70 | [apps/union-eyes/services/platform-economics/entitlement-guard.ts](../../../apps/union-eyes/services/platform-economics/entitlement-guard.ts)#L443 |

Each JSON record includes the exact census entry IDs and evidence call-site lines, import paths, implementation declaration anchor and file digest, observed invocation order, dependencies, behavior, failures, and fallback behavior. Exposure counts represent static source references only.

## Census signals not resolved as callable primitives

| Signal           | Category                            | Treatment                                                                                |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `ROLE_HIERARCHY` | NON_CALLABLE_IDENTIFIER_OR_CONSTANT | Identifier or constant signal, not a callable primitive.                                 |
| `authenticate`   | UNRESOLVED_CENSUS_SIGNAL            | Census signal was not included as a source-resolved callable primitive in this registry. |
| `canAccess`      | UNRESOLVED_CENSUS_SIGNAL            | Census signal was not included as a source-resolved callable primitive in this registry. |
| `isAdmin`        | UNRESOLVED_CENSUS_SIGNAL            | Census signal was not included as a source-resolved callable primitive in this registry. |
| `orgId`          | NON_CALLABLE_IDENTIFIER_OR_CONSTANT | Identifier or constant signal, not a callable primitive.                                 |
| `organizationId` | NON_CALLABLE_IDENTIFIER_OR_CONSTANT | Identifier or constant signal, not a callable primitive.                                 |
| `ownerId`        | NON_CALLABLE_IDENTIFIER_OR_CONSTANT | Identifier or constant signal, not a callable primitive.                                 |
| `tenantId`       | NON_CALLABLE_IDENTIFIER_OR_CONSTANT | Identifier or constant signal, not a callable primitive.                                 |

## R2C accounting and carry-forward state

```
R2C_INPUT_TARGETLESS_DATABASE_EFFECT_CHAINS = 56
R2C_TARGETLESS_EFFECT_CHAINS_RESOLVED = 43
R2C_TARGET_RESOLUTION_SOURCE_CEILING_CARRY_FORWARD = 13
R2C_TARGET_RESOLUTION_KNOWN_DEFECT_CARRY_FORWARD = 0
TARGETLESS_EFFECT_STATIC_WORK_REMAINING = 0
AUTHORITY_SOURCE_CEILING_CARRY_FORWARD = 207
AUTHORITY_KNOWN_DEFECT_CARRY_FORWARD = 3
FROZEN_PHASE1A_UNKNOWN_EFFECT_CARRY_FORWARD = 247
STATIC_WORK_REMAINING = 0
PHASE_1B_2B2 = AUTHORIZED
PHASE_1B_2B2_STARTED = NO
PHASE_1C_STARTED = NO
PHASE_1D_STARTED = NO
PHASE_2_STARTED = NO
```

The 56-chain figure is R2C's historical input denominator, not remaining static work. R2C resolved 43 chains, carried 13 target-resolution source ceilings, established 0 new target defects, and left 0 static work remaining.

## Limitations

- The accepted census has an empty WRAPPER_BOUNDARY_GRAPH and no recorded PRIVILEGED_DATABASE_PATHS. This registry therefore cannot claim complete wrapper composition or privileged-database-path coverage.
- Import paths, source declarations, and static call sites do not prove runtime reachability or successful enforcement.
- No resource-permission callable or independently verified privileged-database path is established by this extracted denominator; do not interpret that as absence in runtime.
- The source ranges establish only direct calls to the listed helpers; hidden indirection, dynamic behavior, external middleware, database policies, and runtime identity remain outside this registry.
- Census signal names not represented as source-resolved callable primitives are preserved below as excluded signals, not silently treated as enforced controls.

No application source was reopened or modified for this state normalization. No runtime authentication, authorization, database, migration, or database-write validation was performed. The registry is not evidence of authorization correctness, RLS correctness, audit completeness, or product readiness.
