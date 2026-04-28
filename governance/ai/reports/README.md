# AIGC Reports

This folder holds the reports the AI Governance Committee (AIGC) produces
or consumes. It is the auditable trail for assurance, decisions, and
incident review.

## Cadence

| Report | Cadence | Author | Reviewer | Stored as |
|--------|---------|--------|----------|-----------|
| Standing meeting minutes | Monthly (≥ quarterly minimum per charter) | AIGC Chair | All voting members | `minutes/YYYY-MM-DD.md` from [`AIGC-minutes-template.md`](AIGC-minutes-template.md) |
| Decision minutes | Per decision meeting | AIGC Chair | All voting members | `minutes/YYYY-MM-DD-decision-<slug>.md` |
| Incident review minutes | Per AI incident (severity ≥ Medium) | AIGC Chair + Incident Owner | AIGC | `minutes/YYYY-MM-DD-incident-<id>.md` |
| Monthly assurance report | Monthly | AI Lead (with Engineering) | AIGC | `monthly/YYYY-MM.md` from [`AIGC-monthly-template.md`](AIGC-monthly-template.md) |
| Annual review | Yearly | AIGC Chair | Board / Executive | `annual/YYYY.md` |

## Who writes what

- **AI Lead** prepares the monthly assurance report (with input from
  Engineering, Privacy, Security, and surface owners).
- **AIGC Chair** records minutes for every committee meeting.
- **Surface owners** present quarterly per-surface reviews into the
  monthly report.
- **Privacy Lead / DPO** signs off on PIA-related items in the report.
- **Security Lead / CISO** signs off on incident sections.

## Where they live

- This directory is source-controlled — every report is a markdown file
  in `governance/ai/reports/`.
- Subfolders (`minutes/`, `monthly/`, `annual/`) are created on first
  use; until then the templates live at the root.
- Sensitive attachments (e.g., raw incident logs containing PII) are
  **not** committed — link to the secure store and reference by ID.

## Retention

- Minutes and monthly reports: retained for the life of the company
  (auditable trail).
- Drafts: kept until ratified, then either committed or deleted.
- Per [`governance/privacy/policies/retention-schedule.md`](../../privacy/policies/retention-schedule.md).

## Templates

- [`AIGC-minutes-template.md`](AIGC-minutes-template.md) — standing /
  decision / incident minutes
- [`AIGC-monthly-template.md`](AIGC-monthly-template.md) — monthly
  assurance report

## See also

- Charter: [`governance/ai/aigc-charter.md`](../aigc-charter.md)
- Lifecycle gates: [`governance/ai/lifecycle-gates.md`](../lifecycle-gates.md)
- Inventory (machine-readable): [`governance/ai/inventory.json`](../inventory.json)
