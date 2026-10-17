# NZILAOS CHECKPOINT 4 - INSTITUTIONAL OPERATING RUNTIME CLOSEOUT

## Baseline

- Accepted upstream: [CP3 runtime foundation](./NZILA_OS_CP3_RUNTIME_FOUNDATION_CLOSEOUT.md),
  `NZILAOS_CP3_RUNTIME_FOUNDATION_PASS_WITH_LIMITATIONS`.
- Starting SHA: `1c337567635bb86ea0df7831557d8d2d22df1e6f`.
- Ending SHA: `1c337567635bb86ea0df7831557d8d2d22df1e6f` (unchanged).
- Branch: `agents/pasted-text-processing-4a973147`.
- Worktree: `C:\APPS\nzila-os.worktrees\pasted-text-processing-4a973147`.
- CP1-3 source/docs were already dirty/untracked. They were retained, not reverted.
- CP4 adds bounded modules in existing
  [institutional-intelligence](../../packages/institutional-intelligence/README.md),
  opt-in directed traversal in
  [platform-entity-graph](../../packages/platform-entity-graph/README.md), and a
  separate [institutional ontology vocabulary](../../packages/platform-ontology/README.md).
- Existing manifests gain opt-in exports and two workspace dependencies; the
  lockfile gains only those two links for CP4. No dependency-version upgrade.
- CP3 foundation receives optional composed Mission/specialist guards and
  immutable value-receipt protection. Standalone CP3 consumers remain compatible.
- No new package, shared DB edit, SQL migration, backfill, app, endpoint, broad UI,
  connector, real identity, production authority, commit, merge or deployment.

Frozen target contracts remain
[estate](./NZILA_OS_ESTATE_MODEL.md),
[RAID](./NZILA_OS_DECISION_AND_RAID_MODEL.md),
[operations](./NZILA_OS_OPERATIONS_MODEL.md) and
[value](./NZILA_OS_VALUE_MODEL.md). CP4 does not redesign them.

## Gates

Executed in order; failed checks were corrected and rerun before advancement.
All PASS statements below describe bounded local/synthetic proof, not production.

| Gate | Proof | Result |
| --- | --- | --- |
| A Estate/graph | Exact references, typed relationships, scoped directed impact, redaction, deterministic traversal, history/lifecycle | CP4_GATE_A_PASS |
| B RAID/dependencies | All four categories, attributable proposals, human dispositions, required dependency checks, Mission blockers | CP4_GATE_B_PASS |
| C Operations/specialists | Source-owned incident/Change links, engagement terms/obligations, independent acceptance, lane/capacity | CP4_GATE_C_PASS |
| D Value | Five states, baseline/measurement criteria, immutable observation, independent human acceptance/reassessment | CP4_GATE_D_PASS |
| E COMMAND | Exactly 9 TODAY + 7 PORTFOLIO + 6 ESTATE contracts, all populated, truthful quality and read-only composition | CP4_GATE_E_PASS |
| F End-to-end | All 19 synthetic operating steps, required negative suite, SQLite restart and existing NAR full-chain verification | CP4_GATE_F_PASS |

## Institutional proof

### Estate and dependencies

Estate metadata persists scoped authoritative refs, classification, lifecycle,
stewardship and evidence. It does not copy source product, service or ticket
records. Null stewardship is an explicit gap, not an inferred owner.
Relationships validate both endpoint visibility and ontology type pair under
trusted action-specific authority. They have immutable identity, CAS/history and
audited withdrawal. Required work/containment cycles are rejected; service cycles
are allowed but bounded and reported.

Existing graph traversal is extended through an opt-in port, not replaced.
Incoming impact from Service C identifies Capability B and Product A; outgoing
prerequisites separately identify External Dependency D. Connectivity is dependency
impact/correlation, not a confirmed root-cause assertion. Traversal supports
CURRENT_OPERATING, ALL_REGISTERED and HISTORICAL_AT. Retired/disappeared/stale or
denied branches make coverage incomplete; retained history is not silently erased.
Denied identifiers and hidden counts are never included in results.

### RAID and institutional work

Risk, Assumption, Issue and Dependency keep owner, source/trigger, source scale,
explicit normalization rule, priority, evidence, related refs, timestamps,
revisions and audit intent. RaidProposal is attributed provisional input only;
it cannot accept risk or clear a blocker.

