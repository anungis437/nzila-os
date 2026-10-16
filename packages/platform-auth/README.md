# @nzila/platform-auth

Authoritative platform package for authentication and authorization across Nzila OS.

## Owns

- Shared auth providers and adapters (Entra and password flows)
- Server/client auth primitives for app routes and API handlers
- Cross-app authorization guards and identity contracts

## Does Not Own

- App-specific role semantics and domain authorization policies
- Domain org context typing (use @nzila/org)

## Use This When

- Building or updating user/session auth flows in apps
- Adding route protection middleware
- Implementing standardized auth handlers

## Adjacent Packages

- @nzila/org: canonical org and actor context contract
- @nzila/platform-contracts: shared platform contract schemas used by auth adapters

## Prospective auth execution boundary (bootstrap V2 contract 2.0)

Shared password, inbox-bearer and opaque session flows use `AUTH_DATABASE_URL`, never
`DATABASE_URL` or `SYSTEM_DATABASE_URL`. It must be a dedicated non-owner,
non-superuser, non-BYPASSRLS LOGIN credential with NOINHERIT membership in
`nzila_auth_gateway`. Cross-user operations use a **different** credential,
`AUTH_SYSTEM_DATABASE_URL`, with membership in `nzila_auth_system_gateway` only.
The compiler does not create credentials. No deployment is implied.

`@nzila/db/auth-storage-authority` exports `compileAuthBootstrapSql()`; apply its
SQL **after canonical auth tables and `public.platform_identity_bindings` exist**, under installation authority. It
refuses existing policies and unsafe role reuse: reconciliation must be explicit.
It revokes ordinary/legacy-system auth access, enables FORCE RLS, and grants
operation/column-specific lookup, own-user and system permissions. Latent OAuth
storage receives no grants. The existing registry remains intended authority,
not a claim of staging enforcement.

`@nzila/platform-auth/auth-execution` exposes server-internal `withAuthContext`
and `authDb`. They are not route authorization APIs. Actor flow:

1. Public email/password input enters an email lookup context. Only matching
   credential rows and failed-attempt counters are accessible; email alone
   cannot mint sessions or change passwords.
2. Password verification and lifecycle/lockout checks precede promotion to the
   own-user executor. This is **first-factor validation**, not MFA completion.
   Existing risk/MFA service gates still decide whether to issue a session.
3. Cookie input is hashed into a session lookup context; validity/expiry/active
   checks precede promotion to own-user profile resolution.
4. Reset, magic, invite and MFA hashes enter a dedicated redemption context.
   Live tokens are locked, subject/email/org binding constrains side effects,
   and consumption occurs last. Inbox authentication still requires enabled or
   organization-mandated MFA before issuing a session.
5. Tenant invite/policy writes verify the server actor and active canonical admin
   membership in the exact organization. Invitations cannot assign platform roles.
6. Entra's validated tenant/object subject resolves an active, verified,
   pre-provisioned canonical binding. Email auto-linking is forbidden.
7. Cross-user execution requires the caller's existing platform authorization
   gate, an explicit actor/target/reason and an allowed operation. Only session
   revocation or one organization's membership state is granted; role assignment,
   unrelated auth mutations are denied. Lifecycle and admin MFA use separate
   operation roles and additionally recheck a canonical active system admin.
   Deprovisioning is irreversible through the lifecycle service. Cleanup can
   delete only inactive sessions expired beyond seven-day retention. Existing
   `systemDb` callers are not silently elevated.

Each callback uses a transaction-scoped role and local settings, with
AsyncLocalStorage isolating concurrent callers. Principal promotion ends the
lookup transaction first; nested principal scopes are rejected to prevent pool
starvation and authority confusion. Session insertion rechecks active identity
lifecycle and active organization membership, closing stale-lookup promotion.
Audit savepoints preserve
best-effort logging without aborting the enclosing auth transaction. Cross-account
IP failure scoring uses a restricted SECURITY DEFINER aggregate, not cross-user
audit-row grants or a silently weakened own-user count.
Issuance rate checks use transaction-scoped advisory locks and a narrow aggregate.
Generic magic-link responses still resist enumeration; native tests verify that
token issuance actually stops at the limit. `closeAuthClients()` from
`@nzila/db/auth-client` closes only these pools; register it in application shutdown
or test teardown. Auth pools are credential-specific, and callbacks clean up their
local role/settings on commit or rollback.

Shared acceptance identity validation and authorization-store provider resolution
use the same boundary. The preidentity acceptance audit has a separate
insert-only channel role: userless allow/deny receipts, no auth reads or identity
promotion. App password/session re-exports need no business-logic duplication.
Direct Entra adapter/middleware consumers must not treat provider object IDs as
canonical user IDs; use shared server authentication or the validated-subject
resolver (`@nzila/platform-auth/provider-identity`, server-internal, after
provider credential verification). App-owned raw auth SQL and shutdown/configuration wiring still require
explicit integration. External Entra network/token/credential verification is
separate from the synthetic subject-mapping proof.

Parent integration: `apps/union-eyes/scripts/bootstrap-v2/auth-sql.ts` reexports
the compiler, roles, context settings and gaps. `auth-runtime.ts` exports
`proveAuthExecutionBoundary({ owner, ordinary, legacySystem, auth, authSystem })`
for connected **local synthetic** PostgreSQL clients after installation. It
seeds reserved `auth-proof-*` fixtures in a fresh database and derives its result
from executed probes, failures and `AUTH_BOUNDARY_GAPS`. Any local `PASS` is scoped
to `LOCAL_SYNTHETIC_AUTH_BOUNDARY`, not staging or whole-contract readiness.
`inspectAuthPrivilegeExpectations(client)` compares live table/column/function
ACLs, forced RLS, ownership, role attributes, schema privileges and membership
options against independently authored expectations, not compiler output.
`auth-fixture.ts` compiles test DDL from
the canonical `packages/db/src/schema/auth.ts`, not legacy migrations.

