# Institutional Intelligence

Existing lineage and dependency engines retain their original exports/semantics.
The opt-in `@nzila/institutional-intelligence/foundation` export provides the
Checkpoint 3 **local/synthetic** runtime slice described in the
[accepted operating contract](../../docs/architecture/NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
It is not wired into an app, public endpoint, production identity or deployment.

## Local foundation composition

- Canonical scopes/references/context shapes come from platform-contracts.
- Trusted server ports resolve session/principal/target, assignments, entitlements,
  cross-scope grants, registered policy, independent approvals and persisted
  Control Plane authorization. Caller commands contain none of those authorities.
- The existing platform-policy-engine evaluates policies; it does not grant
  authority just because a policy had no matching denial.
- `LocalInstitutionalStore` uses Node 24 SQLite for ephemeral persistence proof:
  scoped revision keys, BEGIN IMMEDIATE transactions, CAS, immutable rationale
  payloads and unique successor links. This is not a production DB alternative.
- `InstitutionalMutationBoundary` commits source history, intent and receipt in
  one transaction. `execute` explicitly returns `auditDelivery: PENDING`.
  A trusted outbox consumer calls `deliver`; verified proof transitions to RECORDED.
  Mutation continuation/effective rationale reads require the recorded receipt.
- The proof sink port composes existing audit/NAR infrastructure. Tests use the
  existing NAR signing/verifying functions with a fictional local key and local
  fixture record storage; no Azure or production secret is accessed.
- Mission lifecycle, bounded specialist submissions/acceptance and canonical
  analysis/rationale are guarded independently. No foundation action deploys.

Do not expose the persistence adapter, authority ports or synthetic fixture
adapters to untrusted callers. `synthetic.fixture.ts` is test support, not an
authority/identity/policy registry for production. Context shape parsing does not
replace the issued-context provenance check.

## Persistence and compatibility

The existing shared PostgreSQL family uses Drizzle in packages/db and
`db:generate`/`db:migrate`; its org-scoped registry remains unchanged. Checkpoint 3
uses only local temporary SQLite files, removed by tests, so no migration or
backfill is necessary. Production PostgreSQL transaction/constraint adapters,
real trusted identity/CP/approval integration and production audit-sink delivery
remain unproved. See the [runtime closeout](../../docs/architecture/NZILA_OS_CP3_RUNTIME_FOUNDATION_CLOSEOUT.md).

Scope bindings use explicit namespace/legacy-key/mapping versions; raw tenant/org/
institution string equality cannot create a mapping. Historical explicit version
resolution is read-only and does not restore a revoked live binding.
Governance-org membership does not authorize institutional actions.

## Validation

Run package scripts `pnpm --filter @nzila/institutional-intelligence test`,
`typecheck`, and `lint`. Foundation tests cover durable restart, races, audit
failure/finality, attribution/independence, expiry/revocation and cross-scope denial.
The old lineage/dependency tests remain regression obligations.

## Checkpoint 4 operating composition

The opt-in `@nzila/institutional-intelligence/operating` export extends the same
local foundation; it is not a new package, universal record database or host.
`InstitutionalOperatingRuntime.foundation` composes the CP3 source commands with
CP4 Mission blocker and specialist-output guards. Use that composed instance for
CP4 work; standalone CP3 consumers retain their existing behavior.

- Estate rows hold exact authoritative references, classifications, lifecycle
  and stewardship metadata, not copied product or ITSM records.
- Institutional relation validation comes from the separate platform-ontology
  institutional vocabulary. Traversal uses platform-entity-graph's opt-in
  directed port, with visibility checks before traversal/counts, stable ordering,
  budgets, cycles, lifecycle modes and explicit incomplete coverage.
- RAID proposals are attributed input only. Effective records, risk acceptance,
  dependency waiver, assumption validation and issue closure use distinct human
  policy actions, revision checks and audit intent. Required dependencies are
  rechecked at Mission start; graph refresh cannot clear them.
- Operations store only links to incidents/problems, independent Operational and
  Deployment Changes, Missions, rationale and estate sources. No source ticket
  FSM, Change authorizer or deployment executor is replaced.
- Specialist terms restrict the existing Recommendation output; obligations
  reference exact independent OutputAcceptance receipts. There is no procurement
  or supplier-contract engine.
- Lanes use declared units/windows and referenced planning evidence. UNKNOWN
  quantities are null. Known reservations use CAS and reject overcommitment.
- Benefits retain FORECAST/OBSERVED/REALIZED/REJECTED/UNPROVEN source revisions,
  immutable observations and acceptance receipts. A trusted measurement adapter
  supplies actual observations; callers cannot submit a realization flag.
  Numeric criteria require baseline evidence, completed measurement window,
  source integrity and independent internal-human acceptance. Reassessment
  retains the original acceptance and historical realized revision.

`InstitutionalCommandReadModel` implements the accepted 22 read contracts across
TODAY, PORTFOLIO and ESTATE. Its request payload contains `view`, `illustrative`,
`filters`, `pageSize`, optional `cursor` and optional `at`; requested scope is
resolved by the trusted CP3 target/authority boundary. It exposes no source
mutation method. Changing a returned projection does not change its source.
Current COMMAND snapshots are supported; arbitrary historical COMMAND snapshots
fail explicitly. Historical estate traversal is supported separately.

Source adapters must authorize fields before returning their typed projection,
preserve exact reference/revision, observed time, watermark and versioned
freshness policy, and report outages rather than return empty success.
Missing adapters are UNAVAILABLE; expired observations are STALE; missing
policies/meaning are UNKNOWN; restricted/truncated branches are INCOMPLETE.
ILLUSTRATIVE requires explicit opt-in and cannot mix with operational OBSERVED
inputs. Local fixture values never contribute observed totals. Missing baseline,
measurement, capacity, owner or coverage is never silently manufactured.

All adapters, identity/authorization policies and measurements used in the tests
are fictional. Source fixtures are rehydrated separately on restart; SQLite
persists institutional metadata/history/audit, not external authoritative stores.
See the [CP4 closeout](../../docs/architecture/NZILA_OS_CP4_OPERATING_RUNTIME_CLOSEOUT.md)
for exact proofs and production limitations.