Action-specific policy and assigned internal humans govern risk acceptance,
dependency waiver, assumption validation and issue resolution/closure. Finite
dispositions expire, including a waiver that was independently closed; closure
retains the original waiver expiry rather than inventing satisfied prerequisites.
Independent closure is checked against the material resolver, not merely the
original record creator. COMMAND exposes expired dispositions as incomplete, not
current acceptance. Required dependency conditions are evaluated against exact source
references and rechecked at Mission start. UNKNOWN/unmet/pending proof blocks;
graph deletion or refresh never waives the source condition.

`InstitutionalOperatingRuntime.foundation` composes existing CP3 source commands
with the additional guards. CP4 work must use this composed instance. Original
standalone CP3 consumers are deliberately not silently changed.

### Incidents, Changes and specialist engagements

OperationalLink holds references, not duplicate incident/problem/Change payloads.
Source-native incident state and affected-estate evidence remain source-owned.
Operational Change O and Deployment Change P stay independently authoritative;
no CP4 command can authorize or execute deployment.

Specialist E retains CP3 status/scope/effective interval/sponsor. Audited terms
identify the permitted Recommendation output and unresolved obligations.
Recommendations preserve producer and submitted evidence; obligation acceptance
requires the exact output's independent internal-human acceptance/criteria.
Expired, suspended or revoked engagements cannot produce new authorized work.
Hidden acceptance/evidence refs are redacted with incomplete coverage.
No procurement, contract, billing or supplier master is implemented.

Lanes connect Missions, engagement load and accountable/execution owners to coarse
planning. Declared units/windows/source confidence are retained. UNKNOWN numeric
capacity is null. Known reservations use CAS, recheck source evidence and reject
unit mismatch/overbooking; free capacity is not clipped to a false zero.
Capacity does not grant execution authority.

### Value

Benefit V begins FORECAST. Source-owned evidence and a trusted measurement adapter
produce immutable observations, preserving method/window/unit, baseline,
uncertainty and confounders. An observation alone is not realization.
Numeric realization requires baseline evidence, completed observation period,
satisfied criteria, unchanged measurement and independent authorized internal
human acceptance. Neither deployment success nor Mission completion realizes V.
Missing baseline/evidence produces UNPROVEN, not a manufactured measurement.
REJECTED is terminal for that hypothesis. REALIZED reassessment preserves the
historical realized revision and original acceptance receipt.
Hidden measurement/baseline evidence suppresses derived numeric values.

### COMMAND

All accepted contracts are implemented and tested with populated records:

| Workspace view | Contracts |
| --- | --- |
| TODAY (9) | Active missions; Pending decisions; Blocked changes; High risks; Open incidents; Human approvals; Failed controls; Active specialist engagements; Capacity constraints |
| PORTFOLIO (7) | Products; Capabilities; Health; Active changes; Risk; Dependencies; Value status |
| ESTATE (6) | Shared primitives; External dependencies; Ownership gaps; Platform health; Technical debt; Evidence status |

The projection has no source-mutation command. Returned values are detached.
Requested scope, generated time/version, source refs/scopes/revisions,
watermarks/observation times, freshness policy, error/request ID, pagination,
coverage and visibility are explicit. Reads distinguish OBSERVED, STALE,
UNAVAILABLE, ERROR, INCOMPLETE, UNKNOWN and opt-in ILLUSTRATIVE.
Source errors are reported through the existing authority failure port and produce
ERROR, not an empty success. Missing sources remain null/UNAVAILABLE, not healthy.
Illustrative/operational inputs cannot mix. Unknown capacity/benefit and restricted
or paginated counts never become zero. Complete operational zero is permissible
only from a successful authorized complete source query.

The source ports are typed projection/measurement contracts, not external
connectors. Source adapters must preserve their original field permissions,
revision/watermark and policy-owned freshness; they cannot confer authority.

## Synthetic operating scenario

The [scenario test](../../packages/institutional-intelligence/src/operating/scenario.test.ts)
uses only fictional institution I, governance org GI, H1/H2 and specialist E:

1. A depends on B.
2. B depends on C.
3. C depends on D.
4. M explicitly targets improvement to B.
5. E supplies an attributed recommendation with independent acceptance.
6. X records the management decision through existing canonical rationale.
7. O supports M through a governed operating link.
8. P remains a separately authoritative deployment reference.
9. J has a source-asserted affected-service link to C.
10. Incoming traversal identifies B/A dependency impact, not confirmed causation.
11. D remains an external dependency, separately found by outgoing traversal.
12. R1 and required Dependency D1 are raised with evidence/owner/policy condition.
13. M becomes blocked; unresolved R1/D1 deny continuation.
14. J's source restoration revision/evidence is linked; independent RAID
    disposition and verified prerequisite clear the required work blockers.
