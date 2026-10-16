# Union Eyes current-state bootstrap V2

This is the prospective `PROSPECTIVE_UE_BOOTSTRAP_V2` mission, contract `2.0`.
It is not a continuation of W5B. The [historical W5 terminal disposition](../reality-remediation/UE_W5_TERMINAL_STATIC_DISPOSITION.md)
and the [G3 terminal disposition](../../../infrastructure/landing-zone/g3-readiness-evidence/G3_TERMINAL_DISPOSITION.md)
remain unchanged.

## Execution boundary

The completion charter permits local, ephemeral PostgreSQL, synthetic data and
source changes. It does not authorize staging, production, customer-data
migration, merge or deployment. Existing bootstrap commands are not redirected
to V2 while qualification is incomplete.

The [current-model collector](../../../apps/union-eyes/scripts/bootstrap-v2/current_models.py)
loads current Django models under isolated settings and rejects database
connections. It does not import production settings, read dotenv credentials,
load migration history or execute historical SQL. Its Python image and
requirements are pinned. Dependencies are installed from an offline,
hash-locked wheelhouse inside the mission container.

The [source compiler](../../../apps/union-eyes/scripts/bootstrap-v2/source.ts)
preserves current Django fields and physical FK semantics. Active, source-
dispositioned operational relations, including the seven explicitly identified
stubs, receive prospective current-application field and constraint producers.
Explicit stale or security-sensitive field exclusions remain enforced. These
producers do not depend on historical migration prerequisites. Supplementation
is not yet proof that every field has reconciled canonical backend ownership.
The accepted UUID membership invariant is retained, including nullable UUID
document ownership and unique `(organization_id, user_id)` membership.

Named current-model checks are collected from Django's schema editor and
retained when the current caller declares the same expression. They are not
created a second time by the prospective overlay. Same-name expression drift
or missing canonical SQL fails explicitly; no existence guard masks a
contradiction.

Independent server-default verification reads selected current declarations,
including canonical shared auth declarations, rather than treating contained,
latent or duplicate caller projections as installation authority. Exclusions
are reported explicitly; canonical model UUID/audit defaults remain checked
regardless of caller selection. JSON and array defaults use the actual Drizzle
driver literal. JSONB comparison preserves values and array order while
allowing PostgreSQL's object-key ordering and presentation whitespace.
Typed numeric defaults are compared without floating-point coercion, preserving
exact coefficients while allowing equivalent PostgreSQL literal formatting.

The current evidence capability receives a prospective V2 authority decision:
pack creation, manifest saving and sealing require organization-scoped
SELECT/INSERT/UPDATE, while artifacts allow parent-scoped SELECT/INSERT and
existing background verification SELECT. The compiler verifies the canonical
artifact-to-pack FK before selecting that authority. Legacy registries and
historical packets are unchanged; grants alone do not prove the Django builder
works at runtime.

The current public Django `users` and `oauth_providers` records are prospectively
classified as self-owned legacy metadata, not canonical auth authority. Their
current CRUD is limited to the live canonical actor's `user_id`; NULL/foreign
ownership and legacy-system access are denied. They cannot authenticate users,
grant membership or resolve provider identities. This decision does not invent
lineage to the separate canonical `user_management` namespace or qualify Django
request-context wiring.

The current Django `Donations` model receives a separate prospective decision
as organization-owned operational metadata. Its UUID organization FK and
non-null ownership are required before enabling tenant CRUD. The opt-in V2
view binds that CRUD to live canonical membership, denies foreign assignment,
and uses forced RLS; legacy behavior and the historical financial-boundary
registry remain unchanged. This decision does not import the financial caller
projection, merge a financial database or qualify payment/ledger processing.
The actual current HTTP proof exercises two organizations, positive CRUD,
foreign read/update/delete and FK-assignment denial, and fixture cleanup.

Three current global metadata tables (`failed_login_attempts`,
`rate_limit_events` and `clc_chart_of_accounts`) reuse the existing dedicated
canonical platform-administrator context. They are not Django framework tables
and receive a separate source decision and security classification. Exact
current model ownership, forced RLS and live canonical administrator checks are
mandatory. Ordinary tenant, legacy-system, framework-identity and worker access
remain denied. No extra broad gateway or bypass role is introduced, and the
financial database is not merged. The same independent effective-privilege and
policy inspector covers these exact administrative grants; native SQL and actual
current HTTP CRUD exercise allowed platform administration and denied tenant/org
administration. Legacy-mode API permissions remain unchanged.

The actual current carbon-accounting service now has a positive business-write
proof through its source-declared tenant-owned `audit_logs` store. Two real
canonical organization contexts create distinct emission records, read only
their own persisted totals, and expose their own canonical actor attribution
through the actual audit API. Forged organization/user fields cannot override
the resolved actor. Native fixtures retain the actual organization FK and
independently assert audit/organization residue cleanup. This does not qualify
every service domain, the financial database, carbon offsets or provider
ingestion.

The [ordinary tenant native matrix](../../../apps/union-eyes/scripts/bootstrap-v2/runtime-security.ts)
now exercises all 318 current RLS relations under genuine restricted logins.
Its [native regression](../../../apps/union-eyes/scripts/bootstrap-v2/runtime-security-native.test.ts)
checks the exact declared operation matrix for live canonical members,
organization administrators and platform administrators: 268 relations permit
INSERT, 178 permit UPDATE and 100 permit DELETE. Every authorized write must
affect exactly one own-tenant row and pass immediate constraint verification.
Foreign and unauthenticated writes, missing user/organization/bearer reads and
source-unauthorized operations must be denied. Writes roll back, with independent
owner-side checks for inserted-row residue and preservation of the original
fixture.

Singleton and composite parent/user keys use fresh canonical actors,
memberships, sessions and source-bound parent cohorts rather than treating a
duplicate-key error as a positive INSERT. Parent preparation rejects unresolved
sources and dependency cycles explicitly. Numeric fixtures respect declared
precision and scale. UPDATE-only relations are tested without adding SELECT
authority merely to support a test locator. These are native database actor
proofs, not a substitute for current application actor mapping, the dedicated
framework/worker matrix or whole mission acceptance.

