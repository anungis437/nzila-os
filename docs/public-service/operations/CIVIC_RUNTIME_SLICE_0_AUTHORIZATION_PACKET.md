# CIVIC Runtime Slice 0 Authorization Packet

**Artifact type:** Internal governance authorization record

**Packet version:** 1.0

**Prepared:** 2026-10-10

**Status:** `AUTHORIZE_WITH_CONDITIONS`; activation prerequisites supplied by human

**Executable runtime activation:** Applied after `CIVIC_SLICE_0_ACTIVATION_PASS`;
bounded proof closeout terminates execution as recorded in the
[proof disposition](CIVIC_RUNTIME_SLICE_0_PROOF.md).

**Proposed data boundary:** `SLICE_0_DATA_BOUNDARY = SYNTHETIC_ONLY`

This packet asks a human maintainer whether CIVIC may begin one bounded,
synthetic-only, non-production executable proof. Preparing, validating, or
recommending this packet does not authorize implementation. The human decision
recorded at the end was activated only after the additional human prerequisites
were supplied and the activation checkpoint passed. No signature,
institutional approval, certification, customer adoption, or deployment is implied.

## 1. Repository and isolation baseline

| Item | Verified state |
| --- | --- |
| Repository | `anungis437/nzila-os` |
| Starting SHA | `1c337567635bb86ea0df7831557d8d2d22df1e6f` |
| Branch | `civic/three-reality-hardening` |
| Worktree | `C:\APPS\nzila-os.worktrees\pasted-text-processing` |
| Pre-existing dirty file | [Three-reality reconnaissance report](three-reality-hardening-report.md), untracked; preserved unchanged |
| Other active worktrees | `C:\APPS\nzila-os` (`main`); `C:\APPS\worktrees\nzila-g2-provenance` (`g2/synthetic-health-source`) |
| Protected surfaces | All unrelated changes in other worktrees, including shared authorization/database and other products; existing reconnaissance report |
| Exact packet-path collision | None detected in checked worktrees before creation |
| This mission's writable surface | This packet only |

A future implementer must recheck HEAD, branch, worktree, dirty files, all active
worktrees and contested paths. This baseline is not a continuing lock on files.
Do not overwrite, revert, reset, amend, rebase, resolve another agent's conflicts,
or delete another agent's files, branches, worktrees or artifacts.

## 2. Current governing prohibition

The [governing contract](../../../governance/foundations/civic-oci-doctrine.contract.json)
currently has `schemaVersion = 1` and:

```json
{
  "runtimeAuthorization": {
    "authorized": false,
    "applicationRoot": "apps/civic",
    "authority": [
      "apps/civic/README.md",
      "docs/CIVIC_OCI_ALIGNMENT.md"
    ]
  }
}
```

This excerpt omits only the existing rationale; it is not an applied modification.
The [CIVIC README](../../../apps/civic/README.md) prohibits adding product code
until a pilot is scoped and approved. The
[CIVIC package](../../../apps/civic/package.json) is a private metadata placeholder.
No pilot approval is on file in this packet.

The [doctrine validator](../../../scripts/lib/civic-oci-doctrine.ts) both requires
the boolean to remain false and rejects runtime-bearing CIVIC aliases through
other applications. Its runtime scan currently returns early when the boolean is
true. Thus a boolean flip alone is neither valid under current checks nor a
safe way to express bounded permission.

The [alignment doctrine](../../CIVIC_OCI_ALIGNMENT.md) and
[CIVIC thesis](../civic-thesis.md) retain OCI as canonical methodology, with CIVIC
as the public-service front door. This proposal introduces no independent scores,
rankings, maturity bands, AI authority or changed first-touch/commercial posture.
The human-review and anti-surveillance boundaries remain mandatory.

The [completed reconnaissance](three-reality-hardening-report.md) records all
three product gates as FAIL and its executive illustration as static/synthetic.
Related SAGE source and local tests are prior art, not CIVIC authorization.
The [SAGE launch decision](proof-runs/004-sage-final-implementation-proof/15-launch-governance-decision.md)
illustrates the repository convention of separating recommendation, authorized
decision, scope, approver, date, evidence and blockers. It does not transfer
permission to CIVIC. Historical operational proofs are not current live evidence.

Before runtime work begins, a human must approve the exact scope, file surfaces,
reuse classifications, starting revision/worktree, expiry and restrictions here,
and explicitly authorize the bounded governance activation in section 8.
A request to implement, or a recommendation by an agent, is not that decision.

## 3. Proposed Slice 0 and decisions requested

### Bounded chain

