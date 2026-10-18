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
| F | Requested filesystem/output scope intersects BOTH grant and mission roots; Windows/POSIX lexical escape denial; CPU/memory/disk/output/process/time bounds; F01-F02 | Lexical policy tested; physical containment UNVERIFIED | Broker/SRE: realpath, symlink/junction/reparse and creation/rename race proofs |
| G | All network paths deny; wrappers/interpreters denied; explicit per-tool environment values, bounded secret references and forced provider analytics opt-out; G01 and foundation regressions | Runtime network/process/sandbox HOLD | Broker/security: redirect, DNS rebinding, proxy, child process, loader and vault enforcement |
| H | Pinned digest, immutable returned trust records, security-significant identity/license/source/commands/effects/capability drift suspends until verified reaffirmation; H and Phase 2 drift tests | Policy contract tested | Supply-chain owners: installed artifact measurement, signed provenance and upstream observer |
| I | Coherent snapshot, revision/count/head integrity, atomic expected-head append, stale writer/fork/tamper/truncation/restart simulation, host-authorized mutation; 35 atomic contract tests | CONTRACT_ONLY; memory adapter is not durable | Storage/SRE: approved durable adapter, crash recovery, backup/restore and concurrency proofs |
| J | Shared canonical audit v2, nested tamper coverage, legacy `LEGACY_PARTIAL`, version/downgrade rejection, payload snapshot and CSV/JSON round trips; 50 audit tests and consumer regression | Local compatibility tested; rollout HOLD | Audit maintainers: exact-source #938 review, marker persistence, legacy custody and live writer/reader rollout |
| K | Main-based integration, existing shared `AuditStore` interface preserved; current-main logger/AI/tools/doctrine/audit consumers tested; no Restricted or CIVITAS domain import | #935 exact-branch compatibility review remains independent, not certified here | Restricted-data security/privacy maintainers; CIVITAS Phase 3 CLOSED |
| L | Bounded discovery/skill schemas, untrusted text carries `authority: NONE`, generated harness remains candidate and needs full independent trust evidence; original lifecycle/skill tests and L01 | Discovery-only domain model; no provider installed/invoked | Provider/governance owners: per-artifact license, dependency/SBOM and review evidence |

The `HarnessLifecycle` model is planning state, not a trusted authorizer or generator.
Its `PrincipalRef` inputs are not production authentication. Completing its review
cannot mint a governance decision, modify the trust ledger, install or execute anything.
All in-process adapters and clocks are host configuration; runtime branding protects
against forged data, not hostile code already executing inside the process.

### Explicit external gates

| Gate | Decision |
| --- | --- |
| FLEET_IDENTITY | DENY_ONLY |
| TRUST_PERSISTENCE | CONTRACT_ONLY |
| AUDIT_DEPENDENCY | HOLD pending independent review and durable rollout proof |
| BROKER_READINESS | HOLD |
| EXECUTION_AUTHORIZATION | CLOSED |
| INSTALL_AUTHORIZATION | CLOSED |
| CIVITAS_PHASE_3 | CLOSED |

`CONVERGENCE_CODE` and `REPOSITORY_QUALIFICATION` are determined by the final
exact-source validation dossier, not by this table. Baseline failures, outstanding CI
and human review must remain visible. No test skip or timeout expansion is authorized
to turn a failing qualification green.

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
