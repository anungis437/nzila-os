# Tool Fabric convergence candidate

## Context map and reviewed boundaries

| Files | Purpose | Reconciliation |
| --- | --- | --- |
| `packages/tool-fabric/src/{authority,governance,gate,policy,types}.ts` | Identity, decision binding, policy boundary | Require independently authenticated host context; bounded full-scope v2 approval; no execution or installation |
| `packages/tool-fabric/src/{ledger,registry,drift,audit}.ts` | Trust mutations, persistence, provenance, audit | Atomic expected-revision contract, actor authorization, immutable records, material metadata drift, minimal audit |
| `packages/tool-fabric/src/{providers,skill,harness}.ts` | External discovery and review lifecycle | Bounded untrusted ingestion, no tool installation or invocation |
| `packages/audit/src/*` | Shared canonical audit integrity | Reconcile #938 v2 and legacy partial verification without a rollout authorization |
| `packages/platform-integrations/src/audit-hooks.test.ts` | Existing audit consumer | Shared-audit regression coverage |
| `vitest.config.ts`, `pnpm-lock.yaml`, package governance/inventory | Workspace integration | Register the package, reconcile dependencies onto current main, regenerate inventory |
| `.lefthook-local.yml` | Tracked temporary hook override | Remove the baseline override that skipped staged secret scanning and the pre-push contract gate; retain canonical `lefthook.yml` unchanged |

Direct dependencies are `@nzila/audit`, Zod and Node crypto. Test-only
authority/verifier fixtures stay outside production exports. Existing
`tools-runtime`, doctrine-enforcement, platform-auth, os-core logger and ai-core
are regression consumers/reference patterns, not new execution entry points.
No canonical authenticated fleet binding or approved production atomic trust
store is established by this candidate.

The context map is reviewed against the A-L mandate: no database migration,
no application integration, no new fleet registry, no interpreter or broker.
Public policy contracts intentionally tighten relative to unmerged #937.
Tests include original Phase 1/2 regressions plus adversarial convergence,
atomic-store contract and shared-audit mixed-chain tests.

## Exact-source dependency graph

```text
main ede980d62959f91517b6c805787cb031d60fd420
  + #936 eb94efa32ab74acb2a2ba2ab96c46149d5ccfb31
    + #937 b514d693ff1c5688c0284eae7f3f6ef121ad3c0a
  + #938 f78368ce02e59fdc79884c767213406ba444ddf0 (reviewable audit integration)
  = fix/tool-fabric-single-pass-convergence (integration-only candidate)

#935 42167333ff07d9b5c8507f2da0bb170dd8cb8f7a: compatibility, NOT imported
#922 d3b63cd92f06c734ffb8c41b2c8dc48e65d6f0c6: privacy HOLD, Phase 3 CLOSED
#925: closed superseded predecessor, NOT imported
```

The common base of main and Tool Fabric is `1c337567635bb86ea0df7831557d8d2d22df1e6f`;
main is 14 commits ahead. Only the new Tool Fabric package/documents and the
audit dependency paths are imported; upstream inventory/lockfile snapshots
are not overlaid. Original branches remain untouched. Main branch protection
was queried live; absence of configured required checks does not waive the
repository's documented validation or human authorization.

## Operational boundary

```text
UNTRUSTED request / provider text
  -> bounded strict schema
TRUSTED HOST (deny-only adapter until independently proven)
  -> authenticated subject + organization + mission + issuance/revocation
  -> authority resolution and scoped grant
  -> atomic trust snapshot + current governance verification
  -> exact digest/command/effect + complete v2 intent binding
  -> lexical resource policy + data-minimal audit
  -> policy eligibility ONLY
  -X-> installation CLOSED / execution CLOSED

FUTURE HOST EVIDENCE REQUIRED, not implemented here:
measured pinned executable; atomic approval-consumption lease; durable trust
and audit transaction; OS realpath/reparse confinement; immutable filesystem
and network sandbox; no PATH, loader, proxy or child-process escape; enforced
CPU/memory/disk/output/process/time budgets; bounded vault-reference access.
```

## Qualification and acceptance

### A-L acceptance matrix

All tests below are local repository tests, not staging or production evidence.
The source-qualified receipts and reconciliation manifest accompany this report.

- [Machine-readable acceptance matrix](./TOOL_FABRIC_CONVERGENCE_ACCEPTANCE.json)
- [File-by-file reconciliation and source hashes](./TOOL_FABRIC_CONVERGENCE_RECONCILIATION.json)
- [Validation dossier: commands, exits, source identities and independent gates](./TOOL_FABRIC_CONVERGENCE_VALIDATION.json)

