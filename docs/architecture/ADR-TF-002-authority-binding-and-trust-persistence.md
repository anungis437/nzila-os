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
| [`@nzila/audit`](../../packages/audit) | Shared canonical v2 hash chain and engine. Its plain `AuditStore` is not an atomic trust-store implementation. |

None can safely establish *agent identity + capability authority* or *an authenticated tool
trust decision*. We therefore define interface boundaries and do not pretend backing
authorities exist.

## Historical finding and convergence resolution

`computeAuditHash` calls `JSON.stringify(payload, Object.keys(payload).sort())`. An array
replacer filters keys at **every nesting depth**, so nested fields whose names are not among
the eight top-level keys are omitted from the hash. Changing a stored `grant.allowNetwork`
inside an entry's `payload` leaves `hash` and `verifyChain` unchanged (verified). This is
pre-existing. This convergence reconciles #938: new entries use nested canonical v2
hashing, legacy entries report `LEGACY_PARTIAL`, and unknown/downgraded versions deny.

The trust ledger now uses shared v2 hash/verification primitives, rather than a duplicate
crypto implementation. Production writer/reader migration and durable atomic persistence
remain independent HOLDs; passing memory-store tests does not settle either.

## Decision

1. **Request/authority separation.** Independently authenticated host invocation must bind
   subject, organization, mission and invocation reference. Requests are `ToolExecutionIntent` (identity + wish,
   strict schema). Authority is `ResolvedAgentAuthority`, minted only by
   `resolveAgentAuthority(AgentAuthorityResolver, agentId)`; approvals and trust decisions
   are `VerifiedGovernanceDecision`, minted only by
   `verifyGovernanceDecision(GovernanceDecisionVerifier, ref)`. Minting is tracked at runtime
   (`WeakSet`), not by TypeScript types. Both interfaces default to deny-all `Null*`
   implementations. No Tool-Fabric-local agent registry is created.
2. **Persistence reuses shared audit integrity.** The event-sourced `ToolTrustLedger`
   requires a coherent snapshot and atomic expected-revision/head compare-and-append.
   Every mutation requires host actor/role authorization. Plain `AuditStore` is rejected;
   no production adapter, database architecture, tables or migrations are introduced.
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
3. **Durable atomic trust store** plus append-only audit storage, recovery and crash proofs.
4. **`@nzila/audit` v2 rollout review** covering version-marker persistence, legacy custody,
   mixed-chain readers and writer ordering.
5. **Upstream observer** that resolves immutable artifacts and feeds `observeUpstream`.
6. **Installer identity binding.** `GOVERNED_INSTALLER` is still a claimed request field,
   and is never accepted as authenticated identity: installation is unconditionally CLOSED.
   A future installer needs a separate host identity/grant.
7. `HarnessLifecycle` still takes claimed `PrincipalRef` values. It is not an execution
   path (candidates still need a trust decision) but should adopt verified decisions.

## Broker readiness: HOLD

Open: authoritative agent identity (1), durable and authentic decision provenance (2, 3),
upstream observation (5), atomic approval consumption, measured executables and operational
containment. The gate returns `allowed:false` even for policy-eligible requests.

## Residual risk accepted

The runtime brand checks defend against forged *data*, not malicious *in-process code*: code
that can import the minting functions with a hostile resolver or verifier can mint anything.
Resolver and verifier wiring is therefore trusted configuration. Test fixtures live in
`@nzila/tool-fabric/testing` and are not exported from the package barrel.
