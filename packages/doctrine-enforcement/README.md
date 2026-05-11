# @nzila/doctrine-enforcement

Doctrine policy registry, deterministic evaluator, AI capability registry, and runtime enforcement primitives.

See:
- [docs/nzila-runtime-governance/runtime-doctrine-enforcement-engine.md](../../docs/nzila-runtime-governance/runtime-doctrine-enforcement-engine.md)
- [docs/nzila-runtime-governance/governance-policy-engine.md](../../docs/nzila-runtime-governance/governance-policy-engine.md)
- [docs/nzila-runtime-governance/governance-safe-ai-runtime-validation.md](../../docs/nzila-runtime-governance/governance-safe-ai-runtime-validation.md)

## Posture

- Every registered policy MUST cite at least one doctrine document.
- Every registered AI capability MUST bind an explainability surface and a reviewability surface.
- Evaluation is deterministic given (policy, subject, context). Non-determinism is a registry defect.
- Categorically prohibited AI behaviors are refused at registration time.

## Exports

- `./types` — policy / decision / AI capability types.
- `./registry` — in-memory policy registry with versioning and doctrine-citation enforcement.
- `./evaluator` — pure evaluator over (policy, subject, context).
- `./ai-capability-registry` — AI capability registration with categorical refusal screen.