The source-owned external-data sync logger exposed a distinct service-path
defect: its declared INSERT/UPDATE-only role could insert a log but PostgreSQL
denied the actual `UPDATE ... WHERE sync_id = ...` selector. The prospective
compiler now grants only `SELECT (sync_id)` with an explicit system SELECT
policy; it does not grant table-wide SELECT or ordinary tenant access. Native
execution verifies the selector update and rejects `SELECT *`. The independent
privilege inspector compares every current column's effective SELECT authority,
including missing predicate grants and extra content-column grants.
The current pilot commercial transition likewise requires only `id` and
`contract_number` for its lookup, `INSERT RETURNING id` and selector update.
The prospective compiler hash-binds both callers and grants only those declared
columns, never table-wide contract content reads. Native proof forces real parent
FKs and immediate constraints, verifies write rollback and detects independent
missing-column/extra-content grants. This is operational commercial-metadata
proof, not separate financial-database or payment-provider qualification.
The native application suite also invokes the actual wage, union-density and
cost-of-living service methods for both first INSERT and subsequent selector
UPDATE. Only the external provider is replaced with correctly shaped synthetic
records; Drizzle, the real system transaction/proxy and sync-log mutations
execute against the fresh canonical schema. Owner-side readback checks exact
values and log counts, ordinary reads are denied, and fixtures are removed.
Contribution-rate/financial paths remain separately unqualified. The earlier
source-hashed SYSTEM mutation component matrix qualified 38 of 39 tables:
`reverseTransactionFee` required a full adjustment return from INSERT-only
`fee_adjustments`. That permission failure and the failed exact-39 aggregate
are preserved separately.

The opt-in V2 fee caller now reuses a shared write-owned insert helper. It
preallocates the UUID, obtains database transaction time and normalized values
through table-free PostgreSQL expressions, inserts without RETURNING, and
returns all 11 fields only after successful insertion. SQL NULL defaults and
full-precision persisted database time are retained. Legacy RETURNING behavior
is unchanged. Native owner-side readback verifies the exact persisted/returned
record, numeric zero/negative zero/rounding/limits/overflow, constraint failures
and rollback with both Node-PG and production postgres-js drivers. No financial
SELECT grant was added; full-row RETURNING remains denied. The newer complete
39-table component matrix passed with zero skips. These caller-compatible SQL
components do not substitute for execution of every complete service or
financial ledger graph.

The opt-in Next application wrappers explicitly select the canonical runtime
or system role inside each transaction before setting context. Genuine
`NOINHERIT` login credentials do not inherit those roles' privileges. The native
regression exercises the real password-session/membership resolver, transaction
and AsyncLocalStorage database proxy; only synthetic authentication ingress is
mocked. It checks tenant isolation, the system sync-log selector, denied broad
system reads and platform-context attribution. The actual V2 API guard and
organization/role helpers resolve live canonical membership instead of legacy
public-table, provider-metadata or environment-role fallbacks. Platform authority
requires the canonical administrator flag; a platform-named transaction cannot
be opened by an ordinary member. Existing platform membership role aliases are
shared with legacy resolution rather than reimplemented independently.

Authenticated, organization-required V2 `withApi()` handlers automatically receive
canonical transaction context, even without the legacy RLS opt-in. An existing
transaction must match the canonical user and organization. Explicitly unscoped
password-profile handlers retain authenticated profile access without inventing
membership or tenant authority. Public and cron routes retain their declared
authorization boundaries. The deprecated `withApiAuth()` family delegates its
V2 authenticated path to that same wrapper and replaces supplied actor/org
context with canonical values. Its profile/onboarding callers can explicitly
declare `requireOrg: false`; legacy flag-off behavior is unchanged. Role gates
do not accept the legacy environment administrator allowlist in V2, and canonical
lookup failures propagate to the standard logged error handling rather than
falling back to legacy context. Synthetic ingress and rate limiting are mocked in the
native application probe; password sessions, membership, profile queries, real
Next request/response handling, transaction routing and RLS are executed. Legacy flag-off behavior is
unchanged. This bounded application proof does not establish every caller's
authorization gate or whole mission acceptance.

The imperative `requireApiAuth()` helper now validates the live canonical actor
even when organization scope was not requested. Known authentication and
membership denials retain the existing `Unauthorized:`/`Forbidden:` error
contract and are logged; storage failures propagate. Private onboarding profiles
remain authenticated without an organization, but cannot satisfy a membership
role requirement. The shared `isPlatformAdminUser()` predicate checks the exact
canonical actor and literal administrator flag in V2, retaining the environment
allowlist only in legacy mode. Direct cache, database optimization, member
administration, organization-list/switch and pilot-overview gates reuse it.
The V2 pilot overview cannot obtain platform authority merely by matching a
legacy default organization. Focused units and an actual direct handler with
mocked canonical authority cover these gates; they are not native proof of all
six handlers' business operations. A selected actual-module/native PostgreSQL
case additionally verifies imperative guards for all three canonical roles,
no-org profiles, exact-role rejection and invalid/expired/revoked sessions;
its 322 filtered cases are not counted as freshly qualified. Expanded strict
types and independent source-digest assertions bind all six route sources.
Organization enumeration and session
rebinding still require separate source/runtime reconciliation.

Foreign-parent INSERT probes include nullable FK columns omitted by the
positive fixture. Referenced foreign tuples are independently seeded and
constraint-verified before injection; only an RLS permission denial counts as
success, not a missing-parent or uniqueness error.

The default proof waits for TCP readiness on `127.0.0.1`, not the image's
temporary initialization server's Unix socket. Fresh generation and an
independent deterministic check passed after this startup correction.

Current Django framework tables use a dedicated prospective authority contract,
not ordinary tenant or legacy-system blanket grants. All 18 current auth/admin/
content-type/session/Celery model owners are checked against the locked source.
The request gateway can explicitly select a self-owned framework identity
context or canonical platform-administrator context. Both validate a live
canonical bearer, active user/lifecycle and session organization; stock Django
superuser/group flags and forged administrator settings confer no authority.
Identity writes cannot change passwords, usernames or superuser flags. Only
canonical platform administrators can mirror staff status. A separate worker
gateway has CRUD authority over the nine current Celery tables and no identity
or administrator access. Minimal actor-scoped canonical readers own pinned
definer helpers, not framework tables.

The independent inspector checks role flags, exact SET-only memberships,
effective table/column/sequence privileges, forced RLS, policy shapes and helper
owners/search paths/callers. The opt-in native framework test installs actual
current model DDL and exercises positive visibility against real synthetic
rows, own identity creation/metadata, private worker CRUD, forged/stored-hash/
missing/stale/revoked authority denial, transaction context reuse and fixture
cleanup. It also injects overgrants and permissive policies to verify independent
rejection. The full component matrix requires these separate-context proofs
rather than removing framework relations from its denominator.

