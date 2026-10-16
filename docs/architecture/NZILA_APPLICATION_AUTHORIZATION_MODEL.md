# NzilaOS Application Authorization Model

> **Doctrine: frozen by maintainer decision.**
>
> The canonical contracts, additive schema, resolver, Cora adapter, shared
> authorization-decision writer, and application-scoped Cora acceptance
> identity are implemented in source. Phases 3A and 3B passed against isolated,
> disposable local PostgreSQL databases. Migration
> `0041_platform_authorization_authority.sql` remains unapplied to every durable,
> shared, staging, or production environment; no legacy data was migrated and
> no production authority was provisioned. Current disposition:
> `PASS_WITH_LIMITATIONS`.

## Target authorization chain

```text
authenticated external identity
  → verified identity binding
  → canonical platform user
  → active organization membership
  → explicitly selected organization
  → server-owned, application-scoped effective permissions
  → application authorization context
  → separate resource/evidence authority decision when needed
```

Authentication establishes an external identity. It does not establish a
platform user, organization membership, permission, or entitlement to a
particular resource. Each arrow must be resolved by server-owned state and
fail closed when that state is absent, ambiguous, inactive, or inconsistent.

**Provider posture:** Entra is a secondary sign-in option. The primary
sign-in path remains intentionally unspecified. Authenticated providers
resolve through a verified `provider + provider subject` binding; Entra tenant
and object IDs form its namespaced subject, while Entra group claims do not
establish membership or grants.

## Repository findings

### 1. External identity and platform user

`user_management.users.user_id` is the platform-principal key. The new
`platform_identity_bindings` model maps a provider namespace and provider-owned
subject to that key; the resolver fails closed on missing, disabled, revoked,
or not-yet-verified bindings and inactive principals. The existing `auth()`
compatibility result still exposes provider IDs as `userId` to legacy
consumers; Cora uses separate provider and subject fields and does not treat
that compatibility value as its actor ID.

For the first-party password session, `nzila-password` uses the stable local
account key as its provider subject rather than mutable email. This labels the
authentication mechanism; it does not designate password auth as the primary
provider.

`platform_identity_bindings` has provider/subject uniqueness, a platform-user
foreign key, active/disabled/revoked state, verification time, provisioner,
disable/revoke metadata, and timestamps. The existing
`user_management.oauth_providers` record remains a legacy provider record; it
is not promoted to canonical binding authority.

The shared `authUsers` record now includes account source and lifecycle fields
(`accountSource`, `lifecycleState`, `lifecycleReason`,
`lifecycleChangedAt`, and `lifecycleChangedBy`). These improve local account
lifecycle tracking, but do not bind a provider subject to a platform user or
establish a cross-provider identity authority.

`@nzila/platform-integrations`' identity linker maps external business-system
entities to internal entities under an org and connection. It is not a
platform-user authentication binding and must not be repurposed as one.

### 2. Membership authority and organization selection

The repository contained distinct membership records:

| Source                                        | Observed semantics                                                                                                                                           | Classification for platform authorization                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `platform_organization_memberships` (new)     | Platform-user/org FK, state (`active`, `invited`, `suspended`, `revoked`), role assignment, provisioning source, effective period, actor/timestamp metadata. | **Canonical authority** for new platform authorization resolution. |
| `user_management.organization_users`          | User/org/role, `permissions` JSON, `isActive`, `isPrimary`, invite/join timestamps. Password auth and Union Eyes role resolution use it.                     | `COMPATIBILITY_PROJECTION`; not queried by the canonical resolver. |
| `org_members` in the shared org schema        | User/org/role and `active`/`suspended`/`removed` status; distinct from `organization_users`.                                                                 | `PRODUCT_DOMAIN_RECORD`; not canonical auth membership.            |
| ABR `abr_users`                               | ABR-specific role and active flag; ABR guards verify requested org through it.                                                                               | `LEGACY_AUTHORITY`; no migration in this phase.                    |
| Union Eyes membership and authorization paths | Product-specific user context, membership lookup, and domain/resource grants; legacy and newer paths coexist.                                                | `LEGACY_AUTHORITY`; no migration in this phase.                    |

Canonical memberships reference `user_management.users` and the shared `orgs`
institution, and check both principal and organization lifecycle. Existing
membership rows remain untouched. `organization_users.permissions` is
explicitly **`LEGACY_PERMISSION_METADATA`**; it is not read as permission
storage or cache and cannot grant access.

