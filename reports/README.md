# Reports

This directory contains canonical and generated reports.

## Category Structure

Reports are organized by domain for easy discovery:

| Category | Purpose |
|----------|---------|
| [**audits/**](./audits/) | Audit reports, assessments, technical compliance |
| [**financial/**](./financial/) | Revenue forecasting, capital allocation, economics |
| [**operational/**](./operational/) | Readiness assessments, deployment models, ops guidance |
| [**dashboards/**](./dashboards/) | Portfolio status, monitoring snapshots |
| [**strategic/**](./strategic/) | Go-live decisions, product strategy, planning |
| [**product-reports/**](./product-reports/) | Product-specific reports (union-eyes, zonga, console, agrimo) |

Existing folders:

- `archive/` — Legacy reports and historical artifacts
- `archive/repo-root-cleanup-2026-05-22/` — Root diagnostics and temporary artifacts relocated during repository-wide cleaning pass
- `commercial/` — Commercial strategy and positioning
- `compliance/` — Compliance and regulatory reports
- `coverage/` — Test coverage and quality metrics
- `db/` — Database and schema reports
- `dr/` — Disaster recovery and business continuity
- `investor/` — Investor-facing materials
- `ops/` — Operational procedures and runbooks
- `release/` — Release notes and deployment records
- `releases/` — Release announcements
- `runtime/` — Runtime performance and metrics
- `security/` — Security assessments and hardening
- `strategy/` — Strategic planning and positioning

Product-specific reports are consolidated under `product-reports/`.

## Canonical Truth

- `final-repo-scorecard.md` → [audits/](./audits/)
- `final-10-blocker-audit.md` → [audits/](./audits/)
- `final-focus-matrix.md` → [strategic/](./strategic/)
- `console-value-proof.md` → [operational/](./operational/)

**Rule**: Any report that conflicts with canonical truth must be archived, not left active.