The auth and framework compilers also support an assertion-only
`rolesPreprovisioned` profile. It validates exact safe role flags and membership
sets, including missing, extra and duplicate grants, rather than creating roles
or modifying memberships. Native tests invoke that assertion through a real
restricted LOGIN and reject injected prerequisite drift. This is one bounded
installer primitive. The [minimum installer profile](../../../apps/union-eyes/scripts/bootstrap-v2/minimum-installer.ts)
additionally separates operator preparation from canonical installation:
the operator prepares exact NOLOGIN roles/SET-only gateway memberships, the
database owner and pinned vector extension/ACLs. The installation owner receives
only four explicit non-administrative, inheritable function-owner delegations;
application execution principals receive none of these installer capabilities.
A genuine restricted synthetic LOGIN has SET-only owner membership and no
superuser, BYPASSRLS, CREATEROLE or CREATEDB. Its authenticated connection identity
is bound before any role switching, preventing root-login impersonation from
counting as this proof. The installer does not create roles, extensions or
memberships in this profile, and rejects prerequisite drift.

The integrated clean-room runner exercises complete fresh installation, exact
NOOP, drift/partial denial, all three rollback faults and destroy/recreate with
this LOGIN, comparing native state to the operator reference. Only exact
extension-owned objects may appear in the prepared baseline. The one incoming
synthetic LOGIN membership is inventoried separately from canonical source
objects. Current-source native qualification passed all of these installer
lifecycle checks, four prohibited privilege attempts and three independent
delegation-drift injections. The [local validation receipt](UE_BOOTSTRAP_V2_LOCAL_VALIDATION.json)
binds this component proof; whole application/security acceptance remains
independent.

Extension provisioning and installation-owner authority retain their
own explicit profile and native proof.
The organization-authority function compiler grants its reader schema CREATE
only during ownership transfer and revokes it afterward. This fixes a genuine
restricted-installer failure that superuser reference execution had masked;
it does not leave schema CREATE authority on an application execution role.

The opt-in `UE_CANONICAL_BOOTSTRAP_V2=1` backend configuration uses explicit,
dedicated `UE_V2_RUNTIME`, `UE_V2_AUTH`, `UE_V2_FRAMEWORK_REQUEST` and
`UE_V2_FRAMEWORK_WORKER` PostgreSQL login/password pairs; owner credentials and
debug mode are rejected. Legacy mode is unchanged. The V2 middleware binds
transaction-local bearer/actor/organization settings on ordinary and framework
connections and clears them on request completion or failure. API principals
expose canonical IDs, while Django admin retains its genuine numeric metadata
identity for stock framework relationships. Cached cookies, password backends,
stock superuser flags and unsigned role/org claims cannot confer V2 authority.
Current service actor attributes (`user_id`, `organization_id`,
`organization_role` and `is_system_admin`) are bound to canonical authority,
not delegated to cached Django metadata. The genuine mounted service-input
validation path and a forged-metadata regression verify that distinction;
service validation is not substituted for successful business-domain writes.

The actual current Django HTTP/admin and Celery proof uses copied source,
hash-locked offline wheels and separate restricted principals in the labeled
ephemeral PostgreSQL namespace. It exercises the real configured URLs,
canonical profile identity and membership, self-owned user/provider metadata
CRUD, denied foreign writes/visibility, current admin pages, result persistence
and beat model lifecycle. A synthetic RSA key supplies only the JWKS signing-key
lookup: the real RS256 decoder must verify issuer, audience, expiry and immutable
pre-provisioned provider identity. Provider bridges expire at most 30 seconds
from their explicit statement-timestamp creation and are revoked after the
callback, including rollback and dual-failure paths. This is local synthetic
proof, not real Entra/staging certification or full domain/application coverage.

The three formerly contradictory nullable UUID columns remain nullable in V2.
Tenant policies do not treat their NULL values as global visibility. A failed
security classification is denied and reported; it is not substituted with
global access.

## Local commands

Set `UE_V2_WHEELHOUSE` to the directory containing the Linux CPython 3.11 wheels
for the existing backend requirements lock, then run from the repository root:

```powershell
pnpm exec tsx apps\union-eyes\scripts\bootstrap-v2\plan.ts
pnpm exec tsx apps\union-eyes\scripts\bootstrap-v2\plan.ts --self-test --check
pnpm exec tsx apps\union-eyes\scripts\bootstrap-v2\clean-room.ts
pnpm exec tsx apps\union-eyes\scripts\bootstrap-v2\defaults-native.ts
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\bootstrap-v2\bootstrap-v2.test.ts
$env:UE_V2_NATIVE_FRAMEWORK='1'
$env:UE_V2_NATIVE_FRAMEWORK_APPLICATION='1'
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\bootstrap-v2\framework-native.test.ts --maxWorkers=1
```

The clean-room runner uses pinned PostgreSQL 16 with pgvector 0.8.1, a dynamic
loopback port and tmpfs storage. Only the approved vector extension is
provisioned by the local bootstrap operator; application roles are neither
superusers nor RLS bypass roles. It removes only that mission-labeled container.
It records failures and rethrows them. Generated artifacts are candidate
evidence, not execution authorization or a product-readiness declaration.
The CLI also exits nonzero when whole engineering qualification remains FAIL,
even if the schema lifecycle submatrix passes; consult the persisted evidence
to distinguish internal qualification gaps from runner errors.

The installer allows only explicitly named loopback ephemeral targets and
rejects connection strings that could override the checked host. Fresh installs
are transactional. Exact second runs require a source- and catalog-bound
receipt. Drift and partial states are denied rather than repaired.

## Proof boundaries

The native reference catalog is compared to separately created databases and
also checked against current Django model fields. Reference equality by itself
does not establish full application compatibility or tenant isolation.

With a wheelhouse configured, clean-room additionally runs the current backend
settings, WSGI, model and URL startup proof before allocating its PostgreSQL
container. `currentBackendStartup` is separate from native catalog equality:
successful startup still leaves runtime database qualification `NOT_PROVEN`.
The Python/TypeScript startup helpers and their current backend source hashes
are bound into the source plan before qualification, using the same backend
file selection as the hermetic transport. Startup cannot add commitments after
execution: missing or mismatched commitments are rejected rather than refreshed,
and clean-room output remains reproducible by the standalone plan generator.
A saved-plan invocation without a wheelhouse records startup
as `NOT_PROVEN`. Collector failures propagate and are persisted as startup
failure, never as success.