Canonical selection verifies an explicit org against an active membership; if
none is supplied, exactly one active membership is required. More than one
returns `AMBIGUOUS_ORGANIZATION`; the resolver never picks the first row.
Entra's existing first-group selector remains tagged `entra-group-legacy` for
unrelated applications, but Cora ignores it. Password auth's legacy default
membership is likewise ignored by Cora.

### 3. Roles, permissions, and application scope

The new `platform_application_permission_grants` authority binds each grant
to a canonical membership, organization, exact application, and permission,
with state, source, effective time, expiry, and grant/revocation actors. It
rejects wildcard and out-of-namespace grants. `@nzila/platform-auth` resolves
only active and effective grants for the requested application; role does not
grant permission.

Permission derivation is implemented in individual apps. For example, ABR
maps ABR roles to ABR permissions, while Agrimo and other applications have
their own role-derived permission lists. These are app-level implementations,
not a canonical platform grant registry. Role and permission must remain
distinct: a role label does not by itself establish access to a consequential
capability. App-scoped grants must not cross-authorize Cora, Union Eyes, or
another product.

The platform policy engine evaluates supplied policy definitions and records
policy decisions through its ports. It does not resolve identity bindings,
memberships, or permission grants.

### 4. Provisioning and Entra groups

Entra auth now exposes provider `entra` and a namespaced
`tenantId:entraObjectId` subject signal. The compatibility session still
contains first-group-derived `activeOrgId`, tagged `entra-group-legacy`;
unrelated consumers are not silently changed. Cora never supplies that value
as its selected org. Unknown bindings fail closed. No automatic binding,
membership, or grant provisioning was added.

For every app, Entra groups are **signals only**, not membership or permission
authority. Existing group-to-org consumer paths remain compatibility behavior
and require migration review.

### 5. Acceptance identities

The existing acceptance-auth path is Union Eyes staging-specific: issuer,
audience, environment gate, token names, and accepted synthetic users are
Union Eyes scoped. It resolves a database user and an active membership but
does not establish a generic provider-subject binding or a permission grant.
It remains unchanged and must not be generalized by sharing its trust
configuration with Cora.

The Cora local/test acceptance profile is separate: provider `cora-acceptance`,
issuer `nzila-cora-local-acceptance`, audience `nzila-cora-local-runtime`, and
token version `cora-acceptance-v1`. It is disabled unless explicitly enabled
with a 32-byte secret and all configured environment signals are `local`,
`development`, or `test`. Tokens are short-lived (at most five minutes) and
prove identity only. Cora resolves provider subject through the ordinary
canonical binding, active membership, organization, and exact application
grant chain; token claims for organization, role, permissions, or evidence
entitlement confer no authority.

### 6. Cora consumption

Cora now uses the platform authorization resolver; its actor ID, org, role,
and permissions come from canonical records. The unconditional
`cora:farmer360:read` permission and session-claim role mapping were removed.
The route returns 403 for canonical denials and logs redacted decision
metadata. No Cora write permission is introduced.

The canonical migration is unapplied to shared environments and there is no
binding/membership/grant backfill. Until authorized operators provision those
records, Cora correctly fails closed. Farmer 360 remains `DESIGN_ONLY`;
authenticated HTTP acceptance has not been claimed.

### 7. Read-evidence authority and consent

Authorization to use Farmer 360 is not, by itself, authority to view each
source fact. A separate server-side source-disclosure evaluator now matches
versioned, effective-dated policies against canonical source provenance,
recipient identity and membership, organization relationship, app permission,
surface, action, and purpose. It returns `ALLOW`, `DENY`, or `WITHHOLD` and
durably audits each decision without fact values or source record IDs. Audit
failures prevent the read from succeeding.

Farmer 360 is wired through this gate, but its runtime policy registry is
empty because no institutional Agrimo-to-Cora disclosure approval is on file.
Its Agrimo facts are withheld; the Cora application read grant alone cannot
authorize source disclosure. Healthcare consent semantics are not reused for
agricultural data. The requested institutional decision and required evidence
are listed in
[`CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md`](../categories/products-and-market/agri/CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md).

The consent engine uses clinical roles, patient/site identifiers, clinical
scopes, and break-glass behavior. Those semantics are not agricultural
consent. The finance-compliance consent record is in-memory and does not
provide the required canonical subject/recipient/scope lifecycle. Neither is
declared a suitable production agricultural consent authority here. The
interface now returns `WITHHOLD` with `GENERIC_GRANT_MODEL_REQUIRED` until the
underlying grant model is governed; no resource access is granted.

### 8. Auditability

