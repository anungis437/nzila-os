# @nzila/assurance-engine

Interpretive assurance bandings per assurance dimension. Refuses composite collapse — there is no single "assurance score" surface.

See:
- [docs/nzila-runtime-governance/runtime-assurance-engine.md](../../docs/nzila-runtime-governance/runtime-assurance-engine.md)

## Posture

- Each assurance dimension is banded independently as `strong | established | forming | concern`.
- Each posture read carries an explicit confidence (`high | moderate | low`) and a citable evidence reference.
- The engine refuses to emit a single overall score; consumers must present per-dimension bandings.