Full RLS/actor/tenant coverage, privileged-function review, current-application
startup and relevant repository tests must all be proven before readiness can
pass. Missing internal schema or security work is not an external gate. Consult
the generated runtime evidence for the actual achieved ceiling, not this
implementation description.

The integrated runner additionally invokes the shared SYSTEM component engine
in a separate mission-owned native fixture built from the same source plan.
This avoids reusing the ordinary matrix's seeded cohort as a second fresh
qualification. It supplies the production postgres-js writer, preserves failed
matrices, and records fixture removal only after successful cleanup. Proof and
cleanup exceptions remain visible together. Five producer-source commitments
must match their actual bytes before fixture allocation. Native integrated
qualification of this wiring passed all 39 SYSTEM table components alongside
the independent 339-table component and 318-table ordinary-actor matrices;
both owned fixtures were removed and no mission containers remained.
Overlapping table counts are not summed. This integration is not whole caller
mapping or a financial database installation, and whole readiness remains
fail-closed.

The broader API/service/auth/database/mobile selector targeting this candidate
recorded 8,625 passed tests and 57 skipped tests across six skipped suites, but
exited with one suite import failure for Next.js's compiled edge-runtime cookie
module. No test cases failed. The failed forecast route suite independently
passed all three cases without source changes or dependency installation once
the import resolved again. The missing-module cause is not established, and
this recheck does not turn the failed broad run into a complete-selector PASS.
Skipped legacy database suites are not runtime proof, and these counts are not
summed with the separate 767-case native selector.

The post-run deterministic source check found lockfile drift: all other
independently checked on-disk commitments matched, but the current lockfile no
longer matches the qualified plan. Dependency-state continuity is therefore
not proven. The plan and lockfile were not rewritten or restored; the earlier
qualification remains evidence for its recorded candidate, not acceptance of
the changed dependency state.

The previous plan and runtime evidence were then copied to hash-bound session
archives before prospective regeneration against the current lockfile. The new
plan digest is `cfc4fda694e85db434e6ce1d6006cc87b68426e6dacd608039232bdee01ea6dd`;
canonical SQL and table descriptors are unchanged, and only the lockfile
commitment differs. Deterministic generation/check and both strict typechecks
passed. A separate complete 30-file native/application requalification passed
767 of 767 tests with zero skips on this candidate. Integrated clean-room
requalification independently reproduced 19,405 objects, fresh creation, exact
NOOP, installer/auth/framework PASS, 339/339 component, 318/318 ordinary-actor
and 39/39 SYSTEM matrices with both fixtures removed and zero residual
containers. The post-run deterministic check passed. Exit 1 is the deliberate
whole-readiness refusal, not an execution exception; remaining application,
organization-selection/session and financial/security scope is not qualified.
Overlapping matrix counts are not summed.

The [candidate manifest guide](./UE_CANONICAL_SCHEMA_V2.md) records the remaining
inventory, provenance, direct-import and scope qualification gaps.

### Canonical organization selection

With V2 enabled, organization enumeration and switching use active private
profiles/memberships rather than public membership rows, email-based self-heal,
provider role metadata or the platform-admin environment allowlist. Private
platform administration does not fabricate organization membership. Metadata
reads use the existing SYSTEM SELECT grant, filtered by the authenticated
actor's active memberships and projecting only canonical caller-required
columns. A first native run preserved 12 failures when legacy SELECT-all
requested the non-canonical `app_id` column; the fix narrowed the query, not the
schema or tests.

A password switch locks the old live bearer row, inserts a newly hashed random
bearer with the exact original PostgreSQL expiration, and revokes the old row
inside the actor's auth transaction. The response cookie is prepared on an
isolated response inside that transaction and delivered only after commit.
Native tests verify exact persisted expiry, next-request RLS, one-winner
concurrency, cookie-preparation rollback and an actual deferred PostgreSQL
commit failure. A password session with no organization stays unselected until
an explicit server rebind; this matches the imperative guard's no-org profile
semantics. No organization-ID UPDATE grant was added.

Verified-provider selection stores only an actor-bound organization preference,
not password-session authority. Canonical application context and ordinary RLS
revalidate private membership on each request, and provider bridges remain
bounded to 30 seconds and revoked after callbacks. The local native test invokes
the actual signed acceptance-credential resolver for valid and tampered tokens.
Its OAuth backend is stubbed and all databases are local ephemeral fixtures:
this is neither live Entra proof nor deployed staging certification.

Canonical API responses carry a shared authority discriminator and the server's
active organization. The UI does not choose from legacy cookies, manufacture
synthetic organizations, fall back to profile authority or write legacy cookies
after a canonical switch. Tree/path endpoints use the same active private
membership metadata scope. Unowned ancestors are omitted with explicit partial
path fields, not silently claimed as a complete hierarchy. Canonical hierarchy
failures surface through the provider's error state.

The pre-hierarchy frozen candidate passed 809/809 tests across 32 files with all
native flags enabled and zero skips. After wiring the hierarchy consumers, a
covering five-file selector passed 105/105, including 25 actual native
organization cases and legacy path regressions. The final frozen hierarchy-aware
candidate `adf1c8d9…` independently passed 818/818 across 33 files with zero skips
and zero remaining fixtures. These overlapping counts are not summed. Strict
application/manifest types and zero-warning application/package lint passed.
New helpers/proof/documentation formatting passed; seven legacy touched files
fail whole-file Prettier checks both at HEAD and currently, and their unrelated
formatting is preserved.

The same frozen `adf1c8d9…` candidate then independently refreshed integrated
clean-room evidence: 19,405 verified objects, exact second-run NOOP, minimum
installer/auth/framework boundaries PASS, 339/339 security component tables,
318/318 ordinary actor-class tables and 39/39 SYSTEM mutation tables. Both
fixtures were removed, zero V2 containers remained and the post-run deterministic
check passed. The runner intentionally returned exit 1, with no execution
exception, because whole application actor/caller mapping, full financial graph
and whole security qualification remain unproven. Engineering/security readiness
remain FAIL; SaaS readiness remains NO_GO. (Historical; superseded by the terminal acceptance section.) Prior `cfc4…` and `06a6…` receipts remain
separate historical candidate evidence, not current-source acceptance.

