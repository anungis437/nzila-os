# Access Control Model

## Principles

- Least privilege for operational roles.
- Authenticated access to internal consoles and admin surfaces.
- Organization-scoped data access in platform workflows.

## Model

- Email/password and optional Entra-based auth model in platform auth package.
- Session-driven auth with lockout controls and auditability.
- Internal surfaces marked non-indexable to reduce accidental discoverability.

## Known Gaps

- Some workflow-level role attestations are process-based and should be formalized in periodic access review artifacts.

## Source

- `docs/commercial/claims-ledger.md`
- `docs/commercial/vendor-risk-pack/access-control-model.md`
