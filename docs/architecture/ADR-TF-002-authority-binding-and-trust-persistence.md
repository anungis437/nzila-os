# ADR-TF-002: Authority Binding and Trust Persistence Before Any Broker

> **Status:** Proposed (pilot; maintainers own acceptance)
> **Date:** 2026-10-17
> **Builds on:** [ADR-TF-001](./ADR-TF-001-cli-anything-external-tool-provider.md)
> **Outcome:** `BROKER_READINESS = HOLD`

## Context

Phase 1 produced a provider-neutral policy layer. Its `AgentAuthority` (agent id plus
permitted capabilities) and `decidedBy` / `decisionRef` fields were *request-supplied
claims*. That is safe only while nothing executes; a broker accepting them would let an
agent describe its own authority and let any caller fabricate a trust decision.

## Existing primitives evaluated

| Primitive | Fit |
| --- | --- |
| `decision_events` table and `apps/control-plane/server/authority/*` | Durable, append-only (DB trigger), but records *automated policy outcomes* (allowed/denied) per org and workflow. No subject-and-digest binding, no entitled-decider proof, no revocation/supersession. App-level, not a package. |
| [`@nzila/governance-review`](../../packages/governance-review) `DecisionLedger` | Closest model: append-only, supersession, reviewer *role* (never a person). In-memory, workflow-specific, no subject/digest binding, no revocation lifecycle. |
| [`@nzila/doctrine-enforcement`](../../packages/doctrine-enforcement) `AICapabilityRegistry` | Registers AI *capabilities* with doctrine citations. Does not bind agents to capabilities. |
| `WorkflowPolicy` registry (control-plane) | Deny-by-default actor/role/action policy for workflows. App-level; not an agent-identity source. |
| [`@nzila/audit`](../../packages/audit) | Provides the `AuditStore` port, hash chain and engine. Only `InMemoryAuditStore` exists. **Defect:** see below. |

None can safely establish *agent identity + capability authority* or *an authenticated tool
trust decision*. We therefore define interface boundaries and do not pretend backing
authorities exist.

## Finding: `@nzila/audit` hash does not cover payload content

`computeAuditHash` calls `JSON.stringify(payload, Object.keys(payload).sort())`. An array
replacer filters keys at **every nesting depth**, so nested fields whose names are not among
the eight top-level keys are omitted from the hash. Changing a stored `grant.allowNetwork`
inside an entry's `payload` leaves `hash` and `verifyChain` unchanged (verified). This is
pre-existing and outside this change, so it is **not modified here** (altering the algorithm
would invalidate existing chains); it is reported for the audit package owners.

Consequence for Tool Fabric: the trust ledger must not rely on that chain for tamper
evidence. It carries its own canonical event hash chain and uses `AuditStore` purely as the
persistence port. Policy-audit records inherit the weaker guarantee until the defect is
fixed; they rely on the store's append-only enforcement.

## Decision

1. **Request/authority separation.** Requests are `ToolExecutionIntent` (identity + wish,
   strict schema). Authority is `ResolvedAgentAuthority`, minted only by
   `resolveAgentAuthority(AgentAuthorityResolver, agentId)`; approvals and trust decisions
   are `VerifiedGovernanceDecision`, minted only by
   `verifyGovernanceDecision(GovernanceDecisionVerifier, ref)`. Minting is tracked at runtime
   (`WeakSet`), not by TypeScript types. Both interfaces default to deny-all `Null*`
   implementations. No Tool-Fabric-local agent registry is created.
2. **Persistence reuses `@nzila/audit`.** An event-sourced `ToolTrustLedger` over the
   `AuditStore` port; no new database architecture, tables or migrations.
3. **Governance authenticity is delegated.** Tool Fabric records the verifier's snapshot
   (decision reference, kind, subject, digest, role, authority basis, attested evidence,
   status) and re-verifies the approving decision at execution time so upstream revocation
   or supersession takes effect.
4. **Drift suspends.** Material artifact drift suspends eligibility pending a new verified
   decision; history is never rewritten.
5. **Fail closed.** Unresolvable authority, unverifiable decisions, ledger integrity
   failures and audit-write failures all deny.

## Platform dependencies still required

1. **Authoritative agent identity and capability source** (fleet registry or mission
   authorization) implementing `AgentAuthorityResolver`.
2. **Governance-decision authority** implementing `GovernanceDecisionVerifier`: subject and
   digest binding, entitlement of the decider's role, attested evidence, revocation and
   supersession.
3. **DB-backed, append-only `AuditStore`** (the existing `nzila_deny_mutate()` trigger
   pattern) so ledger durability is real.
4. **`@nzila/audit` hash fix** covering the full payload (owner decision on chain migration).
5. **Upstream observer** that resolves immutable artifacts and feeds `observeUpstream`.
6. **Installer identity binding.** `GOVERNED_INSTALLER` is still a claimed request field,
   tightened by requiring a verified `TOOL_INSTALL` decision; the installer itself needs an
   authenticated identity.
7. `HarnessLifecycle` still takes claimed `PrincipalRef` values. It is not an execution
   path (candidates still need a trust decision) but should adopt verified decisions.

## Broker readiness: HOLD

Open: authoritative agent identity (1), durable and authentic decision provenance (2, 3),
upstream observation (5). The broker must not be implemented until they are resolved.

## Residual risk accepted

The runtime brand checks defend against forged *data*, not malicious *in-process code*: code
that can import the minting functions with a hostile resolver or verifier can mint anything.
Resolver and verifier wiring is therefore trusted configuration. Test fixtures live in
`@nzila/tool-fabric/testing` and are not exported from the package barrel.