| ID | Implemented control / evidence | Disposition | External evidence owner |
| --- | --- | --- | --- |
| A | Independent runtime-branded host identity; exact subject/org/mission/invocation/authority binding; spoof, expiry, revocation and cross-mission tests in `convergence.test.ts` and `phase2.test.ts` | DENY_ONLY production adapter | Fleet/platform-auth maintainers: canonical authenticated fleet/mission authority |
| B | Strict installation schema; agent, forged installer kind, malformed input and forged approvals deny in foundation/Phase 2 tests | Installation CLOSED, not authenticated installer implementation | Platform governance: separate installer attestation, target environment and grant |
| C | Exactly one command, mandatory declared effects, effective union, destructive/credential/publication risk floors; C00-C02 | Policy contract tested | Tool reviewers: measured binary behavior, not descriptor assertions |
| D | Entire bounded canonical v2 request hash; each security field mutation, distinct approval participants, nonce/expiry, downgrade rejection; D01-D04 and replay gate regression | Atomic lease interface denies; execution CLOSED | Broker/storage owners: durable consumption transaction tied to trust revision and measured invocation |
| E | Fresh scoped verified decisions, stable content re-verification, revocation/rebinding checks, mutation actor/role contracts, author/reviewer/approver separation; Phase 2 and atomic ledger tests | Host authorization contract only | Governance/fleet owners: real role entitlements, delegation/revocation and observer source evidence |
| F | Requested filesystem/output scope intersects BOTH grant and mission roots; Windows/POSIX lexical escape denial; CPU/memory/disk/output/process/time bounds; F01-F02 | Lexical policy tested; physical containment UNVERIFIED | Broker/SRE: realpath, symlink/junction/reparse, creation/rename race, cancellation and cleanup proofs |
| G | All network paths deny; wrappers/interpreters denied; explicit per-tool environment values, bounded secret references and forced provider analytics opt-out; G01 and foundation regressions | Runtime network/process/sandbox HOLD | Broker/security: redirect, DNS rebinding, proxy, child process, loader and vault enforcement |
| H | Pinned digest, immutable returned trust records, security-significant identity/license/source/commands/effects/capability drift suspends until verified reaffirmation; H and Phase 2 drift tests | Policy contract tested | Supply-chain owners: installed artifact measurement, signed provenance and upstream observer |
| I | Coherent snapshot, revision/count/head integrity, atomic expected-head append, stale writer/fork/tamper/truncation/restart simulation, host-authorized mutation; 35 atomic contract tests | CONTRACT_ONLY; memory adapter is not durable | Storage/SRE: approved durable adapter, crash recovery, backup/restore and concurrency proofs |
| J | Shared canonical audit v2, nested tamper coverage, legacy `LEGACY_PARTIAL`, version/downgrade rejection, payload snapshot and CSV/JSON round trips; 50 audit tests and consumer regression | Local compatibility tested; rollout HOLD | Audit maintainers: exact-source #938 review, marker persistence, legacy custody and live writer/reader rollout |
| K | Main-based integration, existing shared `AuditStore` interface preserved; current-main logger/AI/tools/doctrine/audit consumers tested; exact #935 interfaces inspected without domain import | Interface mapping reviewed; integration and independent #935 approval remain HOLD | Restricted-data security/privacy maintainers; CIVITAS Phase 3 CLOSED |
| L | Bounded discovery/skill schemas, untrusted text carries `authority: NONE`, generated harness remains candidate and needs full independent trust evidence; original lifecycle/skill tests and L01 | Discovery-only domain model; no provider installed/invoked | Provider/governance owners: per-artifact license, dependency/SBOM and review evidence |

The `HarnessLifecycle` model is planning state, not a trusted authorizer or generator.
Its `PrincipalRef` inputs are not production authentication. Completing its review
cannot mint a governance decision, modify the trust ledger, install or execute anything.
All in-process adapters and clocks are host configuration; runtime branding protects
against forged data, not hostile code already executing inside the process.

### Final-mission security and dependency review

