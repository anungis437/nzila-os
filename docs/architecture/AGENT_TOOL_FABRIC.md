# Agent Tool Fabric

> **Status:** Phase 2 (domain, policy, ledger, audit and gate). No executor, installer, sandbox or broker exists.
> **Broker readiness: `HOLD`** — see [Broker gate](#broker-gate).
> **Package:** [`@nzila/tool-fabric`](../../packages/tool-fabric)
> **Decision records:** [ADR-TF-001](./ADR-TF-001-cli-anything-external-tool-provider.md), [ADR-TF-002](./ADR-TF-002-authority-binding-and-trust-persistence.md)

Agents request **capabilities**, not binaries. The fabric decides whether any governed
provider may satisfy a capability for that agent. Providers (CLI-Anything/CLI-Hub, MCP,
native CLIs, APIs, browser adapters) supply *descriptors*; they never supply authority.

```
MISSION -> AGENT -> CAPABILITY REQUIREMENT -> DISCOVERY -> TRUST DECISION
        -> EXECUTION POLICY -> APPROVED TOOL -> SANDBOX/BROKER -> RESULT -> PROVENANCE
```

An agent must never go directly `agent -> pip install -> arbitrary CLI -> shell`.

## Invariants

1. Discovery, installation, a `SKILL.md`, popularity, CLI-Hub presence, and being
   CLI-Anything-generated are **not** authorization.
2. Only a **verified governance decision** grants execution (see
   [Governance decision binding](#governance-decision-binding)). It is the only source of a
   `ToolGrant`; `ToolRegistry.decide()` / `reaffirm()` are the only mutation paths and reject
   anything not minted by the verifier. Caller claims such as `decidedBy: "some-human"` do
   not exist in the API.
3. Descriptors parsed from external sources are strict: they cannot carry trust, status or
   grant fields (registration fails).
4. Deny by default; every check must pass for `allowed: true`.
5. Installation is separate from execution; agents never install.
6. **Agents never describe their own authority.** A request names an agent and a wish;
   permitted capabilities and approvals are resolved by trusted components (see
   [Request and authority separation](#request-and-authority-separation)).

## Trust model

| Concept | Where |
| --- | --- |
| Identity: name, exact version, provider, source repo, package coordinates, licence, `sha256` digest | `ToolIdentity` |
| Source class: `NZILA_INTERNAL`, `VENDORED_APPROVED`, `REGISTRY_LISTED`, `GENERATED_HARNESS`, `SYSTEM_BINARY`, `EXTERNAL_UNREVIEWED` | `ToolSourceClass` |
| Side effects: fs read/write, subprocess, network, credentials, database, browser, GUI, publication, destructive | `ToolSideEffect` |
| Status: `DISCOVERED -> EVALUATING -> APPROVED / RESTRICTED / REJECTED`, then `REVOKED` | `ToolTrustStatus` |
| Provenance: how discovered, observed upstream ref, mutable-upstream flag; decision history with evidence | `ToolProvenance`, `ToolTrustDecision` |

`REJECTED` and `REVOKED` are terminal; a new version is a new record.

Approval is refused unless: pinned `sha256` digest, exact version, reviewed licence,
non-mutable upstream, a verified governance decision bound to that digest, governance-attested
evidence, and an explicit grant (named agents, capabilities, commands; no wildcards; side
effects and network no wider than the tool declares). `GENERATED_HARNESS` tools additionally
need `CODE_REVIEW`, `SECURITY_REVIEW`, `CAPABILITY_REVIEW`, `TEST_REPORT` and `PROVENANCE`
evidence.

### Evidence

Evidence is structured (`ToolEvidenceRef`: kind, reference, trust class, optional sha256).
Required kinds are `DIGEST_VERIFICATION` and `LICENSE` (plus the generated-harness kinds
above). Evidence counts only if it is `NZILA_VERIFIED` **and** its reference is attested by
the verified governance decision (`evidenceRefs`). Material taken from READMEs, `SKILL.md`,
registries or tool output is `EXTERNAL_UNTRUSTED`: it can be retained for review but never
satisfies a requirement.

## Request and authority separation

```
UNTRUSTED REQUEST (agent id + capability + wish)
      -> strict intent schema (unknown keys rejected)
      -> AgentAuthorityResolver (trusted)     -> ResolvedAgentAuthority
      -> GovernanceDecisionVerifier (trusted) -> VerifiedGovernanceDecision (approval)
      -> Tool Fabric policy
```

`ToolExecutionIntent` has no field for permitted capabilities or approval state; the strict
schema rejects `permittedCapabilities`, `approvalState`, `requestedBy` and anything else
unknown. `ResolvedAgentAuthority` and `VerifiedGovernanceDecision` are minted only by
`resolveAgentAuthority()` / `verifyGovernanceDecision()` and checked **at runtime** (a
`WeakSet`), so a hand-built or JSON-deserialised object fails closed even if it type-checks.
Policy additionally denies on identity mismatch, missing resolution and stale resolution
(default 5 minutes). Per-request approvals are bound to the exact intent
(`boundIntentHash`) and cannot be replayed for a different one.

The platform has **no authoritative agent-to-capability source** today, so
`NullAgentAuthorityResolver` (deny everything) is the default. Do not back the interface with
a Tool-Fabric-local registry.

## Governance decision binding

Tool Fabric references authoritative governance decisions; it does not invent governance
authority. `GovernanceDecisionVerifier.verify(ref)` must report that the decision exists,
applies to this tool **and artifact digest**, which role decided it and on what authority
basis, which evidence it attests, and that it is `ACTIVE` (not revoked or superseded). The
snapshot, never caller input, is what the ledger records. At execution time the gate
re-verifies the tool's approving decision, so revoking or superseding the decision upstream
takes effect without a ledger write. `NullGovernanceDecisionVerifier` (deny everything) is
the default; no existing platform primitive provides this (see ADR-TF-002).

## Execution boundary (policy only)

`ToolPolicy.evaluateExecution(intent, { authority, approval })` denies unless all hold: the
authority is a runtime-minted resolution for exactly the requesting agent and is fresh; tool
is `APPROVED`/`RESTRICTED` and **not suspended**; agent is both platform-authorised for the
capability **and** named in the grant; command is
granted and is not a shell/interpreter/installer; working directory and expected outputs
are normalised absolute paths inside explicit non-root filesystem roots; network is `NONE`
unless granted; environment is an explicit allowlist (no inheritance, no `PATH`/loader
variables, no secret-shaped names, nothing broker-controlled); secrets only as granted
`secretref:` references; side effects within grant; a verified, intent-bound per-request
approval for `RESTRICTED` tools and for credential/publication/destructive effects; timeout
within the grant; audit correlation id present.

On allow it returns `brokerDirectives` (forced env, network policy) that a future broker
**must** apply. Telemetry opt-out is enforced there, centrally, so agents cannot forget or
override it.

## Installation boundary (policy only)

`ToolPolicy.evaluateInstall` allows only a `GOVERNED_INSTALLER` (never an `AGENT`) for an
approved, unsuspended tool whose digest and package coordinates match the approved record,
with a verified `TOOL_INSTALL` governance decision bound to that digest, in an isolated
environment, with licence accepted and a dependency-inspection reference.

## Trust ledger (persistence)

`ToolTrustLedger` is event-sourced and append-only. Events (`TOOL_REGISTERED`,
`TRUST_DECISION`, `DRIFT_OBSERVED`, `TRUST_REAFFIRMED`) are persisted through the existing
[`@nzila/audit`](../../packages/audit) `AuditStore` port: Tool Fabric has **no database of
its own**, and its durability is exactly that of the injected store. State is rebuilt by
replaying every event through the same `ToolRegistry` state machine used for live decisions.

`@nzila/audit`'s own hash chain does not cover nested payload fields (see ADR-TF-002), so the
ledger carries its own canonical SHA-256 chain (`seq`, `prevEventHash`, `eventHash`) in each
payload and verifies it on every load. A gap, fork, reorder, edited body, unknown event type
or non-replayable event raises `LedgerIntegrityError`, and the gate denies.

## Upstream drift

`classifyDrift(approved, observed)` distinguishes: `UNCHANGED`, `METADATA_CHANGED`
(non-material), and the material kinds `DIGEST_CHANGED`, `SIDE_EFFECTS_WIDENED`,
`SOURCE_BECAME_MUTABLE`, `VERSION_MISSING`, `PROVENANCE_UNVERIFIABLE`. Recording material
drift on a live tool **suspends** it: it stays `APPROVED`/`RESTRICTED` in history but is
ineligible for execution or installation. Observing the old artifact again does not clear
the suspension. The only exits are revocation, or `reaffirm` with a new verified decision
bound to the artifact now observed plus fresh evidence; the superseded descriptor is moved to
`descriptorHistory` and earlier decisions are never rewritten. Nothing fetches upstream state
yet: a future observer feeds `observeUpstream`.

## Audit

`GovernedToolGate` is the single entry point a broker must call. Every evaluation (allowed or
denied, including malformed intents and unresolved authority) is recorded through a
`ToolAuditSink` (`AuditEngineToolAuditSink` over `@nzila/audit`) with: correlation id,
requesting agent, capability, tool key and digest, trust status and suspension, the trust
decision relied on, authority source/reference, approval reference, outcome and scrubbed
reasons. It stores hashes and counts (command hash, argument hash/count, env key count,
secret-reference count), never arguments, environment values, secret references or command
payloads; quoted caller text in reasons is redacted. **If the audit write fails the request
is denied.** Trust-ledger writes are themselves audit entries.

## Three tool paths

| Path | Condition | Outcome |
| --- | --- | --- |
| A | Approved tool granted to this agent | governed execution |
| B | Candidate exists but not approved/granted | stops at evaluation |
| C | No candidate | a harness-generation request may be filed |

`ToolRegistry.planCapability()` returns the path.

## Harness-generation lifecycle

`REQUESTED -> GENERATION_AUTHORISED -> GENERATED -> IN_REVIEW -> READY_FOR_TRUST_EVALUATION`
(or `REJECTED`). Requests state target, desired and prohibited capabilities/side effects,
command groups, JSON output, test/validation requirements, licence constraints, mission and
agent. A requester cannot authorise its own request or pass its own review gates. Generated
candidates must not exceed the request, must be `GENERATED_HARNESS`, and must pass all five
gates (`CODE_REVIEW`, `SECURITY_REVIEW`, `CAPABILITY_REVIEW`, `TESTS`, `PROVENANCE_CAPTURE`).
The end state is a **candidate** that registers as `DISCOVERED`; generation and approval
remain separate decisions. Generation operates only on an authorised source and never
publishes to a public registry.



## Skill ingestion and prompt-injection boundary

`parseSkillDocument` yields a `SkillDescriptor` with `instructionTrust: 'UNTRUSTED_DATA'`
and `authority: 'NONE'`: a content hash, source reference, bounded display fields, claimed
command groups, ignored authority keys, and advisory flags (instruction override, self-grant,
secret disclosure, approval bypass, remote code execution, concealment, destructive
commands). Body text is never returned as instructions. The same boundary covers READMEs,
registry descriptions, package metadata, help output and command output: **none may redefine
system policy, agent authority, governance, secret policy, network policy, tool permissions
or deployment authority.** Flagged skills require human review.

Heuristic flagging is advisory, **not** the safety mechanism. The mechanism is structural: a
skill has no path to a grant, trust status, authority, intent field, evidence or governance
decision. Descriptors and intents are strict schemas, trust state changes only through
verified governance decisions, and authority only through the resolver. Tests prove this with
skill text deliberately phrased to evade every heuristic.

## CLI-Hub provider status

CLI-Hub entries as currently observed install from mutable Git references with no artifact
digest. Discovery therefore yields `DISCOVERED`/`EVALUATING` candidates only: approval
requires a pinned digest and immutable upstream, and those requirements are not relaxed for
the registry. A future fetch/normalise step must resolve an immutable artifact first. The
`CLI_HUB_NO_ANALYTICS=1` opt-out is injected centrally through `brokerDirectives`.

## Supply-chain questions the model can answer

Source and exact version (identity), package installed (coordinates + digest), review time
and decision (`decisions[]` with the governance snapshot), allowed agents/capabilities
(grant), upstream change (`classifyDrift`, `driftHistory`), revocation (`REVOKED` clears the
grant; upstream revocation of the governance decision is re-checked at execution time). A
full SCA/SBOM platform is out of scope; the digest, coordinates and evidence fields are the
attachment points.

## Broker gate

`BROKER_READINESS = HOLD`. The broker stays closed until all of these hold:

| Requirement | State |
| --- | --- |
| Agent identity is authoritative | **Open** — no platform source binds agent identity to capabilities; resolver is a deny-all default |
| Capabilities cannot be self-asserted | Met (strict intent schema, runtime-minted authority) |
| Tool approval is durable | **Open** — ledger is durable only via an `AuditStore`; only `InMemoryAuditStore` exists |
| Decision provenance is durable and authentic | **Open** — no governance-decision authority to implement the verifier; provenance is only as durable as the store |
| Revocation is enforceable | Met in the gate (ledger state and upstream decision re-verified), conditional on a real verifier |
| Drift is enforceable | Partly — suspension is enforced; nothing observes upstream yet |
| Audit exists | Met (sink + trust events), same durability caveat |
| Secrets remain reference-only | Met |
| No execution path bypasses policy | Met trivially: no execution path exists |

See [ADR-TF-002](./ADR-TF-002-authority-binding-and-trust-persistence.md) for the missing
platform dependencies.

## Not built (deliberately withheld)

Executor/broker, sandbox, installer, a DB-backed `AuditStore`, a real authority resolver or
governance verifier, an upstream observer, CLI-Hub network access, any generator invocation,
an agent registry, the TOOLSMITH agent, and any deployment authority.

## Path to the ceiling

1. **Platform dependencies (blockers for the broker):** an authoritative agent/capability
   source, a governance-decision authority that supports subject-and-digest binding,
   role entitlement and revocation, and a DB-backed append-only `AuditStore`.
2. **Upstream observer:** resolves immutable artifacts and feeds `observeUpstream`.
3. **Broker:** a small, boring executor that calls `GovernedToolGate`, applies
   `brokerDirectives`, enforces isolation and resource limits, and emits provenance.
4. **Governed installer:** isolated per-tool environments from digest-pinned artefacts.
5. **More providers:** MCP/plugin, API and browser adapters through the same descriptor and
   grant model.