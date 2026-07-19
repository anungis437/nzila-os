# Full Release / Rollback Legitimacy

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE: rollback to prior known-good digest/revision (union-eyes …--0000173 retained). deploy-production consumes digest-verified staging artifact (subject-digest sha256). DB PITR 30d + restore-drill server. Runbooks: docs/runbooks/production-rollback.md, production-incident-response.md.