Institution -> Actor / Position -> Delegated Authority -> Evidence Source ->
Evidence -> Interpretation / Finding -> Intervention -> Commitment -> Execution ->
Expected Outcome -> Observed Outcome -> Material Variance -> Decision Required ->
Authorized Human Decision.

This is one executable proof of CIVIC's governed operating model, not general
product development. Propose a local, deterministic domain/service harness with
an operator view and one executive brief, generated from the same authorized
chain. A locally exercised structured response or rendered brief is sufficient
if the maintainer selects that proof surface; public HTTP routes are not assumed.
No hosting, database migration, external identity provider, live integration or
deployment is needed.

### Human decision items

| Item | Proposed choice; not yet approved |
| --- | --- |
| Runtime boundary | Keep all Slice 0 runtime inside the existing private `apps/civic` package |
| Package boundary | No separate `packages/civic-*` package in Slice 0; a new package requires separate explicit authorization |
| Proof surface | Local domain/service harness, bounded operator read model and executive brief; no public API/UI |
| Storage | Isolated in-memory synthetic repository; test data reset per scenario; no persistence or production database |
| Identity | Inject validated fictional identity/session context; never authenticate real users in this proof |
| Temporal authority | Include effective-from, expiry and revocation checks for each consequential act |
| Governance exception | Approve section 8's scoped activation, including the exact validator/test/document surfaces |
| Duration | Maintainer must record a finite UTC expiry before activation; no indefinite authorization |
| Owners | Assign a CIVIC proof owner and confirm platform-contract reuse steward before activation; do not infer a named owner |

If a maintainer chooses another architecture or surface, revise and approve this
packet before implementation; do not silently expand the allowlist.

## 4. Three-gate purpose and operating constraints

### R-GATE - Institutional validity

`AUTHENTICATION != AUTHORIZATION != DELEGATED_INSTITUTIONAL_AUTHORITY`

Every governed object and relationship carries institution scope. Check
organization, resource, action, position/actor, instrument reference and temporal
validity on reads, references, decisions and authority use. Authentication and
ordinary role/membership do not confer institutional decision authority.
Delegation is established by explicit fictional human authority records, never
generated by an AI/system actor or inferred from an admin role.

Retain all five distinct categories: authoritative record, referenced authoritative
record, derived evidence, institutional interpretation, decision artifact.
Bind provenance to the actual source and evidence IDs, institutional owner,
record/version locator, observation/event date and human attribution where
applicable. A reference is not copied canonical truth. Derived measures and
interpretations remain labelled; source disagreements and competing interpretations
coexist with unresolved status and a later accountable human disposition.

Final decisions require both an explicitly human actor and valid delegated
authority for this institution/resource/action at the decision time. A machine
may propose or flag a gap but cannot approve, authorize, create delegation or
become the institutional decision-maker. Unknown identity kind fails closed.

### D-GATE - Operational viability

One stable kernel supports two obviously fictional institutions with different
versioned terminology, workflow labels, role labels, evidence requirements and
decision stages. Ordinary variation is configuration, not a code fork. Validate
configuration before use; no free-form rules that bypass kernel authority checks.

One operator journey must open an institutional item, explain why it exists and
who owns it, show required/missing evidence, accept manual evidence or an existing
source reference, and show the next action. Plain operator labels hide internal
ontology without hiding provenance, uncertainty or authority.

Referenced external-system metadata must work without copying source document
bytes. Fictional system and record locators must not be fetched. Include
diagnostics for invalid configuration, missing/invalid authority, incomplete
evidence, invalid workflow transition and unresolved decision requirement.
Expose intelligible errors rather than invented evidence or success-shaped
fallbacks.

The proof must measure bounded entry/reference steps and duplication, not claim
real institutional burden reduction. Local synthetic evidence is insufficient
for adoption or real-operator usability claims.

### T-GATE - Executive accountability

Use a fictional professional-services capability-gap scenario: scoped human
authorization -> intervention -> contextual commitment -> expected deliverables ->
execution/evidence -> expected/observed outcome -> material variance ->
conflicting interpretation or missing evidence -> decision required -> human
disposition. Procurement and spend are contextual evidence, not contract
management, procurement execution, invoice processing or a financial ledger.

The single executive brief answers why, authorizer, owner, authority basis,
commitment, execution, current/missing evidence, expected/observed outcomes,
material variance, competing interpretations, open risks and the next decision.
Evidence drill-down must preserve links and access boundaries. BI observations
may be fictional inputs; CIVIC's proof ends in institutional accountability and
decision context, not another generic dashboard.

## 5. Data boundary and non-scope

`SLICE_0_DATA_BOUNDARY = SYNTHETIC_ONLY`

