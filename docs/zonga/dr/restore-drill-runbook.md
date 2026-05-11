# Zonga Restore Drill Runbook

Zonga restore drill execution steps:
- pnpm dr:drill:checklist --live
- pnpm db:restore-drill:execute
- reports/dr/restore-drill-YYYY-MM-DD.md

Evidence tag prefix: zonga_drill_

Recovery targets:
- RTO target: 4 hours
- RPO target: 1 hour