The subsequent prospective type-config candidate `6a311786…` fixes an inherited
application-check mismatch without modifying historical tooling: UE is a
`noEmit` Next app, but the shared base enabled declaration/declaration-map
generation. The official typecheck first reported 18 TS4058 exported-name
diagnostics in imported historical W4 tools. Disabling both declaration-only
options in the UE app config made the official check pass while preserving
strictness, `noImplicitAny`, existing program exclusions and shared library
declaration settings. The compiler now hash-binds the app config and its two base
configs. Exact comparison preserved every executable statement and all other
schema/security/domain plan fields; 250 statement provenance digests changed
because the compiler's own source commitment changed. Covering bootstrap/manifest
tests passed 67/67 across three files. This is not full Next runtime-startup proof
and does not relabel the prior `adf1…` integrated receipt as a `6a31…` execution.

The canonical shared authentication declarations are materialized in the
co-resident `user_management` namespace, together with the current public
provider identity-binding declaration. Dedicated auth roles/functions/policies
are installed before business policies. Role and membership inventory includes
the exported auth registry, and independent auth privilege expectations are
checked separately from compiler output. Ordinary and legacy-system clients
receive no direct auth table grants. The ordinary role receives only the
source-approved session/membership helper interface.
Own-user usage references retain an own-actor parent guard. Recommendation and
KPI attribution references instead validate an active canonical target member
of the authenticated organization, preserving legitimate same-org cross-user
relationships without allowing foreign/inactive/unknown parents. Unclassified
canonical auth-parent semantics fail compilation rather than inheriting a
generic guess.

V2 business policies require a live bearer, canonical active user and exact
active organization membership in addition to their existing domain predicate.
The public-table native matrix uses actual synthetic canonical sessions and
tests forged organization settings and missing bearers. The separate auth
boundary runs through dedicated restricted LOGIN connections after lifecycle
qualification and asserts that its temporary proof objects leave no catalog
residue. These are local synthetic qualifications, not cross-database atomicity,
production routing or whole-application acceptance claims.

Current application V2 context is explicitly selected with
`UE_CANONICAL_BOOTSTRAP_V2=1`, alongside dedicated `AUTH_DATABASE_URL` and
`AUTH_SYSTEM_DATABASE_URL` credentials. The ordinary wrapper validates canonical
membership and binds the live bearer before transaction-local context is applied;
the existing transaction override also covers no-argument callbacks. Invalid
flag values, ordinary system-scope requests and actor impersonation fail
explicitly. Legacy context behavior remains unchanged when the flag is absent
or `0`; that mode cannot satisfy V2 bearer-required policies.
The plan binds that wrapper, its transaction/database context sources and the
shared auth-service source tree before qualification. Bridge callback and
revocation failures are both surfaced; cleanup cannot silently disappear behind
the original callback error.

The native component matrix uses real restricted LOGIN sessions. It checks
bidirectional visibility, missing context, foreign UPDATE/DELETE, foreign
INSERT where granted, valid own-tenant UPDATE followed by rollback, and
source-qualified parent-FK visibility. Auth-parent probes
also use the actual current usage, recommendation and KPI tables: valid own
parents, foreign parents within an otherwise own-org insert, and same-org
attribution versus own-user semantics. Fresh insert fixtures verify native
unique keys before assigning a new identity, and accepted writes are rolled
back. Missing organization context is checked for every V2 SELECT policy,
including self-owned and mixed global/tenant classes.

Self-FK checks use restricted
security-invoker PL/pgSQL helpers with a pinned search path; they retain the
caller's SELECT RLS rather than introducing owner or security-definer bypass.
Geofence fixtures use the current `union_local_id` ownership geometry.
Source-classified tenant tables retain their actual `org_id` boundary where
that is the current column name; no additional privileges are inferred.
Synthetic JSON parameters are explicitly JSON-encoded, including arrays.
Passing this matrix does not establish all actor classes or full application
authorization.

Current push-device ownership is a text FK to unique `profiles.user_id`, matching
the authenticated-user identifiers used by the mobile route and FCM service.
This prospective current-source repair does not rewrite historical migrations.

The canonical Django mobile-device, notification and offline-sync models now
own the fields consumed by their current declarations. The policy-rule,
evaluation, exception, retention and legal-hold models likewise own their
current policy-engine fields. Existing nullable names and Django's physical
deferred FK semantics remain unchanged. These are source-backed prospective
model changes, not schemas reconstructed from a live database.

The CLC tenant-sync model now carries required organization ownership and
the current tenant audit fields. The tenant collection routes require the
tenant-sync declaration; the unrelated global partnership template does not
authorize tenant access to a global synchronization log.

Current Drizzle server defaults are materialized explicitly for shared model
columns. A Django client-side UUID, audit timestamp or scalar default does not
mean PostgreSQL has a server default. The compiler must not presume that it
does: real caller inserts may emit `DEFAULT` for omitted values. These
source-bound prospective producers apply only during fresh installation, not
as silent repair of an existing or drifted database.

The [native caller-default proof](./UE_BOOTSTRAP_V2_CURRENT_DEFAULT_PROOF.json)
first reproduces the missing UUID server-default failure with the actual
Drizzle device insert. It then verifies the corrected insert, scalar/JSON
defaults and canonical audit initialization under a separate nonowner,
non-bypass LOGIN. This narrowly scoped proof does not claim tenant isolation
or full application qualification. Its CLI supports source-bound `--check`.

The native manifest binds objects to observed PostgreSQL DDL executions and
automatic/internal dependency producers, retaining current-model authority
and producer code byte hashes. It exports portable PostgreSQL dependency
identities, including cluster ownership. Cluster roles and image prerequisites
are explicitly pre-existing, not fictional per-database creations.
Native column-default objects have their own canonical inventory entries and
dependency addresses. At DDL completion the trace observes actual defaults,
indexes and constraints attached to the affected relation/type, so post-CREATE
ALTER producers bind to their real execution. Without that object observation,
defaults, indexes and constraints remain unresolved; they never inherit an
earlier parent-table creation order. This expands native object counts without
counting dependency edges as objects.
Restricted event-trigger instrumentation is removed before catalog inspection;
no trace-shaped objects are excluded from drift checks. Unresolved bindings,
declared-source mismatches and privilege defects are blockers, not synthesized
success. The deterministic JSON and Markdown inventory separates this local
manifest qualification from whole engineering, security and startup gates.