Only obviously fictional institutions, positions, actors, authority instruments,
contracts, records, dates and measures. Use synthetic identifiers and reserved
non-routable/example locators; no real people as runtime actors or institutional
fixtures, including any people named in acceptance lenses or project discussions.
Human maintainer governance attribution is not permission to use that person as
a fictional runtime decision-maker.

Prohibited data: real government, customer, production, employee, procurement,
health or other personal records. No external institutional records, source
access, real credentials, record imports or network connector calls.

Explicitly outside scope: production deployment, external customers, live
integrations, Azure/infrastructure, deployment configuration, secrets, repository
rules/CI policy changes, procurement/ERP/HR integrations, BI or document-management
replacement, case management, autonomous approvals/decisions, production AI,
general customer administration, financial ledger, broad CIVIC navigation or
reporting, MISSION, Union Eyes, SAGE feature development, WorkAid, Cora, House
and Slice 1. All require separate authorization.

## 6. Reuse classification

These are proposed capability classifications, not current permissions. Platform
contracts are product-neutral shapes, not an identity provider, repository,
authorization engine, institutional mandate or evidence-grade audit sink.
Use only their declared subpath exports; do not import another product's services.

**Existing ownership:** the
[platform package ownership registry](../../../governance/platform-package-owners.yaml)
declares the @nzila/platform team owner of `platform-contracts`, with steward `null`.
That unassigned steward must be acknowledged/confirmed by a human, not invented.
SAGE prior art is owned by its existing product maintainers; no named code steward
was established here, and no SAGE runtime reuse is proposed.

| Capability | Classification | Source / existing owner for reuse | Boundary and semantics not inherited |
| --- | --- | --- | --- |
| Identity | `REUSE_WITH_CIVIC_ADAPTER` | [Platform identity contracts](../../../packages/platform-contracts/src/identity.ts), @nzila/platform team; steward unassigned | Fictional session shape/expiry only; not real authentication or inferred human/delegated authority; use example email only if required by shape |
| Organization/institution scope | `REUSE_AS_IS` | [Org scope schema](../../../packages/platform-contracts/src/org-scope.ts), @nzila/platform team; steward unassigned | Reuse validation shape unchanged; CIVIC still enforces scope on every object/relation; schema validation alone is not isolation |
| Membership | `REUSE_WITH_CIVIC_ADAPTER` | [Org membership schema](../../../packages/platform-contracts/src/org-scope.ts), @nzila/platform team; steward unassigned | Active fictional membership only; embedded role never grants delegated authority |
| Actor / position | `CIVIC_NEW` | CIVIC-local bounded model | Explicit human/system kind and accountable position binding; no identity-kind default |
| Role | `REUSE_WITH_CIVIC_ADAPTER` | [Role definition schema](../../../packages/platform-contracts/src/role.ts), @nzila/platform team; steward unassigned | Generic role definition only, not platform role hierarchy, admin supremacy, ITSM/TrustCore roles or decision authority |
| Delegated authority | `CIVIC_NEW` | CIVIC-local bounded model | Institution/resource/action/position scope, effective date, expiry and revocation |
| Authority instrument/source | `CIVIC_NEW` | CIVIC-local synthetic reference | Explicit institutional basis; no assertion of real legal validity |
| Evidence source | `CIVIC_NEW` | CIVIC-local source metadata | Five epistemic categories; institutional owner and source-system boundary |
| Evidence item | `CIVIC_NEW` | CIVIC-local bounded item | Manual capture or referenced metadata, with explicit missing state |
| Provenance | `CIVIC_NEW` | CIVIC-local typed links | Validated source binding/date/version; no caller annotation promoted to attestation |
| Interpretation/finding | `CIVIC_NEW` | CIVIC-local bounded interpretation | Evidence-bound, attributed, uncertain; not AI authoritative finding |
| Disagreement/conflict | `CIVIC_NEW` | CIVIC-local relation/disposition | Coexisting interpretations, unresolved status and human resolution retained |
| Intervention | `CIVIC_NEW` | CIVIC-local bounded intervention | Objective, accountable owner and prior authorization |
| Commitment | `CIVIC_NEW` | CIVIC-local contextual reference | Ceiling/deliverable/date, not ledger or procurement system |
| Execution evidence | `CIVIC_NEW` | CIVIC-local linked observation | Receipt/progress distinct from causal outcome |
| Expected outcome | `CIVIC_NEW` | CIVIC-local expected measure | Target/unit/window/authority, never overwritten by observation |
| Observed outcome | `CIVIC_NEW` | CIVIC-local observed measure | Evidence/unit/window; missing stays missing; no automatic causality |
| Variance | `CIVIC_NEW` | CIVIC-local derived assessment | Comparable measures only; configured material threshold; invalid/missing input diagnostic |
| Decision required | `CIVIC_NEW` | CIVIC-local deterministic state | Due date/variance/gaps -> requirement, not autonomous decision |
| Human decision | `CIVIC_NEW` | CIVIC-local final disposition | Human plus explicit delegation, immutable decision/evidence/authority links |
| Audit event | `REUSE_WITH_CIVIC_ADAPTER` | [Platform audit schema](../../../packages/platform-contracts/src/audit-event.ts), @nzila/platform team; steward unassigned | Event envelope with CIVIC action/resource IDs and safe payload; no production sink; `evidenceGrade=false` unless separately proven |
| Institutional configuration | `CIVIC_NEW` | CIVIC-local versioned configuration | Two fictional institutions, kernel invariants cannot be overridden |
| Executive brief | `CIVIC_NEW` | CIVIC-local authorized read model | Bounded decision brief, not a dashboard or unrestricted evidence export |
| Live identity, persistent database, network connector, production audit sink | `DEFER` | None proposed | Not needed for local synthetic proof; separate authorization required |
| SAGE/other-product runtime semantics and shared-product refactors | `NOT_AUTHORIZED` | Read-only prior art only | No SAGE imports, migrations, roles, lifecycle or route composition inherited |