The read-only adversarial review examined candidate HEAD
`c1564ffde70e47eb6a047c9ab0b205ae66b81bcf`, tree
`3a25fe689cf1115ca99391f91b9c3ce9991815c7`, against main
`ede980d62959f91517b6c805787cb031d60fd420`. It covered the Tool Fabric
production boundary, selected convergence/atomic tests, and shared audit v2
production changes and nested-integrity tests. No security vulnerability was
identified in those changes. This is static AI review, not test execution,
authorized human security acceptance, or a durable/runtime certification.
Trusted host adapters, clocks and dependency injection are not request data;
hostile code already running inside that process is outside this contract.

The exact Restricted-data branch inspected is #935 at
`42167333ff07d9b5c8507f2da0bb170dd8cb8f7a`. This is a compatibility mapping,
not an import, merge, vulnerability audit, or claim that its controls are
available in the candidate:

| Surface | Inspected contract | Required future integration / present disposition |
| --- | --- | --- |
| Classification and authorization | `classifyRecord`, explicit Restricted tier, scoped `grantRestrictedAccess` / `readRestrictedRecord` | Tool policy eligibility is not permission to disclose a record; the host must evaluate classification, purpose and authorization basis separately. No Restricted operation is wired here. |
| Principal isolation | Read/grant scope includes organization, principal, actor and action; `fleetMemberHasImplicitRestrictedAccess` always returns false | Bind principal separately from organization/mission. Do not translate fleet membership, a capability or a tool grant into Restricted access. |
| Safe logging and audit | `bodiesSafeForPersistence`, logger redaction, `buildRestrictedAuditEvent` with raw snapshots dropped and required metadata | Tool Fabric already omits raw arguments/environment/secret references and uses shared audit v2. It does not yet emit the separate Restricted category/purpose/principal authorization event. Preserve both independent contracts before future data access. |
| Secret references | `rejectSecretIngestion` rejects high-confidence secret material | Reference syntax and policy grants are not vault authority. A trusted host must resolve only approved, principal-scoped references without persisting values. No secret retrieval exists here. |
| CIVITAS | `CIVITAS_PLATFORM_CONTRACT.phase3` is `CLOSED`; a new privacy disposition is required after platform integration | Advisory material cannot grant filing, payment, signing, deployment or personal-data authority. Phase 3 stays CLOSED. |
| Shared packages | #935 modifies current-main `ai-core` logging and `os-core` redaction, not Tool Fabric or shared audit v2 paths | Preserve its independent review gate; current-main consumer regressions do not certify the unmerged #935 changes together. |

Existing `platform-auth` provides human/service identity and authorization
primitives; `platform-agent-workflows` models workflows/recommendations, and
`platform-ai-governance` models AI governance records. Those inspected entry
points do not establish the canonical authenticated agent/mission/capability
binding required by `InvocationAuthenticator` and `AgentAuthorityResolver`.
The integration route is host-owned authentication followed by the canonical
authority lookup, never a Tool-Fabric-local fleet registry. Default adapters
therefore remain deny-only.

Resource requests bind lifetime, CPU, memory, disk, output and process count.
There is no running tool process to cancel or clean up in this candidate.
Before any broker authorization, its host contract and independent evidence
must additionally prove authenticated cancellation, termination of all process
descendants, lease/revocation coordination, cleanup of temporary files and
partial outputs, and auditable cleanup failure handling. Neither a timeout nor
the request's numeric ceilings prove these runtime guarantees. Physical
filesystem, network, environment and vault enforcement remain prerequisites,
as do a production durable trust adapter and atomic approval consumption.

Final-mission hook inspection also found a tracked baseline
`.lefthook-local.yml` (blob `a853d4a40a8c95fbc2f2d599f55d720832b6a3d4`,
introduced in `71738e75b`) that disabled staged Gitleaks and pre-push contracts.
The candidate removes this obsolete temporary override rather than relying on
it to publish. Canonical `lefthook.yml` is unchanged. Earlier commit-hook logs
with `gitleaks (skip) by condition` are not secret-scan passes; separate scanner
receipts remain the evidence for those deltas. Enabling the gate does not clear
expired-exception gates, resolve historical scanner findings or supply human
approval. Historical full-scan findings do not predict a range-scoped PR scan.

### Prior local qualification cycle (historical evidence)

The implementation is committed as `0637b7793359c2e63ac3af1f076e92ae75eabf69`
(tree `578d82a3fa00ca183869a64d2ced44d92eea32ad`) through normal pre-commit
invocation. Its log records the baseline override skipping Gitleaks; the final
mission removes that override as described above. Staged ESLint, affected
typecheck (11 tasks), brand leakage, Markdown links and inventory checks passed.
Standalone staged/delta secret scans have separate receipts; they are not proof
that the skipped hook ran.

