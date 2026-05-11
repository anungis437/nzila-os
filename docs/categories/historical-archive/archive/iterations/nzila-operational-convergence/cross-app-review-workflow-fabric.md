# Cross-App Review Workflow Fabric

> **Status:** Canonical convergence · **Layer:** Review fabric · **Inherits:** [docs/nzila-governance-experience/real-operational-workflows.md](../nzila-governance-experience/real-operational-workflows.md)

## 1. Objective

Standardize the institutional review workflows so a reviewer's act looks the same in every product.

## 2. Canonical workflows

| Workflow | Decision shapes | Required citation |
|---|---|---|
| Governance posture review | acknowledge / approve_with_conditions | doctrine document |
| Rollout review | acknowledge / approve_with_conditions / reject | rollout doctrine |
| Continuity review | acknowledge / request_clarification | continuity doctrine |
| Deployment review | acknowledge / approve_with_conditions / reject | deployment legitimacy doctrine |
| Attestation review | acknowledge / request_clarification | attestation doctrine |
| Stabilization review | acknowledge / approve_with_conditions | stabilization doctrine |
| Onboarding review | acknowledge / request_clarification | continuity doctrine |
| Operational readiness review | acknowledge / approve_with_conditions / reject | readiness doctrine |

## 3. Required uniform behavior

- Every workflow records into a single append-only ledger shape from [`@nzila/governance-review`](../../packages/governance-review).
- Every workflow cites at least one doctrine document.
- Every `approve_with_conditions` carries explicit conditions.
- Every `reject` carries an explicit rationale.
- Supersession is the only correction; nothing is silently overwritten.

## 4. Cross-app continuity

A decision recorded in Control Plane is visible in Console under the same shape. The reviewer's mental model never resets between apps.

## 5. Required outputs

The workflow registry ships in [`@nzila/operational-convergence`](../../packages/operational-convergence) as `CANONICAL_REVIEW_WORKFLOWS`.

## 6. Discipline

A review fabric succeeds when a reviewer can complete a session in any product, knowing the act has the same institutional weight everywhere.
