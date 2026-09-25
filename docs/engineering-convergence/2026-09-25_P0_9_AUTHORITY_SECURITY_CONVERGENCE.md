# P0.9 Authority and Security Convergence

**Baseline:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

**Inspected lanes:** LANE-003, LANE-004, LANE-008, LANE-011, LANE-012,
LANE-021, LANE-024, LANE-025, LANE-027

**Ruling:** `AUTHORITY_CONVERGENCE = RECONCILIATION_REQUIRED`

This file fixes the intended architecture before security-sensitive code is
integrated. It does not authorize production, external-specialist onboarding,
support access, impersonation, or a pilot.

## Canonical architecture

The converged authority chain is:

```text
human or service credential
        |
@nzila/platform-auth identity verification
        |
server-resolved actor + organization membership + role/grant decision
        |
named application authorization boundary
        |
tenant transaction OR narrowly named privileged transaction
        |
PostgreSQL role grants + forced RLS
        |
durable audit/evidence record
```

No layer substitutes for the next one. Authentication does not grant product
authority; an application role does not bypass RLS; a database system role
does not authorize the caller that selected it.

## Fixed decisions

### Identity and sessions

- `@nzila/platform-auth` remains the only platform authentication authority.
- Entra and password sessions are provider paths behind that package, not
  competing app-level authorities.
- Tenant and organization selection must be resolved server-side from active
  membership. Client-supplied organization identifiers are constraints to
  verify, never authority to trust.
- The `PLAYWRIGHT_TEST_AUTH` seed-cookie bridge remains test-only and must be
  impossible in production configuration.

### Staging acceptance authentication

The current acceptance token design is retained as a staging proof mechanism:
it is explicitly enabled, requires a secret, requires both surface and
deployment environment to be staging, rejects production-like environments,
has a maximum fifteen-minute lifetime, checks issuer/audience/version, and
requires an allowlisted active user with active organization membership.

Acceptance authentication establishes identity only. It must continue through
the same membership, role, grant, application, and RLS checks as every other
session. It must never mint product permissions, platform-admin status, or a
system database principal. The secret must remain Key Vault-backed and must not
appear in logs or evidence artifacts.

### Database principals and RLS

- `union_eyes_runtime` is the ordinary tenant runtime role. It operates with
  both `app.current_user_id` and `app.current_org_id` set on the same
  transaction used by the query.
- `union_eyes_system` is a distinct, separately credentialed role. It is for
  authenticated background work, verified webhooks, migration/maintenance
  boundaries, and explicitly authorized cross-organization administration.
- Migration-admin credentials are deployment-time credentials only. They must
  be injected for a bounded step and unset immediately afterward.
- `AsyncLocalStorage` transaction routing is part of the security boundary for
  legacy no-argument callbacks. Removing it would detach queries from the
  context-bearing transaction.
- Forced RLS, role grants, and application authorization are all required.
  Broad table grants to a role are acceptable only where effective RLS policy
  coverage is proved for the exact schema.

### Privileged callers

`withSystemContext`, `withSystemRLSContext`,
`withPlatformAdminRLSContext`, and `withExplicitUserContext` are execution
mechanisms, not authorization mechanisms.

The converged rules are:

1. A request path must complete authentication and its named application
   authorization check before selecting a privileged execution context.
2. Ordinary same-organization mutations use tenant context, not system
   context.
3. A system operation has a bounded operation identifier, real actor or
   service identity, reason, target scope, and durable audit outcome.
4. Platform-admin execution additionally requires a current platform-level
   entitlement independent of tenant membership. Supplying an `adminId` to a
   helper is not proof of that entitlement.
5. Explicit-user context may represent only the authenticated actor or a
   separately approved impersonation grant. A raw target user ID is not
   authorization.

Current main contains a legacy `POST /api/claims` path that performs an
ordinary authenticated claim creation through `withSystemRLSContext`. That
must be converted to tenant execution or given a separately reviewed reason
and audit contract before the authority lane can pass. It must not be used as
a template.

### External specialists

External access remains grant-based and matter-bounded:

- representation authority is recorded explicitly;
- matter access and document access are separate grants;
- grants are scoped by organization, actor, matter, permissions, status, and
  expiry/revocation;
- routes re-resolve the resource server-side and enforce the required grant;
- RLS context is the real external actor and represented organization after
  the grant decision;
- uploads and downloads remain constrained to the authorized matter and
  produce attributable evidence.

No external specialist receives a generic tenant role, system context, or
organization-wide access merely because a representation relationship exists.

### Impersonation, support, and break-glass

There is no implied authorization for impersonation or support access in the
current context helpers. Any future surface requires a dedicated grant with
actor, subject, organization, purpose, ticket/reference, scope, expiry,
approval, revocation, and immutable start/end audit records.

Break-glass source and historical tables do not establish an active safe
break-glass capability. Existing deny-all/containment evidence remains the
default until a separately reviewed workflow proves approval, time bounds,
notification, audit, and revocation end to end.

### Control Plane

Control Plane authority is platform-scoped and distinct from Union Eyes
tenant administration. Tenant membership must not self-assign platform roles.
Cross-organization operational reads and mutations require a platform-level
entitlement from the canonical auth authority plus the named privileged
execution and evidence contract above.

## Lane dispositions

| Lane | Security disposition |
| --- | --- |
| LANE-003 | Integrate first: preserve server-side organization resolution, schema authority, and its RLS-context tests |
| LANE-004 | Port only after LANE-003; retain valid system/tenant transaction fixes but re-audit every request path that selects system context |
| LANE-008 | Reconcile commissioning and acceptance probes with canonical platform-auth; probes may prove identity paths but cannot create authority |
| LANE-011 | Review route/test changes component-by-component; reject the weaker duplicate credential migration |
| LANE-012 | Extract assignment and mutation-authority requirements; re-author against current guards, roles, audit model, and migration ownership |
| LANE-021 | Do not apply stash 16 wholesale; compare password handler changes against current platform-auth and treat TrustCore/contracts work separately |
| LANE-024 | Preserve external/employer/dispatch requirements; stale portal and schema code must be redesigned against current grant and tenant boundaries |
| LANE-025 | Historical cross-app auth/ML changes remain isolated pending a package-authority review |
| LANE-027 | Acceptance E2E source is eligible only after its environment, secret, actor, membership, and negative-path assertions are current |

## Required proof

The replacement authority lane must provide exact-head evidence for:

- one canonical platform-auth import boundary and no alternate live provider;
- acceptance auth disabled under every production-like environment matrix;
- expired, malformed, wrong-audience, non-allowlisted, inactive, and
  membership-less acceptance identities denied;
- server-side tenant resolution and cross-tenant negative tests;
- runtime and system connections using different database roles;
- ordinary requests unable to reach system execution without a named,
  pre-authorized boundary;
- all explicit-user, platform-admin, support, external-specialist, and
  service-principal paths attributable in durable audit evidence;
- zero unprotected tables in the accepted runtime schema and no RLS/grant
  drift after snapshot restore;
- no secret values in logs, generated reports, workflow output, or committed
  fixtures.

## Exit conditions

P0.9 can change to PASS only after P0.8 fixes the exact schema, every privileged
call site is classified, the ordinary-request elevation defect is resolved,
and the complete negative-path matrix passes on the replacement head.

Until then, the authority work is accounted for and its target architecture is
fixed, but Gate A remains closed.
