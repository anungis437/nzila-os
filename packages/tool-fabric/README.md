# @nzila/tool-fabric

Domain, policy, trust-ledger and audit layer for the Agent Tool Fabric. Pure functions and
in-memory registries plus a deny-default atomic trust-store contract using shared
`@nzila/audit` v2 integrity;
**no executor, installer, network access, or database of its own**. `BROKER_READINESS = HOLD`.

See [docs/architecture/AGENT_TOOL_FABRIC.md](../../docs/architecture/AGENT_TOOL_FABRIC.md),
[ADR-TF-001](../../docs/architecture/ADR-TF-001-cli-anything-external-tool-provider.md) and
[ADR-TF-002](../../docs/architecture/ADR-TF-002-authority-binding-and-trust-persistence.md).

## Posture

- Agents request capabilities; they never describe their own authority. Authority and
  invocation comes from an independent host `InvocationAuthenticator`. Authority and
  approvals use trusted `AgentAuthorityResolver` / `GovernanceDecisionVerifier` adapters.
  The production defaults deny.
- Discovery is not authorization; a verified governance decision grants policy eligibility only.
- External descriptors cannot carry trust or grant fields.
- Execution and installation are CLOSED even when `policyEligible` is true; audit failure denies.
- `SKILL.md` and other external text are untrusted data with `authority: 'NONE'`.

## Exports

`GovernedToolGate` (the broker-facing entry point), `ToolTrustLedger`, `ToolRegistry`,
`ToolPolicy`, `ToolProviderRegistry`, `resolveAgentAuthority`, `verifyGovernanceDecision`,
`classifyDrift`, `parseSkillDocument`, `HarnessLifecycle`, `normalizeCliHubEntry`, and the
types in `./types`. Test-only fixtures: `@nzila/tool-fabric/testing`.

## Convergence limits

Full bounded v2 intent hashing includes actor, organization/mission, artifact, argv,
resource/network/filesystem/environment/secret scope, nonce and approval reference.
High-risk approval requires separated requester, author, reviewer and approver identities.
Every trust mutation requires host authorization and compare-and-append at the evaluated
revision. A plain `AuditStore` cannot satisfy the atomic trust-store contract.

No approved durable adapter or authenticated fleet source is supplied. The in-memory atomic
adapter is test-only and not exported from the barrel. Realpath/reparse confinement,
one-time approval consumption, sandbox/network/resource enforcement and live audit rollout
remain external proofs. See the [consolidated acceptance report](../../docs/architecture/TOOL_FABRIC_CONVERGENCE.md).

### Persistent ledger rollback protection (P0 #1037)

A `HOST_ATTESTED_PERSISTENT` store now **fails closed** unless the host supplies a
separately managed `TrustLedgerHeadWitness`. Every load checks the exact
revision/head hash against that independent high-watermark; every successful
CAS append must seal the committed head. A fully rewritten but internally valid
hash chain, missing witness, stale witness, failed sealing, or unavailable
witness cannot be accepted as successful.

The adapter interface does not create an independent persistence/authority
service. In-memory tests remain explicitly NON_DURABLE_CONTRACT_ONLY. Tool
execution and installation remain disabled pending separately controlled
production identity, store, sandbox, revocation and containment proof.
