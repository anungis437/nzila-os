# CIVIC

Public-institution continuity lane — the second lane of the two-lane
commercial spine alongside Union Eyes. The product remains in discovery /
market-engagement phase. This directory contains only the bounded local synthetic
Slice 0 kernel, not a deployed application or approved real pilot.

- Thesis and positioning: [`docs/CIVIC_OCI_ALIGNMENT.md`](../../docs/CIVIC_OCI_ALIGNMENT.md), [`docs/public-service/civic-thesis.md`](../../docs/public-service/civic-thesis.md)
- Catalog entry: [`governance/portfolio/product-catalog.json`](../../governance/portfolio/product-catalog.json) (`id: "civic"`)
- Commercial spine context: [`governance/portfolio/README.md`](../../governance/portfolio/README.md)

This directory exists so the portfolio catalog's 1:1 `apps/` mapping validator
(`scripts/lib/portfolio-governance.ts`) has a real directory to point at. Do
not add general product code here until a pilot is actually scoped and approved.

## Local synthetic Slice 0 exception

The [human decision packet](../../docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_AUTHORIZATION_PACKET.md)
approves only an isolated synthetic proof, from 2026-10-10T16:17:50Z to
2026-10-17T16:17:50Z, with expiry/revocation enforced by the doctrine guard.
General runtime authorization remains false. No real pilot, production data,
network connectors, deployment, public routes or Slice 1 is authorized.

The kernel separates authentication, application membership and delegated human
institutional authority. It preserves evidence categories, provenance, conflicts,
commitment/execution records, comparable outcome variance and explicit human
disposition. Two fictional institutional configurations exercise the same kernel.
State and audit events are in-memory; neither durable storage nor evidence-grade
audit integrity is claimed.

From this directory, `pnpm test`, `pnpm typecheck` and `pnpm proof` are the local
checks. Runtime checks require the exact authorized branch/worktree and current
grant. The [proof disposition](../../docs/public-service/operations/CIVIC_RUNTIME_SLICE_0_PROOF.md)
terminates execution permission at closeout; retained source remains scanned for
archival review. No automatic renewal or ongoing feature authorization exists.
