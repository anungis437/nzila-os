# @nzila/governance-runtime

Runtime governance primitives. Release and environment identity readers, deployment legitimacy validation, and inline governance assertions usable from any Nzila product.

See:
- [docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/runtime-doctrine-enforcement-engine.md](../../docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/runtime-doctrine-enforcement-engine.md)
- [docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/deployment-legitimacy-validation-engine.md](../../docs/categories/historical-archive/archive/iterations/nzila-runtime-governance/deployment-legitimacy-validation-engine.md)

## Posture

- Release identity is read from explicit, manifest-bound sources only. Heuristic inference is rejected.
- Deployment legitimacy validation fails closed on doctrine-critical paths.
- Assertions emit governance events; they do not log silently.