**Counts:** `REUSE_AS_IS` 1; `REUSE_WITH_CIVIC_ADAPTER` 4;
`CIVIC_NEW` 18; `DEFER` 1; `NOT_AUTHORIZED` 1. Total: 25 capability rows.
`CIVIC_NEW` means missing bounded domain semantics, not permission for 18 new
subsystems. Coalesce them into the smallest coherent model/service slice.

Prior art inspected: [SAGE types](../../../packages/sage-core/src/types.ts),
[access model](../../../packages/sage-core/src/access-model.ts),
[decision service](../../../packages/sage-core/src/services.ts) and
[claim chain](../../../packages/sage-core/src/claim-chain.ts). They illustrate
membership/role separation, human checks and evidence links, but their source
access categories are not CIVIC epistemic categories, and their claim annotations
do not prove institutional attestation. Reuse concepts, not product semantics.
The platform [evidence export contract](../../../packages/platform-contracts/src/evidence.ts)
describes export packs, not institutional source authority; it is not substituted
for the missing CIVIC domain.

## 7. Future permitted file surfaces (proposal only)

| Class | Exact bounded proposal |
| --- | --- |
| Writable CIVIC runtime | New files under `apps/civic/src`, `apps/civic/tests`, `apps/civic/fixtures`; local test/configuration/brief harness only |
| Writable CIVIC package support | `apps/civic/package.json`, `apps/civic/README.md`, local `apps/civic/tsconfig.json` and `apps/civic/vitest.config.ts`; no deploy/build-to-production scripts |
| Writable proof documentation | This packet and one future `docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md` |
| Bounded governance activation, only if explicitly approved | [Doctrine contract](../../../governance/foundations/civic-oci-doctrine.contract.json), [validator implementation](../../../scripts/lib/civic-oci-doctrine.ts), [doctrine tests](../../../tooling/contract-tests/civic-oci-doctrine-integrity.test.ts), and [integrity documentation](../../oci/CIVIC_OCI_DOCTRINE_INTEGRITY.md); only section 8's fail-closed scoped exception |
| Read-only reusable modules | Platform-contracts identity, org-scope, role and audit-event exported subpaths listed in section 6 |
| Read-only prior art | SAGE source/tests, platform/shared primitives, governance references, existing reconnaissance report |
| Prohibited | Every other product/runtime, shared database/migrations, infrastructure/deployment/secrets, CI/repository policy, public first-touch docs, portfolio lifecycle metadata, unrelated shared packages |

No new shared package or top-level workspace/test registration is presumed.
Invoke local tests with existing runners and package selectors/configs. If package
installation would require a root lockfile/workspace change, stop and obtain an
explicit allowlist amendment; do not silently alter shared surfaces. Existing
package ownership/adoption gates must still pass, not be disabled.

## 8. Smallest safe contract activation - APPLIED WITH BOUNDED CLOSEOUT

Keep `runtimeAuthorization.authorized = false` for general runtime. Preserve the
canonical `applicationRoot`. Applied `schemaVersion: 1 -> 2` and one optional
`runtimeAuthorization.slice0` object. Absence, disabled state, malformed fields,
pending decision or invalid dates must leave the current prohibition in force.

Approved activation field values:

| Field under `runtimeAuthorization.slice0` | Approved activation value / meaning |
| --- | --- |
| `enabled` | `true` only after explicit human activation; absent/false denies |
| `scope` | `"synthetic-runtime-slice-0"` |
| `decisionArtifact` | `"docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md"` |
| `startingSha` | `1c337567635bb86ea0df7831557d8d2d22df1e6f`, explicitly approved in the recorded human decision |
| `branch` / `worktree` | `civic/three-reality-hardening` / `C:\APPS\nzila-os.worktrees\pasted-text-processing`, explicitly approved and bound by the guard |
| `effectiveAt` / `expiresAt` | `2026-10-10T16:17:50Z` / `2026-10-17T16:17:50Z`; validity is effectiveAt <= now < expiresAt |
| `revokedAt` | `null` at activation; a revocation immediately denies |
| `dataBoundary` | `"SYNTHETIC_ONLY"` |
| `production` / `deployment` / `slice1` | All `false` |
| `runtimeRoot` | `"apps/civic"` |
| `writablePaths` | Exact section 7 allowlist, including the four bounded governance activation files if approved |
| `sharedReuse` | Only the four platform-contract exported modules in section 6 |

Adding this object does not itself authorize execution. The canonical human
decision at the end of this packet must be an allowed approving value, with
maintainer/date/conditions/SHA/branch/worktree completed by the human. Conditions
must explicitly approve the expiry, proposed proof surface, reuse and activation
allowlist. Missing or conflicting human/contract conditions require STOP.

The required narrowly coupled validator change must:

1. Preserve legacy schema-v1 false behavior, all constitutional checks and
   unapproved-runtime rejection; reject general `authorized=true`.
2. Recognize only this bounded schema-v2 exception after checking the completed
   human decision, scope, isolation context, allowlist, data/non-production flags,
   effective/expiry/revocation and approved starting SHA. Record the approved
   baseline as immutable; later mission commits must descend from it on the
   approved branch, not replace it with a guessed current SHA.
3. Remove the authorization-based scan bypass: scan runtime roots/aliases even
   with an enabled exception; reject runtime outside the approved CIVIC root,
   public/deployment artifacts, disallowed imports and unsupported exception fields.
4. Verify synthetic fixture declarations and forbid live connector/provider
   composition; runtime entrypoints must enforce the same boundary. Static
   allowlists cannot prove that arbitrary data is synthetic, so tests and runtime
   constraints are also required.
5. Add tests for absent/pending/malformed/wrong-scope/wrong-context/expired/revoked
   exception; retain existing false-state rejection, OCI/human/AI/anti-surveillance
   tests and cross-app alias tests; add one valid local Slice 0 exception case.

Do not simply delete the hard-coded-false assertion or flip the boolean and let
the existing early return skip scans. This is a scope-enforcement transition
requiring explicit human approval, not relaxation of general runtime governance.
An unapproved requirement for extra schema/platform refactoring is a stop condition.

Permission ends at the earliest of expiry, revocation, any stop condition, or
completion of the bounded proof and final disposition. Recording the final proof
does not grant ongoing feature development. The code may remain on the isolated
branch for review; running or expanding it outside approved conditions is denied.
No automatic renewal, production activation or Slice 1 transition.

Closeout uses the explicit termination marker in the approved proof surface.
The runtime guard rejects that marker before any kernel operation. The static
validator separately permits archival inspection of the exact human-approved
source after termination, while continuing all scope/import/alias scans and
decision/contract/isolation checks. Static validation PASS is not execution
permission. Both working-tree paths and committed changes since the approved
baseline are checked; no general authorization boolean is enabled.

The existing placeholder README must be changed only in the approved activation
to distinguish an authorized local synthetic exception from a scoped real pilot.
Do not claim a pilot exists. Public doctrine, portfolio hold/incubating posture
and frozen OCI method remain unchanged.

## 9. Termination and rollback

Return `CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED` immediately if:

- Institution/resource isolation cannot be proven.
- Authorization checks would need weakening or cannot enforce packet conditions.
- Final human authority cannot be preserved.
- Shared/cross-product semantics require unauthorized modification.
- Real data, live access, deployment or infrastructure becomes necessary.
- Another agent owns a required contested surface.
- Scope, package architecture, file surfaces or dependencies exceed approval.
- Authorization is absent, pending, ambiguous, expired or revoked.

Do not workaround a stop condition. Preserve exact evidence and request a human
decision rather than resolving another agent's conflicts.

Rollback is bounded and human-controlled: stop execution, disable/revoke the
Slice 0 exception, and remove/revert only mission-owned CIVIC source/tests/fixtures,
local package support and scoped activation changes back to their recorded base.
Retain the authorization/proof records for provenance, including revocation.
Use reviewed path-scoped changes or dedicated revert commits, not destructive
reset, broad deletion, branch/worktree deletion or reverting other agents' work.
No production migration, data restoration, cloud teardown or deployment rollback
should be necessary. If it is necessary, this scope was exceeded and STOP applies.