15. V stays FORECAST even when M completes.
16. Measurement/evidence records OBSERVED.
17. H2 independently accepts the exact observation/criteria.
18. V is REALIZED only after recorded proof.
19. All 22 COMMAND categories reflect the composed state without source changes.

Restart preserves estate/RAID/Mission/value history, audit intents and receipts.
External source fixtures are rehydrated independently, not persisted as a
universal source copy. Existing NAR verification validates the retained chain.
Temporary fixture databases are removed by targeted cleanup.

## Negative proof

Each result is an assertion, not an inferred absence of failure.

| # | Required failure case | Result / proof |
| --- | --- | --- |
| 1 | Cross-institution estate read | DENIED; [estate tests](../../packages/institutional-intelligence/src/operating/estate.test.ts) |
| 2 | Unauthorized graph relationship | DENIED, no edge committed; estate tests |
| 3 | Cycle traversal runaway | BOUNDED, stable cycle metadata; [directed tests](../../packages/platform-entity-graph/src/directed.test.ts) |
| 4 | Hidden-node identifier leakage | REDACTED, incomplete, no hidden count; estate tests |
| 5 | Inaccessible dependency branch | INCOMPLETE, not exhaustive impact; estate tests |
| 6 | Agent accepting risk | DENIED; [RAID tests](../../packages/institutional-intelligence/src/operating/raid.test.ts) |
| 7 | System closing material issue | DENIED; RAID tests |
| 8 | Specialist accepting own evidence | DENIED; [operations tests](../../packages/institutional-intelligence/src/operating/operations.test.ts) |
| 9 | Expired specialist contributing | DENIED at expiry boundary; operations tests |
| 10 | Unavailable incident source healthy | UNAVAILABLE/null, health UNKNOWN; operations and [COMMAND tests](../../packages/institutional-intelligence/src/operating/command.test.ts) |
| 11 | Stale source current | STALE with original observed time, unknown count; COMMAND tests |
| 12 | Missing benefit evidence REALIZED | UNPROVEN / acceptance DENIED; [value tests](../../packages/institutional-intelligence/src/operating/value.test.ts) |
| 13 | Deployment success realizes value | FORECAST retained; value tests |
| 14 | Mission completion realizes value | FORECAST retained; value/scenario tests |
| 15 | COMMAND projection mutates source | No mutation method, invalid mutation payload denied, detached result cannot change source; COMMAND tests |
| 16 | Missing owner assigned silently | REJECTED for required source ownership; estate stewardship gap remains null; RAID/COMMAND tests |
| 17 | Unknown capacity becomes zero | REJECTED fabrication, projected quantity null; operations/COMMAND tests |
| 18 | Unresolved dependency clear | MISSION_REQUIRED_RAID_UNRESOLVED; RAID/scenario tests |
| 19 | Cross-scope relationship without grant | DENIED, no edge committed; estate tests |
| 20 | Deleted/retired node disappears from history | Historical/registered ref retained; current branch incomplete; estate tests |

Additional proofs cover finite risk-disposition expiry, independent assumption
validation, incompatible type pairs, deterministic insertion order, budgets,
capacity CAS/overcommitment, hidden specialist/value evidence, immutable value
receipts, changed measurement, pending audit, source exceptions and fixture mixes.

## Existing-system preservation

Authoritative app registry/catalog, ITSM ticket/problem/event stores, operational
approval, Git/Control Plane deployment governance, SAGE/CIVIC/product-domain
systems, legacy institutional lineage/dependency engines, policy evaluator,
canonical rationale/analysis and NAR cryptography are reused or referenced, not
absorbed. No Union Eyes, financial-service, shared DB or app source was changed.
Legacy graph/ontology public behavior is preserved by additive opt-in subpaths.
No ownership label, edge, projection, successful run or rationale grants deployment.

## Validation

Scoped evidence and global audit disposition are recorded below. Repository-wide
readiness is not inferred from package tests.

