# @nzila/tool-fabric

Domain, policy, trust-ledger and audit layer for the Agent Tool Fabric. Pure functions and
in-memory registries plus a ledger over the injected `@nzila/audit` `AuditStore`;
**no executor, installer, network access, or database of its own**. `BROKER_READINESS = HOLD`.

See [docs/architecture/AGENT_TOOL_FABRIC.md](../../docs/architecture/AGENT_TOOL_FABRIC.md),
[ADR-TF-001](../../docs/architecture/ADR-TF-001-cli-anything-external-tool-provider.md) and
[ADR-TF-002](../../docs/architecture/ADR-TF-002-authority-binding-and-trust-persistence.md).

## Posture

- Agents request capabilities; they never describe their own authority. Authority and
  approvals come only from a trusted `AgentAuthorityResolver` / `GovernanceDecisionVerifier`
  (both default to deny-all).
- Discovery is not authorization; only a verified governance decision grants execution.
- External descriptors cannot carry trust or grant fields.
- Execution and installation are deny-by-default; audit failure denies.
- `SKILL.md` and other external text are untrusted data with `authority: 'NONE'`.

## Exports

`GovernedToolGate` (the broker-facing entry point), `ToolTrustLedger`, `ToolRegistry`,
`ToolPolicy`, `ToolProviderRegistry`, `resolveAgentAuthority`, `verifyGovernanceDecision`,
`classifyDrift`, `parseSkillDocument`, `HarnessLifecycle`, `normalizeCliHubEntry`, and the
types in `./types`. Test-only fixtures: `@nzila/tool-fabric/testing`.