## 10. Required executable proof and acceptance

All gates start `NOT_TESTED` for future Slice 0. Documentation, mock screenshots,
source presence and historical SAGE tests cannot make a gate PASS. Label local
executed proof, static inspection and synthetic data distinctly. This permission
would authorize proof execution, not certification, adoption or launch.

| Gate | Measurable proof required |
| --- | --- |
| R | Cross-institution/resource access and links rejected; authentication/membership alone cannot decide; explicit scoped delegation succeeds; future/expired/revoked authority denied; AI/system/unknown-kind final decisions and delegation creation denied; all source categories and bound provenance retained; derived never canonical; conflicting interpretations and accountable later disposition preserved |
| D | Two different fictional configurations run the same kernel; invalid/contradictory configuration and invalid transitions fail with actionable diagnostics; full operator journey succeeds; missing evidence identified; manual capture and reference-only metadata both accepted without mandatory document copy; record comparable entry/reference steps and duplicate fields, with no real burden claim |
| T | Complete synthetic chain reconstructed; explicit owner/authority/commitment/evidence links; expected and observed measures distinct with comparable units/windows; explicit material variance and threshold; absent observations/spend/deliverables remain absent; interpretations/risks visible; deterministic `DECISION_REQUIRED`; only authorized human can make final disposition |

Proposed fixture: two fictional institutions, no real people. The main chain uses
a fictional CAD 80,000 ceiling, four expected deliverables with three received,
a target of 10 working days and observed 14 for the same period. Variance is
+4 days (40% above target), material when greater than 2 days. Test the exact
threshold boundary, missing/incomparable observations and review-due transitions.
Keep actual spend and final deliverable missing, and two competing explanations
unresolved. A final decision may request more evidence or change the bounded
intervention; it must not fabricate those gaps or resolve disagreement by omission.

Execute one acceptance scenario:

configuration -> scoped human authority -> authorized intervention -> contextual
commitment -> manual/reference evidence -> execution -> expected/observed outcome ->
variance -> disagreement/missing evidence -> executive brief -> decision required ->
authorized human disposition.

Replay final disposition with an unauthorized human, another institution and a
machine actor; all must fail without mutation or cross-scope disclosure. Evidence
links, missing evidence and competing interpretation must remain intact afterward.
Capture test IDs, exact commands/results, approved base/ending SHA, branch,
fixture/config versions, timestamps and safe diagnostics in the future proof
record. No real identities, credentials or sensitive payloads in logs.

Validation sequence: narrow domain tests -> service/boundary tests -> local
runtime harness -> three-gate acceptance -> relevant regression -> typecheck ->
lint -> scoped governance tests/validator -> docs checks. Run API/browser tests
only if that surface is explicitly authorized. Distinguish pre-existing, caused
and environment failures; do not fix unrelated failures.

Existing pre-PR repository checks remain applicable if PR review is requested:
`pnpm lint`, `pnpm typecheck`, `pnpm test:fast`, `pnpm validate:docs`,
`pnpm governance:audit`. Do not suppress a gate or claim unrun commands passed.
Record skipped/unavailable checks and limit the disposition accordingly.

All three independent gates must PASS with their required evidence before
`CIVIC_RUNTIME_SLICE_0_ACCEPTED`. Otherwise use PASS_WITH_LIMITATIONS, FAILED or
BLOCKED accurately. Even accepted Slice 0 ends with
`CIVIC_SLICE_1_REQUIRES_SEPARATE_AUTHORIZATION`.

## 11. Risk register