Default qualification reads canonical Django UUID/audit metadata and the live,
source-bound Drizzle exports independently of generated installation SQL.
It compares them with native `pg_attrdef` expressions: missing or NULL defaults,
wrong canonical generators, and unequal/unrenderable caller defaults fail.
Expression comparison is conservative and never evaluates arbitrary default
functions. It does not replace actual application INSERT compatibility probes.
The native regression checks successful UUID/audit `DEFAULT VALUES` insertion,
then demonstrates declaration failures and a real NOT NULL violation after
removing those defaults.

### Manifest qualification checks

The manifest closure has a dedicated strict typecheck and zero-warning lint:

```powershell
node --max-old-space-size=8192 node_modules\typescript\lib\tsc.js --project apps\union-eyes\scripts\bootstrap-v2\manifest-typecheck.json --pretty false
pnpm --dir apps\union-eyes exec eslint scripts\bootstrap-v2\manifest*.ts scripts\bootstrap-v2\installer.ts scripts\bootstrap-v2\clean-room.ts --max-warnings 0
$env:UE_V2_NATIVE_MANIFEST = '1'
pnpm exec vitest run --config apps\union-eyes\vitest.config.ts apps\union-eyes\scripts\bootstrap-v2\manifest-defaults.test.ts apps\union-eyes\scripts\bootstrap-v2\manifest-application.test.ts apps\union-eyes\scripts\bootstrap-v2\manifest.test.ts apps\union-eyes\scripts\bootstrap-v2\manifest-native.test.ts apps\union-eyes\scripts\bootstrap-v2\bootstrap-v2.test.ts
```

The opt-in native test requires the pinned PostgreSQL image already available
locally. It uses a uniquely labeled synthetic container and verifies actual
fresh/no-op, drift/partial denial, verification/receipt/commit rollback, and
destroy/recreate. It independently exercises declared type aliases, qualified
auth-schema columns, Django-style unique indexes, rogue column grants,
system-only function search paths and undeclared sequence grants. It is not a
replacement for current-source full-catalog clean-room or application-actor
qualification. A stale source-plan byte hash remains a manifest blocker; source
changes must never be accepted by merely refreshing stored hashes.

Legacy upgrading is separate. No historical database receives an automatic
destructive repair or an inferred V2 receipt.

## Final V2 production runtime and required credential authority

The actual owned Next webpack production attempt
`692b860b-c466-427a-a137-3f5d4d80fd19` exited build with code zero and logged
server readiness, but its initial HTTP probe timed out. Its archived receipt
remains **FAIL**, not final runtime acceptance. New observer/caller/configuration
edits are not covered by that historical snapshot or the saved source plan.

The root layout now bundles unchanged Poppins weights 300/400/500/600/700 through
`next/font/local`, avoiding the real Google-font network dependency rejected by
the isolation boundary. Original license and pinned upstream commit/file hashes
are retained under `public/fonts/poppins/`.

Current source-bound Node transport observations and actual production
`encryptSecret` refusals are covered by 18/18 targeted tests across three files,
zero skips, with scoped lint, official app typecheck and strict acceptance
typecheck passing. This is not full caller/native HTTP/financial qualification
or OS-level network isolation.

The required encrypted SSO credential caller exposes a production key-authority
contradiction with the no-Azure/no-external-secret-store mission: the existing
production encryption implementation only accepts Azure Key Vault and refuses
fallback keys. See
[the exact source/caller/actor/scope blocker](UE_V2_FINAL_V2_ACCEPTANCE_BLOCKERS.md)
and its source-bound JSON evidence. No mandatory control was disabled, no
replacement authority was represented as approved, and no final PASS is claimed.

### Final acceptance reset (control-based) and current status

The paragraph above describing the encrypted-SSO key-authority contradiction is
superseded: an independent run showed the unchanged production encryption working
against authenticated local vendor-protocol fixtures with real SDKs and TLS
verification, and durable key custody was subsequently fixed. Production key
provisioning remains an external gate. The refusal evidence is preserved, not
rewritten.

The per-caller runtime-qualification campaign (901 callers, 795 financial callers)
was abandoned by product-owner decision in favor of control-based acceptance. The
frozen definition of done is
[UE_FINAL_ACCEPTANCE_LEDGER.json](UE_FINAL_ACCEPTANCE_LEDGER.json) with gates G1-G8;
no further gates may be added unless execution finds a product, security or
data-integrity defect. The generated inventory and receipts stay as evidence.

Shared defects fixed in this pass, each with regression tests, took the
authenticated 5xx diagnostic from 114 to 66 of 135 routes:

- `withOrganizationAuth` now runs the handler inside the canonical organization
  RLS transaction and maps entitlement denials to 403.
- The V2 audit writer targets the canonical `public.audit_logs` hash chain instead
  of the excluded `audit_security.audit_logs`. Hash parity with
  `backend/core/services.py` is tested against real Python output, and a native
  PostgreSQL test verifies the chain under concurrent writers, per-organization
  isolation, tamper detection and rollback. Persistence failures are no longer
  swallowed.
- `withApi` parses request bodies from a clone, fixing 14 routes whose legacy
  wrappers re-read an already consumed body in V2.

The remaining 66 at that point were dominated by application-versus-canonical
schema drift (missing relations and columns, text/uuid mismatches), an internal
defect rather than an external gate. Evidence: `UE_V2_FAILED_STATEMENT_PROBE.json`
(each failed SQL statement replayed under the real application roles) and
`UE_V2_APP_SCHEMA_COMPATIBILITY.json`.

A second pass closed the shared causes behind 19 more routes and froze candidate
`82c6b35f…` (692 tables, 8,414 statements, 19,797 verified objects):

- Live Drizzle declarations that callers import directly but the schema barrel omits
  (ingestion, SSO/SCIM, integration, workbook, chart of accounts) are now direct
  current-caller operational sources, as mobile and policy already were.
- Seven ICRA tables had SYSTEM_ONLY authority with no SYSTEM privileges although every
  ICRA route runs as SYSTEM. Privileges were derived from source operations, taking the
  SYSTEM mutation census to 48 relations with source-bound callers.