| Exact command | Outcome |
| --- | --- |
| `pnpm --filter @nzila/institutional-intelligence --filter @nzila/platform-entity-graph --filter @nzila/platform-ontology --filter @nzila/platform-contracts --filter @nzila/governance-rationale --filter @nzila/decision-intelligence-engine --filter @nzila/platform-policy-engine --filter @nzila/nar test` | PASS: 41 + 19 + 23 + 74 + 7 + 20 + 16 + 8 = 208; zero failed/skipped |
| `pnpm --filter @nzila/platform-change-management --filter @nzila/itsm-core test` | PASS: 61 + 5 = 66; zero failed/skipped |
| `pnpm --filter @nzila/institutional-intelligence --filter @nzila/platform-entity-graph --filter @nzila/platform-ontology typecheck` | PASS for all three packages |
| `pnpm --filter @nzila/institutional-intelligence --filter @nzila/platform-entity-graph --filter @nzila/platform-ontology lint` | PASS for all three packages after removing one unused import |
| `pnpm deps:check` | PASS: 224 packages, zero violations |
| `pnpm platform:contract:check` | PASS: zero errors/warnings |
| `pnpm validate:docs` | PASS: 2,457 documents, zero errors, 1,204 existing warnings elsewhere; CP4 has only two informational naming notices |
| `pnpm governance:audit` | FAIL: exit 2 at unchanged financial-service typecheck; earlier stages completed |
| `git diff --check` plus new-file/local-link scope checks | PASS: 46 untracked source/docs files, 10 tracked files, 160 local links; ASCII/new-file whitespace, no DB/migration files, lockfile additions only |
| `pnpm --filter @nzila/institutional-intelligence exec vitest run src\operating\command.test.ts src\operating\value.test.ts src\operating\scenario.test.ts` | Final post-provenance/value-source-outage rerun PASS: 10 tests; then institutional typecheck and lint PASS |
| `pnpm --filter @nzila/institutional-intelligence test` | Final closure/waiver-expiry rerun PASS: 43 tests in 13 files; then institutional typecheck and lint PASS |

Total latest distinct suite coverage: **276 passed, zero failed, zero skipped**.
The final institutional rerun adds two lifecycle proofs and replaces its earlier
41-test result; latest scoped coverage is 210 tests, plus 66 unchanged Change/ITSM
tests.
CP4 contributes 25 institutional tests plus three directed-graph and three
institutional-ontology tests; the remaining tests preserve CP3/legacy behavior.
Targeted reruns are not double-counted.

Global governance fails at the same known financial-service stage/diagnostic
classes reported in CP3: unresolved `@nzila/config/tsconfig/nextjs`,
`@nzila/platform-auth/entra/verify`, `@union-claims/financial`, and two logger
`Error.cause` target-library diagnostics. Its source/configuration remains
unchanged. The prior transient raw CP3 log is no longer available for bytewise log
comparison; the failure location/classes match the persistent CP3 closeout.
Named generated ownership/index/release/repository/documentation audit outputs
were restored to pre-run bytes (the documentation reports were verified clean at
baseline and restored to their tracked original bytes).

Root monorepo lint/typecheck/test:fast were not run; this is a scoped runtime
closeout, not a pull-request review or monorepo readiness claim.

## Limitations

- Experimental Node 24 SQLite proves local transactional durability only; no
  production PostgreSQL/Drizzle adapter, migration or distributed multi-host proof.
- Identity, policy registration, Control Plane authorization, approvals, assignment
  and source adapters remain explicit synthetic trusted ports, not live wiring.
- Existing NAR cryptography runs against fictional local signing/storage. No
  production immutable cloud sink, managed secret, recovery or operations proof.
- External fixture source snapshots/measurements are fictional; no live customer
  records, production institution/identity/grant or external connector.
- Estate metadata is not a registry reconciler, CMDB or infrastructure manager.
  Source adapters own registry/catalog precedence and must report divergence.
- Specialist operations intentionally support only CP3 Recommendation outputs;
  no procurement, supplier contract system or generalized engagement workflow.
- Planning is coarse. Complete personnel availability/grant coverage, resource
  calendars and staffing/cost models remain outside this bounded mission.
- COMMAND supports current snapshots and scoped historical estate traversal,
  not arbitrary historical snapshots of all 22 source systems. Such requests fail
  explicitly. Production Console/UI integration and operator validation are not
  implemented; no dashboard/readiness badge is claimed.
- Global governance remains non-green until the separately owned financial-service
  health/typecheck limitation is resolved. No monorepo-wide acceptance claim.
- No Checkpoint 5 implementation.

## Disposition

`NZILAOS_CP4_OPERATING_RUNTIME_PASS_WITH_LIMITATIONS`

Bounded local operating semantics and required synthetic proof pass. This is not
production readiness, rollout approval or permission to merge/deploy.
