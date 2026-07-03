# Full Production Readiness Hardening

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE hardening closed: surface freeze, deploy authority (OIDC, no long-lived credential), BR-6 org substrate fail-closed, isolated prod runtime, digest-pinned artifacts, DNS/TLS cutover. Tracked exceptions (PARTIAL): storage key + API token rotation, apex cert, prod alert rules. Detail: docs/readiness/full-production-readiness-delta.md.
