# Governance Policy Engine

> **Status:** Canonical runtime governance · **Layer:** Centralized policy execution · **Inherits:** [../nzila-governance/executable-doctrine-enforcement.md](../nzila-governance/executable-doctrine-enforcement.md), [runtime-doctrine-enforcement-engine.md](runtime-doctrine-enforcement-engine.md)

The **governance policy engine** is the centralized execution layer for runtime governance policies. Where the doctrine enforcement engine is the runtime façade, the policy engine is the registry, evaluation, and decision substrate beneath it. It supports policies for role governance, route governance, pilot gating, AI exposure, continuity-safe visibility, executive safety, deployment governance, and environment legitimacy.

---

## 1. Posture

The engine:

- **Registers** policies declaratively
- **Resolves** policies by surface, scope, and subject
- **Evaluates** in deterministic, citable form
- **Emits** decisions as governance events
- **Validates** policies against doctrine compatibility
- **Versions** policies with explicit migration paths

Policies are not code embedded in handlers. They are first-class, registered, governed, and evaluated through this engine.

---

## 2. Policy Domains

| Domain | Examples |
|--------|----------|
| Role governance | Role boundaries, role-to-surface mapping, escalation gates |
| Route governance | Route-doctrine compatibility, environment-route compatibility |
| Pilot gating | Pilot scope, pilot data isolation, pilot exit gates |
| AI exposure governance | Capability registration, exposure conditions, prohibition screens |
| Continuity-safe visibility | Anti-surveillance projection, aggregation enforcement |
| Executive safety | Density thresholds, refresh cadence, notification rate |
| Deployment governance | Manifest discipline, approval chains, rollback gates |
| Environment legitimacy | Environment identity, isolation invariants, seed legitimacy |

---

## 3. Required Implementation Surfaces

Materialized in [packages/doctrine-enforcement](../../packages/doctrine-enforcement):

- **Policy registry** — typed registry with schema-validated definitions; loadable from disk or governance source
- **Policy evaluation engine** — pure evaluator over (policy, subject, context) → decision
- **Runtime enforcement adapters** — bridges from evaluator output to platform layers (auth, routing, AI invocation, deployment)
- **Governance decision emitters** — typed emitters for evaluator decisions (allow / deny / require_approval / require_review)
- **Doctrine compatibility validators** — validators that check newly-registered policies against doctrine citations they claim

---

## 4. Policy Definition Shape

```ts
interface GovernancePolicy {
  readonly id: string                    // stable, doctrine-cited id
  readonly version: string
  readonly domain: PolicyDomain
  readonly scope: PolicyScope
  readonly description: string
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly conditions: readonly PolicyCondition[]
  readonly effect: 'allow' | 'deny' | 'require_approval' | 'require_review'
  readonly severity: 'info' | 'warning' | 'critical'
  readonly registeredBy: GovernanceForumId
  readonly registeredAt: string
}
```

Policies without doctrine citations are not accepted into the registry.

---

## 5. Evaluation Shape

```ts
interface PolicyEvaluationOutput {
  readonly policyId: string
  readonly policyVersion: string
  readonly decision: 'allow' | 'deny' | 'require_approval' | 'require_review'
  readonly reason: string                // cited
  readonly doctrineCitations: readonly DoctrineCitation[]
  readonly severity: 'info' | 'warning' | 'critical'
  readonly subject: PolicySubject
  readonly context: PolicyContext        // aggregation-safe
  readonly evaluatedAt: string
}
```

Evaluations are deterministic given (policy, subject, context). Non-determinism is a registry defect.

---

## 6. Doctrine Compatibility Validation

When a policy is registered or updated:

1. Citations are resolved against the doctrine corpus
2. Effect is validated against the cited doctrine's stated enforcement posture
3. Domain is validated against the cited doctrine's domain
4. Versioning rules are enforced (no silent re-issuance under same version)

A policy that fails compatibility validation is rejected. Manual override is itself a governance event requiring stewardship record.

---

## 7. Versioning

- Every policy carries `version`
- New versions are issued, not edited
- Superseded versions remain in registry for evaluator reproducibility
- Migration paths between versions are recorded
- Long-running operations may pin to the version active at start

---

## 8. Policy Sources

- Doctrine-derived policies (authored in governance forums, registered through the engine)
- Product-team policies (within doctrine bounds, reviewed at governance forum)
- Platform policies (deployment, environment, AI exposure)

All sources flow through the same registration discipline. There is no shadow policy path.

---

## 9. Categorical Refusals

The engine refuses to register policies that:

- Lack doctrine citations
- Encode behavioral ranking
- Encode productivity scoring
- Encode person-resolving conditions where aggregation suffices
- Encode marketing-derived effects
- Encode reversible effects on doctrine-critical paths without governance review

---

## 10. Anti-Patterns

- Policies as inline constants
- Policy registration without doctrine binding
- Editing policies in place
- Multiple registries with different rules
- Policy bypass paths
- Person-resolving policy conditions
- Cross-domain policy collapse ("just one big policy")

---

## 11. Discipline

The policy engine is the institutional spine of runtime governance. Centralized, governed, doctrine-cited, versioned policies are the difference between an institution that enforces what it believes and an institution that hopes what it believes shows up at runtime.