- The security compiler now honors the recorded `PARENT_VIA_USER` override for a child
  with two foreign keys.
- Authorization denials raised inside handlers return 403, unhandled-error logs carry
  the cause and SQLSTATE, and legacy-wrapper audits are awaited inside the tenant
  transaction in V2.

A third pass fixed tenant-owned ingestion routes that ran under SYSTEM, Next 16 route
params that legacy wrappers read synchronously, audit reads of the excluded table,
bare-connection reads, consent-revocation delete grants and several client errors that
returned 500, and refroze as candidate `c804b85f…` (692 tables, 8,414 statements,
19,800 verified objects). On it: application and strict typechecks pass; clean-room
fresh install and exact NOOP pass with component 350/350, ordinary actor 329/329 and
SYSTEM 48/48 (overlapping, not summed); the isolated production Next build, startup and
22-step HTTP smoke pass with zero external targets; and `pnpm test:fast` with the native
flags enabled passes 38,205 tests with no failures (114 skipped). An earlier candidate
in this pass had 16 failures from four test files whose mocks predated earlier source
changes; the mocks were updated and the suite rerun. Candidates `82c6b35f…` and
`96cbcb88…` are superseded.

Authenticated 5xx routes fell from 114 to 66 to 47 to 35 to 31. Two remaining groups need
product decisions: five cron routes that need cross-organization SYSTEM authority, and
dues routes where `member_dues_ledger.user_id` is a uuid but application user ids are
text. The caller-control graph (`UE_V2_CALLER_CONTROL_GRAPH.json`, static, not runtime
proof) maps 465 of 512 mutating root callers to a shared control. The 47 unmapped
callers and 159 exception callers are the remaining direct-proof work in the frozen
ledger, together with the remaining 5xx routes, critical journeys and financial
authority classes. Engineering/security readiness remains FAIL and SaaS readiness
NO_GO; nothing here is a PASS claim. (Historical statement for the c804b85f… pass; superseded by the terminal acceptance section below.)

### Final closure sprint (control-based acceptance)

The two product decisions were applied. D1: relation-specific cross-organization SYSTEM
SELECT was granted for `claims`, `org_subscriptions`, `grievances`, `ml_predictions`,
`ingestion_batches` and `platform_invoices`. The deadline engine's own scheduled
work-state tables (`deadline_reminders`, `deadline_reassignment_convergence`,
`deadline_reminder_executions`) were granted SELECT/INSERT/UPDATE (executions
SELECT/INSERT) and their current declaration was added to the plan. That is a write
grant beyond the literal D1 text and needs owner confirmation; the SYSTEM mutation
census is now 51 relations. The SLA watchdog no longer writes `pilot_events`, and
`cron/billing-lifecycle` fails closed with 501 because invoice generation is a
cross-organization financial write. D2: `member_dues_ledger.user_id` (and, for the join in
the arrears route, `member_arrears.user_id`) is TEXT in the Django model and migration
`0002`; no casts or surrogate identifiers.

Final candidate: plan digest `93fd3cd0…` (694 tables, 8,422 statements, 19,863 verified
objects, catalog `cd4fd330…`). On it: clean-room fresh install and exact NOOP pass with
component 352/352 and SYSTEM 51/51 (overlapping, not summed); the isolated Next build,
startup and 33-step HTTP smoke pass with zero external targets; the 135 authenticated
diagnostic routes have **0 internal 5xx** (final statuses: 200 ×28, 201 ×3, 400 ×27, 403
×54, 404 ×15, 415 ×1, 501 ×3, 503 ×4); the native suites pass (25 files, 629 tests);
`pnpm test:fast` with the native flags passes 38,215 tests (114 skipped, none failed).
The legacy clean-room readiness field still prints FAIL (it asks for per-table actor
qualification, which the product-owner reset abandoned); that is not the G1 criterion.

External or product-decision outcomes: 503 for unconfigured Resend, Stripe, PayPal and
Microsoft calendar integrations; 501 for the PKI verify route (its `digital_signatures`
relation exists only in the separate financial-service database), the CUPE seed
fixture (absent from the repository) and billing lifecycle (write authority).

Shared defects fixed this sprint: entitlement and role denials return 403, unknown or
settled PKI workflows return 404/409, Next 16 route params are awaited, the dues
payment route now verifies canonical membership and runs in the tenant RLS
transaction (it previously trusted the organization in the request), and the cron
secret is compared in constant time.

The caller graph now binds **512 of 512** mutating root callers to a shared control
(static; `scripts/acceptance/caller-control-graph.ts` fails generation for any unbound
caller). `UE_V2_ACCEPTANCE_CONTROLS.json` holds the 11-control table, 10 deduplicated
exception classes (158 callers) and 6 financial authority classes. Their evidence is
representative (existing tests plus the HTTP journeys), not per-caller runtime proof.
`chart_of_accounts` and `donations` drift was classified latent: no live main-application
caller uses the drifted declaration. Details and hashes are in
`UE_FINAL_ACCEPTANCE_LEDGER.json`. UE SaaS readiness stays NO_GO; nothing was committed,
merged or deployed.

### Terminal acceptance (normalized 2026-10-15)

Union Eyes engineering acceptance is **CLOSED_PASS**. The product owner confirmed both
decisions and the ledger was normalized without any application, schema-authority or plan
change, refreeze or qualification rerun. The tested candidate stays frozen: plan digest
`93fd3cd07e79f5485a0d412fb74c48f274212b5a4713f4998439415806f1f6cd` (694 tables, 8,422
statements, 19,863 verified objects) and Next build artifact `3c527226…1404a`
(`3c5272264e9eeb9872eefe0d1a43c276cacbb85b14b3b13be8e21061a1f9404a`).

| Field                                                    | Value                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `UE_ENGINEERING_READINESS`                               | `PASS` (frozen local synthetic-data G1–G7 definition satisfied)                    |
| `UE_PRODUCTION_SECURITY_READINESS`                       | `PASS_WITH_EXTERNAL_GATES`                                                         |
| `UE_SAAS_READINESS`                                      | `NO_GO`                                                                            |
| `UE_DONE`                                                | `YES` (this engineering mission is closed; it does not mean deployed SaaS is live) |
| `KNOWN_CRITICAL_DEFECTS` / `KNOWN_HIGH_SECURITY_DEFECTS` | `0` / `0`                                                                          |
| `MERGE_AUTHORIZED` / `DEPLOY_AUTHORIZED`                 | `NO` / `NO`                                                                        |