| Risk | Impact | Mitigation | Stop trigger |
| --- | --- | --- | --- |
| Accidental SAGE/CIVIC coupling | Imports inherit another product's lifecycle and authority | Product-neutral subpaths only; SAGE read-only prior art | SAGE runtime/modification becomes required |
| CIVIC becomes system of record | Referenced evidence promoted to canonical institutional truth | Source categories, owner/version locators, reference-only path | Real record custody/connector becomes necessary |
| Ontology leaks into operator UX | Operator burden/confusion | Plain why/owner/evidence/next-action labels and bounded journey test | Journey cannot be completed within bounded proof |
| Administrative burden expansion | New reporting/duplicate entry | Compare manual/reference steps; no mandatory copied documents | Required duplicate source entry cannot be removed within scope |
| Authority reduced to RBAC | Authenticated admin makes institutionally invalid decision | Independent delegation and instrument/resource/time validation | Role alone must authorize consequential act |
| AI authority creep | Machine acquires final decision power | Explicit actor kind, human-plus-delegation gate and negative tests | Human boundary cannot be enforced |
| False certainty on conflict | Minority evidence lost | Coexisting linked interpretations, unresolved status and human resolution record | Conflict must be collapsed to proceed |
| Executive surface becomes BI | Counts/metrics replace accountability | Brief ends in authority, evidence, risks and next human decision | Reporting suite needed instead of bounded brief |
| Bespoke configuration | Customer-specific forks | Two configs, same kernel; no invariant overrides | Config requires unapproved code fork/refactor |
| Cross-agent collision | Other work overwritten | Recheck worktrees and protected paths before edits | Contested required file |
| Slice 0 scope creep | General product, production or Slice 1 work | Finite allowlist/expiry, no deployment, separate authorization | Any non-scope requirement |
| Unsafe governance exception | Boolean bypass opens unrestricted runtime | Scoped schema-v2 exception, no scan bypass, expiry/revocation tests | Checks cannot enforce bounded exception |
| Unassigned shared steward | Reuse assumptions lack accountable ownership | Human confirms platform-contract reuse/steward | Ownership dispute or shared edits required |
| Proof overclaim | Local fictional tests presented as adoption/readiness | Explicit synthetic/local labels and gate evidence ledger | Required external/real proof demanded by this slice |

## 12. Packet validation and non-binding recommendation

This packet is the only new file created by this mission. No contract/validator,
runtime source, runtime schema, migration, SAGE code, dependency manifest, public
copy, infrastructure or production data was changed.

| Preparation check | Evidence |
| --- | --- |
| `pnpm exec vitest run --project contract-tests tooling\contract-tests\civic-oci-doctrine-integrity.test.ts` | PASS: 17 tests; unrelated workspace base-tsconfig resolution warnings emitted |
| `pnpm exec tsx scripts\validate-civic-oci-doctrine.ts` | PASS: current constitutional invariants and runtime prohibition intact |
| Existing `runDocConsistency` via read-only `pnpm exec tsx -e` | PASS after clarifying team references: 2,449 documents scanned, zero repository errors; packet has zero errors/warnings and three informational literal repository-path naming findings |
| `git diff --no-index --check -- NUL docs\public-service\operations\CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md` | No whitespace diagnostics after removing five Markdown hard-break spaces; no-index exit 1 denotes the new file differs from NUL; line-ending normalization notice only |
| Read-only structural assertions via Node during preparation | PASS at packet preparation: 25 reuse rows/counts and then-pending human fields; schema was v1. Human decision and schema-v2 bounded activation were subsequently recorded; general runtime authorization remains false |
| Isolation/status checks | Only this new packet added in this mission; starting SHA unchanged; prior report preserved; no collision detected on exact packet path |

These checks validate preparation and preservation of the current boundary only;
they do not validate or activate the proposed exception. Typecheck, lint, full
test suites and broad governance audit are not applicable to this documentation-only
packet preparation; no PR review requested. The exact docs CLI is not invoked
because it rewrites shared reports; the same exported auditor is run read-only.

Exact read-only documentation command:

```powershell
pnpm exec tsx -e 'import { runDocConsistency } from "./packages/platform-validation/src/doc-consistency.ts"; const r = runDocConsistency(process.cwd()); const packet = r.findings.filter(f => f.file.endsWith("CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md")); console.log(JSON.stringify({filesScanned:r.filesScanned,repositorySeverity:r.findingsBySeverity,packetFindings:packet},null,2)); process.exitCode = packet.some(f => f.severity === "error" || f.severity === "warning") ? 1 : 0;'
```

`AGENT_RECOMMENDATION = AUTHORIZE_WITH_CONDITIONS`

Reasons: reconnaissance identifies a bounded missing institutional chain; shared
shape reuse can remain product-neutral; local synthetic proof needs no production
data, migrations or deployment. Conditions: approve section 3's decision items,
section 7's exact surfaces and section 8's scoped enforcement transition; assign
proof/reuse accountability; specify finite dates and approved starting context;
preserve all constitutional boundaries and require independent R/D/T runtime proof.
If the enforcement transition or steward/ownership cannot be approved, do not
activate. This recommendation is non-binding and does not fill human fields.

## MAINTAINER DECISION
**Decision:** `AUTHORIZE_WITH_CONDITIONS`

Permitted future values:

- `AUTHORIZE_CIVIC_RUNTIME_SLICE_0`
- `AUTHORIZE_WITH_CONDITIONS`
- `DO_NOT_AUTHORIZE`
**Maintainer:** Aubert Nungisa

**Decision date:** 2026-10-10

**Conditions:** Explicit human decision supplied in the active mission on
2026-10-10; recorded by the agent, not made by the agent:

