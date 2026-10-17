# @nzila/cora

> Cora is Agricultural Institutional Infrastructure.
> Its core capability is institutional composability.

The food-economy capability horizon does not make Cora evidence authority or
recipient decision authority. The [v3 doctrine](../../docs/categories/products-and-market/agri/ADR/ADR-AGRI-002-cora-food-economy-ceiling.md)
and [stress-test framework](../../docs/categories/products-and-market/agri/CORA_STRESS_TEST_FRAMEWORK.md)
block production activation, commercial pilot commitment and material route
expansion. Separately authorized foundational engineering may continue.
No discovery, source access or deployment is authorized by these documents.

**Product boundary:** Cora is a first-class product for Canada and data-rich
agricultural environments. It is not an Agrimo companion or an Agrimo
deployment profile. Agrimo remains a separate first-class product for
cooperative, offline-first, and emerging-market agricultural operations.
See [ADR-AGRI-001](../../docs/categories/products-and-market/agri/ADR/ADR-AGRI-001-cora-agrimo-product-boundary.md).

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Declared packages:** `@nzila/agri-core`, `agri-db`, `agri-forecasting`, `agri-intelligence`, `agri-provenance`, `agri-supply-chain`, `agri-traceability` (declared dependencies are not evidence of a live data path)
- **Port:** 3006

## Quick Start

```bash
pnpm dev:cora         # or: cd apps/cora && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable       | Purpose                                                                                 |
| -------------- | --------------------------------------------------------------------------------------- |
| `AUTH_SECRET`  | NextAuth session encryption                                                             |
| `AZURE_AD_*`   | Entra SSO (optional)                                                                    |
| `DATABASE_URL` | PostgreSQL configuration; the current Cora app has no live agricultural repository call |
| `OTEL_*`       | OpenTelemetry (optional)                                                                |

## Placeholder Dashboard Routes

`yield-forecast` · `price-signals` · `risk-and-resilience` · `cooperative-performance` · `impact-and-traceability` · `data-sources`

These route shells do not establish implemented data or analytics
capabilities; see the current implementation boundary below.

## Product Domain

Cora's intended product domain includes farmer and farm-enterprise
intelligence, value creation, opportunities, association intelligence,
collective action, agricultural evidence interpretation, frameworks and
benchmarks, capital readiness, commerce/settlement awareness, and
food-system intelligence. These are product boundaries, not claims that
every capability is implemented.

## Current Implementation Boundary

The current dashboard modules are placeholder UI. The Phase 0B audit found
no live agricultural repository or intelligence-query call in app source;
the declared shared agricultural packages do not establish an active data
path. Current access controls and `cora-readonly` contract tests remain in
force. See the [Phase 0B seam audit](../../docs/categories/products-and-market/agri/CORA_IMPLEMENTATION_SEAM_AUDIT.md)
and [ADR-AGRI-002](../../docs/categories/products-and-market/agri/ADR/ADR-AGRI-002-cora-food-economy-ceiling.md).
Any future Cora-owned workflow requires separate authorization and a
reviewed ownership, tenant, evidence, and service/repository boundary.

The [Cora Evidence Foundation](../../docs/categories/products-and-market/agri/CORA_EVIDENCE_FOUNDATION.md)
defines portable contracts and a Cora-owned schema seam. It is not wired to
application routes or a concrete persistence adapter; no Cora write permission
is granted, the current app remains read-only, and its migration has not been
applied.
