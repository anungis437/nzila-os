# Agent Tool Fabric

> **Status:** Foundation (domain/policy layer only). No executor, installer, or broker exists yet.
> **Package:** [`@nzila/tool-fabric`](../../packages/tool-fabric)
> **Decision record:** [ADR-TF-001](./ADR-TF-001-cli-anything-external-tool-provider.md)

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
2. Only a trust decision by a `HUMAN_REVIEWER` or `GOVERNANCE_BODY` grants execution. It is
   the only source of a `ToolGrant`, and `ToolRegistry.decide()` is the only mutation path.
3. Descriptors parsed from external sources are strict: they cannot carry trust, status or
   grant fields (registration fails).
4. Deny by default; every check must pass for `allowed: true`.
5. Installation is separate from execution; agents never install.

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
non-mutable upstream, evidence, and an explicit grant (named agents, capabilities,
commands; no wildcards; side effects and network no wider than the tool declares).
`GENERATED_HARNESS` tools additionally need `code-review:`, `security-review:`,
`capability-review:`, `tests:` and `provenance:` evidence.

## Execution boundary (policy only)

`ToolPolicy.evaluateExecution` denies unless all hold: tool is `APPROVED`/`RESTRICTED`;
agent is both platform-authorised for the capability **and** named in the grant; command is
granted and is not a shell/interpreter/installer; working directory and expected outputs
are normalised absolute paths inside explicit non-root filesystem roots; network is `NONE`
unless granted; environment is an explicit allowlist (no inheritance, no `PATH`/loader
variables, no secret-shaped names, nothing broker-controlled); secrets only as granted
`secretref:` references; side effects within grant; per-request approval for `RESTRICTED`
tools and for credential/publication/destructive effects; timeout within the grant;
audit correlation id present.

On allow it returns `brokerDirectives` (forced env, network policy) that a future broker
**must** apply. Telemetry opt-out is enforced there, centrally, so agents cannot forget or
override it.

## Installation boundary (policy only)

`ToolPolicy.evaluateInstall` allows only a `GOVERNED_INSTALLER` (never an `AGENT`) for an
approved tool whose digest and package coordinates match the approved record, in an
isolated environment, with licence accepted and a dependency-inspection reference.

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

## Supply-chain questions the model can answer

Source and exact version (identity), package installed (coordinates + digest), review time
and decision (`decisions[]`), allowed agents/capabilities (grant), upstream change
(`detectDrift`), revocation (`REVOKED` clears the grant). A full SCA/SBOM platform is out of
scope; the digest, coordinates and evidence fields are the attachment points.

## Not built (deliberately withheld)

Executor/broker, sandbox, installer, persistence, audit-event emission, CLI-Hub network
access, any generator invocation, an agent registry, the TOOLSMITH agent, and any
deployment authority.

## Path to the ceiling

1. **Persistence + audit:** store records through the existing audit/evidence packages.
2. **Broker:** a sandboxed executor that calls `ToolPolicy`, applies `brokerDirectives`,
   and emits provenance for every result.
3. **Governed installer:** isolated per-tool environments from digest-pinned artefacts.
4. **More providers:** MCP/plugin, API and browser adapters through the same descriptor
   and grant model.
5. **Fleet binding:** wire `AgentAuthority` to the fleet capability model when it exists.