Run the isolated native proof (creates/removes its own pinned PostgreSQL Docker
container; no customer data) from PowerShell:

```powershell
$env:AUTH_NATIVE_PROOF='1'
pnpm --filter @nzila/union-eyes exec vitest run scripts\bootstrap-v2\auth-native.test.ts
```

### Business organization binding integration

Bridge revocation failure is never suppressed. If both the callback and
revocation fail, `withAuthenticatedOrgBinding` throws an `AggregateError` with
the original callback error first, cleanup error second, and callback error as
`cause`. Cleanup-only failure is propagated unchanged. The wrapper adds no
bearer values to either error or message.

Auth-parent foreign keys require a separate principal check: PostgreSQL FK
enforcement does not enforce parent RLS. The compiler includes
`user_management.auth_business_user_parent_authorized(parent_user_id text,
row_org uuid)` and exports `AUTH_BUSINESS_USER_PARENT_PREDICATE`. Add it to
business `WITH CHECK` for own-user relations alongside existing domain/role
checks. It requires the parent key to equal the session-authenticated actor and
revalidates live session/membership authority through the pinned org predicate.
It uses the existing private helper owner, with no additional table grants or
runtime auth SELECT. NULL parent values fail closed unless the business policy
explicitly permits an optional relationship.

This contract covers `user_management.users(user_id VARCHAR(255))`, not an
invented UUID `users.id`, profile table, or arbitrary cross-user relation.
UUID/profile parents need their actual canonical source declaration and an
explicitly approved relationship rule; do not authorize them by basename,
UUID-shaped identifiers, org membership alone, or FK existence.

For source-approved same-org attribution/relationship fields, use
`user_management.auth_business_member_parent_authorized(parent_user_id text,
row_org uuid)` (`AUTH_BUSINESS_MEMBER_PARENT_PREDICATE`) instead. It first
authenticates the actor's live session/membership, then requires the target
canonical user to be active with active lifecycle and exact active membership
in the row organization. This permits retaining another active same-org member's
attribution during legitimate updates; it does not authorize the mutation itself
or replace domain/role checks. Keep the own-user predicate for own-user fields.
NULL/unknown/foreign/inactive parents fail closed. The same private owner and
column grants are reused: target reader policies depend on the actual live
bearer session, not GUC claims alone, and form a nonrecursive dependency chain
users -> organization_users -> user_sessions.

Nonempty `app.current_user_id` / `app.current_org_id` are **not** authorization.
The compiler includes `user_management.auth_business_org_authorized(row_org uuid,
required_roles text[] DEFAULT NULL)`. Business RLS must use this predicate in
`USING` and `WITH CHECK`; admin-specific policies pass `ARRAY['admin']::text[]`.
It requires the row's org to match the selected org, the **raw** session bearer to
hash to a live unexpired canonical session belonging to the claimed actor, an
active canonical user, and active membership in that exact organization.
Session-bound organizations cannot be changed through GUCs. An orgless session
may select another organization only with an active canonical membership.
Membership roles are read from storage, not request/provider/GUC role claims;
neither shared runtime credentials nor `is_system_admin` grant an org bypass.

Parent wrapper hook:

1. Call `withAuthenticatedOrgBinding({ organizationId: explicitOrgId,
   expectedActorUserId: authenticatedUser.id, requiredRoles }, callback)` from
   `@nzila/platform-auth/org-binding`. It verifies server identity, actual session
   and active canonical membership; explicit organization IDs are selectors only.
2. Inside its callback, open the ordinary transaction and execute
   `authenticatedOrgBindingSql(binding)` before business queries. This installs
   all three transaction-local GUCs, including `app.current_session_token`.
   Alternatively use `authBusinessContextSettings(binding)` from DB authority
   helpers with parameterized `set_config(key,value,true)`.
3. Keep the entire ordinary transaction inside the callback. PG cookies retain
   their real session authority. Already-verified Entra/signed-acceptance identities
   receive a canonical org-bound bridge expiring in 30 seconds, revoked on callback
   completion/failure. No provider bearer verification is replaced by this bridge.
   Never return, serialize or log its raw bearer.

The helper owner `nzila_auth_org_authority_reader` is NOLOGIN/NOINHERIT, has no
gateway membership, no table ownership, and SELECT only the required identity,
membership and session columns. Its RLS is direct actor matching and does not call
the helper recursively. SECURITY DEFINER pins `search_path=pg_catalog`, fully
qualifies storage tables and grants EXECUTE only to ordinary runtime (and implicit
function owner). Runtime schema USAGE is intentional; auth table ACLs remain
denied and legacy-system cannot execute this helper. Install auth/helper SQL
after canonical tables but before business policies reference it; business
compiler grants must preserve this narrowly scoped EXECUTE/schema USAGE contract.

`auth-org-runtime.ts` exports `proveAuthOrgBindingBoundary({ owner, ordinary,
legacySystem })`: a separate local-synthetic ledger covering actual business RLS,
actor/org/hash forgeries, member/admin separation, stale membership/session/user
authority, organization-bound sessions, overgrant detection and context cleanup.
It temporarily creates reserved `public.auth_proof_business_scope` and removes
that table and its synthetic `auth-proof-org-*` rows before returning. Its valid
fixture uses raw tokens hashed into `session_token_hash`, active/lifecycle-active
users, UUID organizations and active member/admin memberships; IDs or stored
hashes are never accepted as bearer substitutes. Parent-owned business compiler
and `lib/db/with-rls-context` integration is not performed by these auth modules.