Authorization contexts and denials include audit metadata: platform actor,
binding ID, hashed provider-subject reference, org, app, membership, grant
IDs, decision/reason, time, and correlation ID. Cora acceptance
authentication also writes a hashed-subject allow/deny event. Resolved-org
authorization decisions are persisted on the canonical `audit_events` hash
chain. When no trusted organization can be resolved, a redacted denial is
persisted to `user_management.auth_audit_log`; this fallback is durable but
not covered by the canonical audit hash chain.

## Reuse matrix

| Concept                          | Classification                  | Evidence / constraint                                                                          |
| -------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| External identity                | `COMPATIBLE_ADAPTER`            | Provider subjects exposed; Entra remains secondary and primary remains unspecified.            |
| Platform user                    | `CANONICAL_FIT`                 | Existing `authUsers.userId` is the principal key; lifecycle is checked.                        |
| Identity binding                 | `CANONICAL_EXTENDABLE`          | New `platform_identity_bindings`; unapplied and not provisioned.                               |
| Organization                     | `CANONICAL_FIT`                 | Shared `orgs` table; state must be active.                                                     |
| Organization membership          | `CANONICAL_EXTENDABLE`          | New `platform_organization_memberships`; legacy rows are not backfilled.                       |
| Active organization              | `CANONICAL_FIT`                 | Explicit selection verified; absent selection requires one active membership.                  |
| Role                             | `COMPATIBILITY_PROJECTION`      | Membership assignment only; role does not grant access.                                        |
| Permission grant                 | `CANONICAL_EXTENDABLE`          | New `platform_application_permission_grants`; exact app scope enforced.                        |
| `organization_users.permissions` | `LEGACY_PERMISSION_METADATA`    | Not read by canonical grant resolution.                                                        |
| Policy evaluation                | `EXISTING_CANONICAL`            | Policy engine evaluates supplied policy; it is not identity or grant resolution.               |
| Acceptance identity              | `DO_NOT_REUSE`                  | Union Eyes staging trust must remain isolated; acceptance identity cannot imply authorization. |
| Integration identity link        | `DO_NOT_REUSE`                  | Connection/org-scoped business entity mapping, not authentication identity.                    |
| Source-disclosure entitlement    | `CANONICAL_EVALUATOR_NO_POLICY` | Shared evaluator is implemented; no active Agrimo-to-Cora rule is authorized.                  |
| Agricultural consent             | `GENERIC_GRANT_MODEL_REQUIRED`  | Healthcare consent semantics are not reused.                                                   |

## Compatibility and migration matrix

The canonical model is authoritative for new integrations; these application
paths are not all migrated:

| Application/path                                 | Classification                                | Current authority / treatment                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cora                                             | `COMPATIBLE_ADAPTER`                          | Uses canonical binding, membership, active-org selection, and exact Cora grants. Records are not provisioned; requests fail closed until they exist. |
| Union Eyes                                       | `LEGACY_COMPATIBILITY` / `MIGRATION_REQUIRED` | Existing auth membership, UE-specific domain grants, and acceptance flow remain unchanged.                                                           |
| ABR / CourtLens                                  | `LEGACY_COMPATIBILITY` / `MIGRATION_REQUIRED` | `abr_users` and route-specific checks remain; older routes retain documented risks.                                                                  |
| Zonga                                            | `LEGACY_COMPATIBILITY` / `MIGRATION_REQUIRED` | Session-org context and some `org_members` API guards remain; not migrated to platform authority.                                                    |
| Entra group selector                             | `LEGACY_COMPATIBILITY` / `MIGRATION_REQUIRED` | `groups[0]` still populates tagged compatibility `activeOrgId`; Cora ignores it.                                                                     |
| `user_management.organization_users.permissions` | `LEGACY_PERMISSION_METADATA`                  | Retained without migration; never consulted by canonical grant resolution.                                                                           |

## Frozen doctrine and remaining operational gates

- Platform principal is `authUsers.userId`; external subjects are never
  treated as platform IDs.
- Entra is secondary; the primary sign-in provider is unspecified.
- Shared `orgs` is the canonical institutional boundary. New canonical
  memberships and grants reference it.
- Platform membership and explicit app-scoped grants are the authority;
  roles, groups, product users, acceptance tokens, and provider claims are not.
- Provisioning ownership and operator workflows for identity bindings,
  memberships, and grants must be governed before population/backfill.
- Migration is additive and forward-only. It was exercised from a disposable
  canonical-prerequisite bootstrap, then the migration's expected duplicate
  replay failure and unchanged fixture state were verified. The entire local
  database, volume, container, and network were removed afterward.
