# Cora Farmer 360

**Capability truth:** `DESIGN_ONLY`  
**Phase 3.5A disposition:** `BLOCKED_AUTHENTICATED_ROUTE_ACCEPTANCE`  
**Owner:** Cora  
**Source authority:** Agrimo and other operational systems remain authoritative for their records.

Farmer 360 is intended to provide a Cora-owned enterprise profile and an
evidence-backed read model over authorized operational facts. It reuses the
shared farm, producer, field, crop, season, and production concepts; it does not
replace or mutate Agrimo records.

## Truth and data handling

- Each fact carries its organization and profile scope, source reference,
  observation time, optional validity period, freshness, confidence, and quality.
- Missing evidence remains `UNKNOWN`; it is never converted into a zero, a
  negative assertion, or a complete profile.
- Conflicting facts are retained with their competing lineage and are surfaced
  as gaps rather than silently reconciled.
- Estimated and derived facts require an explicit methodology version reference.
  Estimated prices must be labelled as modeled, distinct from realized prices.
- Enterprise context is stored as effective-dated versions. Farmer corrections
  are append-only assertions and begin unverified; they do not overwrite source
  facts. Assertion storage must atomically create its Cora evidence record and
  assertion, linked by organization, evidence ID, and exact payload hash.
- All reads and writes are organization-scoped. Writes require distinct
  permissions, audited policy authorization, and consent where a farmer
  assertion is recorded.

## Current implementation boundary

The repository contains the domain contracts, a fail-closed service, concrete
Cora persistence operations, an organization-filtered producer read adapter,
an authenticated read API, a narrowly scoped read permission, and a
server-side source-disclosure gate. A disposable local PostgreSQL acceptance
harness provisions only the canonical prerequisites required by this slice,
applies the Cora evidence, Farmer 360, and platform-authorization migrations,
loads synthetic fixtures, and exercises real Drizzle repositories,
organization resolution, and service/route composition. It does not replay
the historical migration chain or use production, staging, or shared
development data.

The authenticated profile GET route is dynamic and explicitly `no-store`
with `Pragma: no-cache` and `Vary: Cookie, Authorization`. Its only source
read is withheld while the production disclosure-policy, fact-contract,
freshness-policy, and approved-evidence registries remain empty. The
non-mutating activation preflight requires current evidence for source
authority, privacy/legal review, governance, cache/retention, audit,
recipient eligibility, export/onward-use restrictions, condition
attestation, suspension, and revocation; it cannot install a policy.

The first source adapter reads only the canonical producer status as a partial
evidence-confidence fact. The generic authority gate evaluates that fact's
provenance and the complete recipient/purpose context before disclosure.
Because no institutionally approved source-disclosure policy is registered,
the runtime withholds this fact; the section is returned as `UNKNOWN`.
Production, economic, asset, and other sections also remain unknown. Producer
status is not treated as evidence of those facts. Producer status is marked
current only when the source `updatedAt` is within 90 days; absent or invalid
timestamps remain unknown. Farmer assertion
writes require the registered `cora/farmer-assertion@1.0.0` methodology,
explicit consent and policy authorization, and atomically persist canonical
evidence, assertion, and audit event records. Production runtime defaults
still have no consent grant or canonical policy pass configured, so writes
remain fail-closed. Only the local acceptance service composition supplies
explicit test consent/policy evaluators; it exercises allow and deny outcomes
without changing production provider defaults or granting write permissions
to authenticated users.

## Local acceptance harness

The test-only prerequisite SQL is derived from the current Drizzle contracts
for `orgs`, `audit_events`, `agri_producers`, and the canonical platform
identity/membership/grant chain; it creates no unrelated product tables. The
organizations, producer, and route identity are stable-ID synthetic fixtures.
The methodology entry is explicitly named and referenced as test-only.
Assertion consent and policy decisions use concrete local evaluators that
validate org, actor, purpose, recipient, source, action, and resource before
allowing; denial paths are also verified. The route test supplies an
identity-only acceptance principal at the authentication boundary, then
exercises the real organization resolver, route, service, DB-backed
persistence, and producer repository. It does not call Entra or validate an
external identity provider.

The live DB-backed test verifies organization isolation, source lineage and
freshness, source-disclosure `WITHHOLD` through the service and authenticated
route composition, durable value-free source-decision audit records,
untrusted organization-claim non-authority, incomplete `UNKNOWN` sections,
context/assertion append-only guards, exact evidence-hash foreign-key linkage,
canonical audit columns and independently reconstructed `canonical-v1` hash,
consent/policy allow and denial without writes, unauthorized and wrong-org
rejection, and unchanged Agrimo producer data during Cora writes. A separate
source-change probe confirms changed source values remain undisclosed without
a matching approved policy and do not rewrite Cora context or assertion
history.

Reproduce on a machine with Docker and pnpm:

```powershell
pnpm cora:acceptance:db:up
pnpm cora:acceptance:db:bootstrap
pnpm cora:acceptance:test
pnpm cora:acceptance:db:down
```

The DB-backed acceptance command is the required local verification for the
updated source-disclosure route composition. It runs only against the exact
loopback-only disposable database URL and must be followed by the guarded
`down` command. No shared or cloud database is used.

The test command targets a fixed loopback-only PostgreSQL URL and refuses to
run its DB-backed suite unless both database environment variables exactly
match that target. The down command removes the dedicated acceptance
container, network, and volume. Run it after acceptance, including after a
failed test. The harness files are `TEST_ONLY`, `NON_PRODUCTION`,
`NON_MIGRATION`, and `DISPOSABLE`; the production app has no test auth,
consent, or policy bypass.

**Source-disclosure foundation disposition:** `PASS_POLICY_AUTHORIZATION_REQUIRED`
only when the documented focused and disposable-local checks pass. The
runtime's empty policy registry intentionally withholds all current Agrimo
facts. The narrow `Agrimo producer.status` direction for the
`farmer360.operational-read` purpose is recorded as
`APPROVE_WITH_CONDITIONS`; it is not source-owner, privacy/legal, final
activation, or runtime authorization. Farmer 360 remains
`BLOCKED_GOVERNANCE_CONDITIONS` and capability truth remains `DESIGN_ONLY`.
The nine outstanding conditions are tracked in the
[source-disclosure condition ledger](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md).
No positive runtime policy is approved or active. This foundation does not
claim production, staging, external-provider, real-user, or deployment
validation. No Farmer 360 write route or authenticated write permission was
added. Do not start Value Opportunity on this evidence.