Verified local results:

- Tool Fabric: 162 tests passed; shared audit: 50 tests passed.
- Current-main core consumers: 943 passed and one existing skipped;
  doctrine: 12 passed; audit hooks: two passed.
- Related executable-typecheck-universe contract: 21 tests passed.
  The new package legitimately changes that universe from 232 to 233; its
  inclusion is explicitly asserted. The original 232 assertion passes on main.
- Changed-package typecheck and lint passed.
- Repository lint passed all 172 tasks; documentation validation,
  dependency boundaries and release-reference policy passed.
- Aggregate `governance:audit` passed after using the supported
  `VITEST_MAX_WORKERS=1` environment setting, without changing any timeout,
  test source or exclusion. Earlier resource-sensitive failures were not waived.
- Both staged files and the entire committed convergence delta passed Gitleaks.
  Full historical secret scanning did not complete and is not represented as clean.

**Full qualification is NOT complete.** Repository-wide typecheck, fast tests
and all 292 architectural contract files were launched, but the shared host
again fell to approximately 1.5 GB free memory despite bounded concurrency.
Unchanged test deadlines and worker termination timed out. Only this task's
remaining command trees were stopped to protect the shared host. Their logs,
nonzero interruption receipts and enumerated contract-file universe are
preserved; no complete-suite success is claimed.

Independent exact-main reproduction confirms 29 package-ownership findings,
expired architectural exceptions (raw DB actions, organization-scoped server
actions and stack authority), and Windows shell/Python portability failures.
The two selected Union Eyes smoke failures also reproduce on exact main;
the calendar route reports missing `DATABASE_URL`. Other scan timeouts are
resource-sensitive or unclassified, not mislabeled as baseline defects.
No exception deadline, timeout, skip, app source or baseline is changed.

The required pre-push architectural gate cannot be treated as passing while
these independently reproduced failures remain. Accordingly, no push, remote CI
or draft PR is claimed. Delivery uses the mandate's governance-blocked fallback:
a clean local committed candidate, a file/hash reconciliation manifest,
preserved candidate patch and ready-to-open draft PR body. Maintainers must
resolve the independent baseline/environment gates and finish qualification on
an adequately provisioned runner before publishing this candidate.

### Explicit external gates

| Gate | Decision |
| --- | --- |
| CONVERGENCE_CODE | PASS_WITH_LIMITATIONS for the tested, deny-only policy/control candidate |
| REPOSITORY_QUALIFICATION | HOLD: incomplete full suites, baseline/environment blockers, no remote CI |
| FLEET_IDENTITY | DENY_ONLY |
| TRUST_PERSISTENCE | CONTRACT_ONLY |
| AUDIT_DEPENDENCY | HOLD pending independent review and durable rollout proof |
| BROKER_READINESS | HOLD |
| EXECUTION_AUTHORIZATION | CLOSED |
| INSTALL_AUTHORIZATION | CLOSED |
| CIVITAS_PHASE_3 | CLOSED |

The exact-source validation dossier records the evidence behind these decisions.
Baseline failures, outstanding CI and human review remain visible. No test skip
or timeout expansion is authorized to turn a failing qualification green.

### Dependencies, telemetry and rollback

Production dependencies added by the new package are the existing workspace
`@nzila/audit` package and already-locked Zod 3.25.76 (MIT), with Node crypto.
Development resolutions reuse locked TypeScript 6.0.2, Vitest 4.1.2, ESLint 9.39.4,
TypeScript-ESLint 8.58.0 and Node type definitions; no unrelated resolution upgrade
is imported. The lockfile adds only the package importer. External tool/harness
licenses are not inferred from a registry: installation remains CLOSED until
per-artifact license/dependency/SBOM/security evidence is reviewed.

Dependency setup used frozen offline resolution with lifecycle scripts disabled.
This is not a native-build or postinstall qualification. No CLI-Hub, CLI-Anything,
external tool, remote telemetry SDK, executor or fleet registration is added.
`CLI_HUB_NO_ANALYTICS=1` is proposed policy configuration only; a future broker
must enforce it for every relevant process. No process is launched to prove it here.

Merge, deployment, signing, payments, legal filing, production-secret retrieval,
customer-data use, WorkAid actions and UE/CIVIC go-live are not authorized.
The original #936/#937/#938/#935/#922 branches remain independently governed.

Rollback is a revert of this candidate only before any production wiring.
There is no deployed state or production data migration to reverse.