- The shared decision writer persists resolved-organization outcomes to
  `audit_events` using the shared `canonical-v1` hash helper and per-org hash
  chain. It persists outcomes without a trusted organization to the existing
  `user_management.auth_audit_log`, storing only a hashed external identity
  reference. The latter is durable but is not hash-chained or protected by the
  `audit_events` append-only triggers. Persistence errors propagate; an ALLOW
  context is not returned when its audit write fails.
- Generic evidence grants/consent remain pending and subject-controlled
  evidence is withheld.

## Phase 3A local runtime acceptance

`pnpm authz:acceptance` starts only the dedicated
`nzila-platform-authz-acceptance` Docker Compose project, bound to loopback
port `55442`, and refuses to reuse pre-existing project resources. Its
database-specific bootstrap mirrors the canonical predecessor tables needed
by migration `0041`; it does not replay the unrelated historical Cora
migrations. Deterministic synthetic fixtures cover provider namespace
collisions, lifecycle states, effective windows, multiple memberships,
legacy primary-org/permission metadata, Entra group signals, cross-app grants,
and invalid grant scope. The runner applies `0041` once, verifies forward-only
replay behavior, runs database-backed tests, and removes only its own compose
resources and volume.

The real Drizzle store and Cora resolver were exercised without HTTP calls or
mocked persistence. ALLOW and DENY outcomes were read back from the database;
resolved-org events were independently recomputed and checked for hash-chain
continuity, and update/delete attempts were rejected by database triggers.
Unknown, disabled, revoked, unverified, inactive, ambiguous, wrong-org, and
ineffective cases deny. This is local synthetic-data evidence only: it does not
prove the authenticated web request path, authority provisioning, live
provider sign-in, or Farmer 360 runtime capability. Farmer 360 remains
`DESIGN_ONLY`; no Value Opportunity work has started.

## Phase 3B application-scoped acceptance identity

The same `pnpm authz:acceptance` harness also exercises Cora's
application-scoped acceptance token profile against that disposable database.
The signing secret is generated in process memory for each run. The Cora
acceptance provider is bound to a dedicated synthetic platform principal,
active org-A membership, and explicit `cora:farmer360:read` grant; the fixture
does not reuse the principal mutated by the earlier acceptance suite.

The database-backed proof verifies successful identity-to-authority
resolution, isolation to each actor's own organization and grant, and
fail-closed denials for missing/inactive bindings, missing/suspended
memberships, absent canonical grants, and ambiguous memberships. It also
checks that organization, role, permissions, and evidence claims embedded in
the token do not grant authority, and that authentication audit metadata
contains neither the raw token nor provider subject. Unit tests verify
environment gating and cross-application token rejection; existing Union Eyes
acceptance behavior remains unchanged.

This is still synthetic local/test evidence. It does not prove browser/session
integration, an authenticated Cora HTTP workflow, live Entra sign-in, shared
authority provisioning, Farmer 360 runtime acceptance, or permission grants
outside the disposable database. The unresolved-organization audit fallback
is durable but is not part of the canonical per-org hash chain.

## Validation evidence

Focused validation passed:

- `pnpm --filter @nzila/platform-auth exec vitest run src/authorization-context.test.ts`
  — 24 tests passed.
- `pnpm --filter @nzila/db exec vitest run src/__tests__/platform-authorization.schema.test.ts`
  — 4 tests passed, including additive/forward-only migration assertions.
- `pnpm --filter @nzila/cora exec vitest run lib/__tests__/resolve-org.test.ts 'app/api/farmer-360/[profileId]/route.test.ts'`
  — 13 tests passed.
- `pnpm authz:acceptance` — passed: Cora database integration 2/2, platform
  authorization database acceptance 10/10, and Cora acceptance identity
  database proof 5/5; `0041` applied once, replay failed as expected without
  changing seeded rows, and the disposable Docker project, network, and volume
  were removed.
- `pnpm --filter @nzila/platform-auth typecheck` — passed.
- `pnpm --filter @nzila/db typecheck` — passed.
- `pnpm --filter @nzila/cora typecheck` — passed.
- `pnpm --filter @nzila/abr typecheck` — passed; ABR now delegates canonical
  serialization and hashing to the shared DB package helper.
- `pnpm --filter @nzila/platform-auth lint` — passed.
- `pnpm --filter @nzila/cora lint` — passed.
- `pnpm validate:docs` — passed with 0 errors (1,215 warnings and 1,673 informational findings across the repository).
- `git diff --check` — passed.

No Cora HTTP acceptance, Farmer 360 runtime promotion, staging, production, or
shared-environment migration/validation is claimed.
