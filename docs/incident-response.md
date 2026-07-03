# Incident Response — Canonical Index

> This is the **canonical entrypoint** for production incident response in
> `nzila-os`. It does not restate procedures; it points to the authoritative
> operational documents already maintained in the repository.

- **Last updated:** 2026-07-03
- **Production-readiness baseline commit:** `e01319325421cb25fc96c52b01f9dde498458aed`
- **Verdict authority:** [readiness/production-certification.md](readiness/production-certification.md)

## Source of truth

| Purpose | Authoritative document |
| --- | --- |
| Operational incident-response runbook (triage, severity, comms, escalation) | [runbooks/production-incident-response.md](runbooks/production-incident-response.md) |
| Rollback procedure (revision/digest revert, DB PITR) | [runbooks/production-rollback.md](runbooks/production-rollback.md) |
| Canonical production verdict + exceptions | [readiness/production-certification.md](readiness/production-certification.md) |
| Live infrastructure state (envs, domains, health) | [nzila-infrastructure-convergence/final-live-infrastructure-certification.md](nzila-infrastructure-convergence/final-live-infrastructure-certification.md) |

## Notes (honest gaps)

- A dedicated `docs/readiness/operational-production-certification.md` referenced
  in earlier planning does **not** exist. The operational posture it would cover is
  currently captured by [runbooks/production-incident-response.md](runbooks/production-incident-response.md)
  and the operational sections of [readiness/production-certification.md](readiness/production-certification.md).
  No claim beyond those documents is made here.
