# Procurement Pack — Canonical Index

> This is the **canonical entrypoint** for procurement / due-diligence review of
> `nzila-os` production readiness. It is an index over existing certification
> evidence — it does not introduce new procurement claims or commercial terms.

- **Last updated:** 2026-07-03
- **Production-readiness baseline commit:** `e01319325421cb25fc96c52b01f9dde498458aed`
- **Verdict:** `PRODUCTION READY` — see [readiness/production-certification.md](readiness/production-certification.md)

## Executive readiness

| Item | Authoritative document |
| --- | --- |
| Canonical production verdict + exceptions | [readiness/production-certification.md](readiness/production-certification.md) |
| Release summary (apps/domains/gates/closed exceptions) | [readiness/production-ready-release-summary.md](readiness/production-ready-release-summary.md) |
| Final operating-system readiness review (human sign-off) | [nzila-finalization/final-operating-system-readiness-review.md](nzila-finalization/final-operating-system-readiness-review.md) |

## Certification evidence (by domain)

| Domain | Authoritative document |
| --- | --- |
| Deployment authority / promotion governance | [readiness/deployment-production-certification.md](readiness/deployment-production-certification.md) |
| OIDC / identity migration | [readiness/oidc-migration-certification.md](readiness/oidc-migration-certification.md) |
| DNS / TLS ingress | [readiness/dns-tls-ingress-certification.md](readiness/dns-tls-ingress-certification.md) |
| Backup / restore | [readiness/backup-restore-certification.md](readiness/backup-restore-certification.md) |
| Configuration (fail-closed) | [readiness/production-config-certification.md](readiness/production-config-certification.md) |
| Production/staging isolation | [readiness/production-staging-isolation-certification.md](readiness/production-staging-isolation-certification.md) |
| Live infrastructure state | [nzila-infrastructure-convergence/final-live-infrastructure-certification.md](nzila-infrastructure-convergence/final-live-infrastructure-certification.md) |

## Notes (honest gaps)

- There is **no standalone security-certification document**. The security posture
  (secret handling, key/token rotation closure, no plaintext secrets) is recorded in
  the **Exceptions** section of [readiness/production-certification.md](readiness/production-certification.md).
  No security claim beyond that document is made here.
- This pack is an index only; it introduces no commercial, pricing, or contractual
  terms. Those, if required, must be supplied separately by the business owner.
