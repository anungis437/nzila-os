# Cora Authorization Composition

> **Status: local database and application-scoped acceptance passed with limitations; shared-environment migration and authority provisioning remain pending.**
>
> Cora consumes the platform resolver below. The resolver and persistence
> adapter have been exercised against synthetic rows in an isolated disposable
> PostgreSQL database. Until a verified identity binding, active membership,
> and explicit Cora grant are provisioned in a governed durable environment,
> requests fail closed. This is not Farmer 360 HTTP acceptance or runtime
> capability proof.

The Cora local/test acceptance identity uses a separate trust profile
(`cora-acceptance` provider, Cora-specific issuer/audience, five-minute
maximum token lifetime). It requires explicit enablement, a sufficiently
strong ephemeral or test-only secret, and exclusively local/development/test
environment signals. Token claims authenticate only the provider subject;
canonical records remain the sole source of platform user, organization,
membership, role, and permissions. Union Eyes acceptance configuration is
unchanged and is not shared with Cora.

## Implemented composition

`apps/cora/lib/resolve-org.ts` uses:

- provider namespace and provider subject from the authenticated session;
- `resolveAuthorizationContext()` from
  `@nzila/platform-auth/authorization-context`;
- canonical `platform_identity_bindings` to find the internal platform user;
- canonical active membership in `platform_organization_memberships`;
- active state from the shared `orgs` institution and verified organization
  selection; and
- active, effective `platform_application_permission_grants` scoped exactly to
  application `cora`.

Cora takes the actor ID from the resolved platform principal, role from the
canonical membership assignment, and permissions only from canonical grants.
Session role metadata, super-admin email checks, Entra group IDs, legacy
membership defaults, and `organization_users.permissions` do not grant
authority. The current Entra group-derived `orgId` is ignored by Cora.
Membership role labels are mapped to the narrower Agri role vocabulary for
context compatibility only; that mapping does not create permissions.

With no explicit organization selection, the resolver selects the only active
membership if exactly one exists. Multiple active memberships without explicit
selection return `AMBIGUOUS_ORGANIZATION`. Explicit selection is only a
selector; it is always checked against canonical membership.

The generic resolver returns structured audit metadata. The Farmer 360 route
maps canonical denial errors to 403 and logs denial metadata with a hashed
provider-subject reference; it does not log tokens.

The route requests `cora:farmer360:read` from the canonical resolver as a
required permission, so a missing grant is a resolver DENY rather than an
ALLOW-shaped context followed only by a route-local permission check. The
shared decision writer persists resolved-organization ALLOW/DENY outcomes to
the canonical `audit_events` hash chain. When no trusted organization can be
resolved, it persists a redacted DENY to the existing
`user_management.auth_audit_log`; that fallback is durable but not covered by
the canonical audit hash chain.

The local acceptance harness verifies Cora acceptance authentication followed
by database-backed canonical authorization, including positive resolution,
actor/org isolation, fail-closed binding/membership/grant cases, ambiguous
membership, ignored token authority claims, and redacted authentication audit
metadata. The harness generates its signing secret in process memory and
removes its isolated Docker database resources after completion. This proves
neither an authenticated HTTP workflow nor browser/session integration.

## Permission and source-disclosure boundary

### Evidence authority versus access preference

Under the [v3 doctrine](ADR/ADR-AGRI-002-cora-food-economy-ceiling.md),
consent, instruction, institutional mandate, contractual authority, legal
basis and access preference are distinct evidence-authority/access concepts.
Consent may evidence voluntary agreement; instruction requests an action
within established powers; mandate and contract must be verified for their
scope; legal basis requires qualified determination. None can silently
substitute for the others.

`ACCESS_PREFERENCE` is a user/producer configuration or standing choice
only where upstream authority permits it. It cannot override law, regulation,
contract, institutional mandate or another party's rights. A preference is
not a legal basis, source licence, recipient acceptance or application grant.
Public institutional evidence and private evidence need case-specific
authority paths; no universal producer intermediary or consent is presumed.
This documentary distinction adds no runtime policy or new authority type
to the implemented resolver. Existing empty policies and fail-closed controls
remain unchanged.

`cora:farmer360:read` is returned only when an active, effective canonical
grant exists for the resolved membership and organization. A Cora permission
does not imply Union Eyes access, Agrimo write, generic Cora write, or evidence
entitlement. No Cora write grant or role-derived permission is created here.

Source-disclosure authority is a separate server-side platform primitive. It
requires exact source provenance, an active identity binding and membership,
same-organization scope, the Cora application permission, and an active
effective policy matching source, surface, action, purpose, and recipient.
The Cora service gates every fact and conflict alternative before constructing
the read model. Decisions are recorded to the existing canonical
`audit_events` hash chain without fact values or source record IDs; audit
failures prevent the read from succeeding.

The Farmer 360 runtime policy set is intentionally empty. Consequently
Agrimo producer facts are `WITHHOLD`-ed and omitted, with empty sections
reported as `UNKNOWN`. No source-disclosure `ALLOW` is inferred from source
row existence, organization equality, authentication, or
`cora:farmer360:read`. No institutional Agrimo-to-Cora disclosure approval is
on file. Healthcare consent is not adapted as agricultural consent. The
decision request and required institutional evidence are recorded in
[`CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md`](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md).

## Provisioning and rollout boundary

Entra is a secondary sign-in option. The primary sign-in provider remains
unspecified. Entra provider subjects are namespaced with tenant ID and object
ID, then must resolve through the same verified binding and authority tables.

The additive migration
[`0041_platform_authorization_authority.sql`](../../../packages/db/drizzle/0041_platform_authorization_authority.sql)
was applied and replay-checked only in the isolated local acceptance database.
The bootstrap used the canonical predecessor table definitions required by
the migration; it did not replay unrelated historical Cora migrations. The
disposable database and its Docker resources were removed after the tests.
Migration `0041` remains unapplied to shared, staging, and production
environments. No legacy user, membership, or permission data has been
backfilled. There is no canonical provisioning workflow yet; until approved
operators populate verified bindings, memberships, and grants, Cora denies
requests rather than falling back to legacy authority.

Local database acceptance proved real Drizzle-backed resolution, effective
grant filtering, Entra group and legacy-permission non-authority, org
ambiguity, app-scope isolation, and durable ALLOW/DENY persistence. For
resolved organizations, audit rows use `canonical-v1`, chain to the previous
per-org hash, and reject update/delete attempts. Denials without a trusted
organization use the existing auth audit log. This does not prove the
authenticated HTTP route, live Entra sign-in, or durable authority
provisioning.

Current Union Eyes acceptance identity is explicitly rejected by Cora.
The Cora acceptance identity is also identity-only and is resolved through
canonical provider binding, membership, and permission grants. Existing Union
Eyes acceptance behavior remains unchanged; Cora and Union Eyes trust
configuration and tokens are not interchangeable.

Farmer 360 remains `DESIGN_ONLY`. This change does not claim authenticated
HTTP acceptance and does not begin Value Opportunity.

See the platform authority and compatibility matrix in
[`NZILA_APPLICATION_AUTHORIZATION_MODEL.md`](../../../architecture/NZILA_APPLICATION_AUTHORIZATION_MODEL.md).
