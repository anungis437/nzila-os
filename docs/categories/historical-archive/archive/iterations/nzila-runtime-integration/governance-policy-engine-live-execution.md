# Governance Policy Engine — Live Execution

> **Status:** Canonical runtime integration · **Layer:** Policy execution · **Inherits:** [governance-policy-engine.md](../nzila-runtime-governance/governance-policy-engine.md)

## 1. Objective

Move the governance policy engine from registration into actual runtime execution so registered policies actually govern feature exposure, route access, AI invocation, and visibility scoping.

## 2. Execution layers

| Layer | Policy domain enforced |
|---|---|
| Edge middleware | `route` |
| Layout guards | `role`, `continuity-safe-visibility` |
| Route handlers / server actions | `pilot`, `executive-safety` |
| Feature registries | `ai-exposure`, `continuity-safe-visibility` |
| Orchestration adapters | `deployment`, `environment` |
| API boundaries | All applicable domains |

## 3. Required wiring

The wiring uses [@nzila/governance-middleware](../../packages/governance-middleware), which exposes:

- `withPolicyGate(policyId, build)` — wraps a route handler. Resolves the latest policy version, builds the subject + context, evaluates, and short-circuits with `403 Forbidden` (deny), `409 Conflict` (require_approval), or proceeds (allow). Emits `doctrine_enforcement_event`.
- `evaluatePolicies(policies, subject, context)` — pure helper for callers that need decisions without HTTP semantics.
- `requireRegisteredAICapability(capabilityId, version)` — refuses unregistered or categorically-refused AI capabilities at the boundary.

## 4. Policy lifecycle

- Policies are loaded into the in-memory `DoctrinePolicyRegistry` at process startup from `tooling/runtime-governance/policies/`.
- A change to the policies directory triggers a redeploy. Hot-reload of policies is rejected by design — policy changes must be release-bound and attested.
- The registry exposes `latest(id)` and `get(id, version)`. Routes evaluating a policy MUST pin to either the latest version or to a versioned reference declared by the route's feature profile.

## 5. Determinism

`evaluatePolicy()` is deterministic given (policy, subject, context, evaluatedAt). For audit reconstruction, the registered timestamp is preserved in the ledger record. Two evaluations of the same policy against the same subject on the same release produce identical decisions and identical evidence.

## 6. Discipline

Policy execution must be quiet on the happy path and structural on the breach path. A policy that requires inspection of every read is not a policy; it is a brake on the institution. Policy effects must be cited, evidence-bearing, and stabilization-oriented.