- Only the section 3 bounded Runtime Slice 0 chain is authorized, to prove
  institutional validity, operational viability and executive accountability.
  This is not general CIVIC runtime permission.
- `SLICE_0_DATA_BOUNDARY = SYNTHETIC_ONLY`; no production, government, customer,
  personal, employee, real procurement, health or external institutional records;
  no real people as runtime fixtures.
- Use only section 7's approved narrow CIVIC surfaces and section 6's classified
  product-neutral reuse. SAGE remains `READ_ONLY_PRIOR_ART`; no SAGE changes or
  inherited product semantics. Any extra surface requires
  `STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED`.
- Activate only a scoped, fail-closed, synthetic-only, non-production, revocable,
  finite/expiring mechanism. Preserve runtime scanning; no unrestricted boolean,
  bypass, deployment, live integration, autonomous decision or Slice 1 permission.
- Preserve `AUTHENTICATION != AUTHORIZATION != DELEGATED_INSTITUTIONAL_AUTHORITY`.
  An explicit authorized human is required for final disposition; AI/system actors
  cannot approve, authorize, create delegation or make final institutional decisions.
- R-GATE requires executed proof of institution/resource isolation, explicit scoped
  authority, unauthorized/machine rejection, provenance, source-authority
  distinctions, and competing evidence/interpretation preservation.
- D-GATE requires executed proof of one kernel, two synthetic configurations,
  no ordinary code fork, a bounded operator journey, reference-only evidence,
  honest missing-evidence states, safe configuration failure and usable diagnostics.
  Burden reduction remains `NOT_YET_VALIDATED_WITH_REAL_USERS`.
- T-GATE requires the full executable synthetic professional-services chain and
  one bounded decision brief showing why, authority, commitment, execution,
  current/missing evidence, expected/observed outcome, material variance and next
  decision. CIVIC must not become the system of record for referenced records.
- Preserve authoritative record, referenced authoritative record, derived evidence,
  interpretation and decision artifact distinctions. Retain competing evidence,
  competing interpretations, unresolved disagreement and accountable disposition.
- All section 5 non-scope restrictions remain: no production/deployment/publishing,
  infrastructure/Azure, live connectors, external customers, procurement/ERP/HR
  integration, production AI/autonomous approval, BI/document/case-management
  replacement, other-product work or Slice 1.
- Protect other agents and worktrees. A contested required surface means
  `CIVIC_SLICE_0_BLOCKED_BY_CROSS_AGENT_COLLISION`; do not overwrite or work around it.
- Stop with `CIVIC_RUNTIME_SLICE_0_STOP_REQUIRED` if isolation or human authority
  cannot be preserved, governance needs a broad bypass, real data/infrastructure
  or unauthorized shared changes become necessary, scope expands, or SAGE
  semantics must be inherited.
- Acceptance requires independent R/D/T PASS with executable evidence. Do not
  relabel failed gates as limitations. Authorization ends with Slice 0 proof;
  `CIVIC_SLICE_1_REQUIRES_SEPARATE_AUTHORIZATION`.
- Record the decision first, then bounded activation and fail-closed tests.
  Return the activation checkpoint before material runtime implementation.

**Activation completion:** Explicit human approval supplied on 2026-10-10:

**Effective:** `2026-10-10T16:17:50Z`

**Expires:** `2026-10-17T16:17:50Z`

**CIVIC Slice 0 Proof Owner:** Aubert Nungisa

The proof owner confirms scope, reviews independent R/D/T dispositions, rejects
overclaims, confirms synthetic-only restrictions and decides evidence sufficiency.
Ownership does not bypass controls. Expiry fails closed; no automatic renewal.

**Platform-contract reuse accountability:** Human maintainer approves exactly
section 6's classifications: unchanged product-neutral shapes for REUSE_AS_IS,
CIVIC-local adapters for REUSE_WITH_CIVIC_ADAPTER, CIVIC-owned semantics otherwise.
Shared contracts may not be modified for CIVIC without separate approval. SAGE
remains read-only prior art, not a dependency. Broader shared changes require
`STOP_AND_REPORT_SCOPE_EXTENSION_REQUIRED`. This does not appoint a global
platform-contract steward or change the ownership registry.

Only the minimum scoped governance activation is approved. A clean activation
checkpoint is required before material runtime implementation. No deployment,
merge, general runtime authorization or Slice 1 is approved.

**Authorized starting SHA:** `1c337567635bb86ea0df7831557d8d2d22df1e6f`

**Authorized branch/worktree:** `civic/three-reality-hardening` /
`C:\APPS\nzila-os.worktrees\pasted-text-processing` (existing isolated CIVIC worktree)
