# Security Overview

## Controls in Place

- Encryption at rest and in transit (TLS + platform encryption).
- Role-based access enforcement in application services.
- Security headers on internal apps (`X-Robots-Tag: noindex` added in prior ops pass).
- Supply-chain and vulnerability scanning workflows present in CI.
- Audit/evidence packaging capabilities for regulated workflows.

## Secret Handling Posture

- Runtime-only secret injection is the target state.
- Build-time secret passing has been hardened in deploy workflows in this pass.
- See `docs/security/secrets-hardening-report.md`.

## Assurance Boundaries

- SOC 2 Type II: roadmap item, not currently claimed as achieved.
- External penetration test: readiness package available; independent assessment pending.

## Sources

- `docs/commercial/claims-ledger.md`
- `.github/workflows/secret-scan.yml`
- `docs/security/secrets-hardening-report.md`
