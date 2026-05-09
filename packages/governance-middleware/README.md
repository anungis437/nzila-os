# @nzila/governance-middleware

Runtime governance middleware. Wires the governance packages into product code through small, framework-friendly helpers:

- `governanceEmitter` — process-scoped envelope emitter with sinks (OTel, ledger, in-memory for tests).
- `withPolicyGate(policyId, build)` — wraps a route handler against a registered policy.
- `requireRegisteredAICapability(id, version)` — refuses unregistered or categorically-refused AI capabilities at the boundary.
- `attachGovernanceHeaders(headers, envelope)` — propagates correlation + release identity through outbound responses.
- `ensureLegitimateEnvironment()` — convenience wrapper around `validateDeploymentLegitimacy` for boot-time checks.

See [docs/nzila-runtime-integration/governance-policy-engine-live-execution.md](../../docs/nzila-runtime-integration/governance-policy-engine-live-execution.md).

## Posture

- Middleware never silently degrades. Every gate emits a governance event regardless of decision.
- Sinks receive validated envelopes only. Forbidden payload keys are rejected at the emitter boundary, even if the schema layer were bypassed elsewhere.
- The package is framework-agnostic at the core; the `next` submodule provides Next.js Route-Handler shaped wrappers.