Gates: G1–G7 `PASS`; G8 `OPEN_BY_DESIGN`.

- **D1 (owner confirmed).** SYSTEM may mutate only the scheduled deadline-engine
  work-state relations: `deadline_reminders` (SELECT, INSERT, UPDATE),
  `deadline_reassignment_convergence` (SELECT, INSERT, UPDATE) and
  `deadline_reminder_executions` (SELECT, INSERT). SYSTEM DELETE and SYSTEM writes to
  business tables (`claims`, `grievances`, `org_subscriptions`, `ml_predictions`,
  invoices, tenant financial records) are not authorized. `cron/billing-lifecycle`
  stays fail-closed at 501 until a separate owner authorization exists.
- **D2 (owner confirmed).** `member_dues_ledger.user_id` and `member_arrears.user_id`
  are TEXT; no casts, surrogate UUIDs or parallel identity mapping.
- **Legacy clean-room readiness field.** `HISTORICAL_NON_BINDING_RESULT`: it keeps its
  original FAIL output because its criterion is the superseded per-table actor
  qualification model. The binding model is `CONTROL_BASED_ACCEPTANCE`; earlier
  "readiness remains FAIL" statements in this file are historical.
- **Evidence boundaries.** G3 is a static binding of all 512 mutating callers (0
  unmapped). G4 (158 exception callers, 10 classes) and G6 (52 financial callers, 6
  authority classes) are representative runtime evidence by class, not per-caller
  proof. Internal 5xx across the 135 diagnostic routes: 0.
- **External or deferred gates (G8).** Resend, Stripe and PayPal webhook configuration;
  Microsoft Calendar OAuth; object storage for positive document upload; PKI
  separate-database capability; CUPE pilot fixture; billing lifecycle SYSTEM write
  authority (a deliberate product-authority hold); staging, production and
  Azure/customer-data execution. None is a known critical or high-security defect.

Further UE work belongs to a separately authorized deployment and external-gates lane.

### Staging defect closure (2026-10-15)

Deployed synthetic-data staging found launch-scope defects, so acceptance was reopened, the
defects were fixed once, the candidate was requalified locally once, restaged once and proven
with a bounded set of journeys. Machine-readable record:
`UE_FINAL_ACCEPTANCE_LEDGER.json#stagingDefectClosureSprint`.

| Defect | Fix                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | `claim_number` is unique per organization (`(organization_id, claim_number)`) with race-safe allocation in `lib/claims/claim-number.ts`.                                                                             |
| B      | `APPLICATION_USER_ID=TEXT`: 45 identity columns converted; 18 entity UUIDs and 14 dead columns left; `UE_APPLICATION_IDENTITY_CONTRACT.json/.md` records `UNCLASSIFIED=0`. Text user ids are accepted by validators. |
| C      | `public.audit_logs` is the canonical sink; claim create, document upload and download, membership changes, dues settlement and SYSTEM deadline processing audit in the mutation transaction.                         |
| D      | Members cannot credit their own dues. A server-owned pending payment is settled only by a verified Stripe webhook (idempotent, validated, audited).                                                                  |
| E1     | `organization_members.exempt_from_per_capita` (NOT NULL, no database default) is supplied by the ORM; the wider NOT NULL/default census (108 columns, 34 tables) is backlog outside the launch scope.                |

| Field                     | Value                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Previous plan digest      | `93fd3cd07e79f5485a0d412fb74c48f274212b5a4713f4998439415806f1f6cd`                                             |
| New plan digest           | `4f9732e25ce07fc953648d5275c1901d674c833c78631b814f389bb90cc4c748` (694 tables, 8,420 statements)              |
| New Next build artifact   | `461d952ed1bef43ab9a580e80bd70485d2dcebbdc9b5c312c6464c45f0c5c6d5`                                             |
| Catalog digest (local)    | `863de854d655321d3c639bd41dfbc0938cbe04d13bf0c91d1c8fa341e857cc2c` (19,865 objects)                            |
| Catalog digest (Azure)    | `a82fa3a81be06607f753b09fe66ee934fb8112311957e2b186c5ffc02b9cfc0f` (0 missing; extras are staging login roles) |
| Identity contract digest  | `e1dfce09aed72b944d016c57077cfb04b2a28ddb425cdedc40bae65cdb7392b0`                                             |
| Local requalification     | clean-room matrices 352/352 and 53/53, native suites passed, `test:fast` 38,258 passed, 0 failed               |
| Staging critical journeys | 23/23 passed, 0 unexpected internal 5xx                                                                        |

Readiness is restored to `UE_ENGINEERING_READINESS=PASS`,
`UE_PRODUCTION_SECURITY_READINESS=PASS_WITH_EXTERNAL_GATES`, `UE_SAAS_READINESS=NO_GO`,
`UE_DONE=YES`; `STAGING_READY=YES_PROVIDER_GATES_OPEN`, `PRODUCTION_READY=NO`.

External gates: Resend is proven in staging: with owner authorization the enabled production Resend key was copied into
`nzila-staging-kv` and the staging app, Resend accepted a test send, and the deadline worker recorded the
reminder as sent to the sink address `delivered@resend.dev` (23/23 rerun). Follow-up: that is a production
credential in a staging vault, so replace it with a staging-specific send-only key before production
enablement. Stripe is proven in TEST mode end to end: staging created a real PaymentIntent, Stripe's test card paid it, and
Stripe itself delivered the event to a registered staging webhook endpoint, which settled it exactly once (8/8,
`run-staging-stripe-delivery-proof.ts`; the audited event id is retrievable from Stripe). Tamper and duplicate
cases were proven earlier with locally signed events. Staging is provider-ready; `STAGING_READY=YES`. Remaining open: production infrastructure hardening (PostgreSQL exposure, ACR admin
credentials, storage keys), PayPal, Microsoft Calendar, PKI, the CUPE pilot fixture, billing lifecycle
authority, and production and
customer-data execution. Merge and production deploy are not authorized.

Staging cost state: app, ClamAV and Redis at 0 replicas, PostgreSQL stopped (Azure restarts a
stopped flexible server after 7 days). To resume, start `nzila-ue-v2-staging-db`, then set the
minimum replicas of `nzila-ue-v2-redis`, `nzila-ue-v2-clamav` and `nzila-os-union-eyes-v2-staging`
to 1.
