# Executive Operating System Finalization

Authority: `master-finalization-index.md`. As of 2026-07-03.

Executive-readable summary of the production finalization.

## Bottom line

Three products — **union-eyes, web, partners** — now run in a **dedicated, isolated
production environment** in Azure, each on an **immutable (digest-pinned) image**,
serving its **real production domain** over **valid managed TLS**, backed by a
production database with **30-day retention, geo-redundant backup, and
zone-redundant high availability**. Deploy authority is **OIDC-only** with an
**environment-scoped federated credential**; the org/tenant substrate **fails
closed**; and every production gate the repo can run is **green**.

## What changed to get here

- Production surface frozen and classified (0 unknowns).
- Long-lived deploy credential fallback removed; deploy authority bounded + policy-gated.
- BR-6 org-context drift closed (single fail-closed resolver, no silent default org).
- Isolated prod runtimes built and verified live for all three products.
- Domains cut over to the isolated prod apps with managed TLS.

## Residual (owner-tracked)

- Rotate the storage key surfaced during hardening; rotate the shared API token.
- Apex certificate finishing provisioning; prod metric alert rules to be added.

Full detail: `docs/readiness/full-production-readiness-delta.md`.
