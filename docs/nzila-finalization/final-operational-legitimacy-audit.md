# Final Operational Legitimacy Audit

Authority: `master-finalization-index.md`. As of 2026-07-03.

Machine-readable audit: `proof-artifacts/finalization/legitimacy-audit.json` (8
domains, all PASS). Each verdict maps to a live `az` read or a passing gate.

| Domain | Verdict | Evidence |
| --- | --- | --- |
| governance-legitimacy | PASS | surface/deploy-authority/br6/gate-authority gates green |
| operational-legitimacy | PASS | prod apps HTTP 200 on production domains |
| rollout-legitimacy | PASS | digest-pinned promotion; env-scoped OIDC federated credential |
| restoration-legitimacy | PASS | backup + restore-drill server; rollback via prior known-good revision |
| isolation-legitimacy | PASS | dedicated prod RG/env/DB/Log-Analytics |
| config-legitimacy | PASS | NODE_ENV=production; no default-org fallback; secrets in store |
| identity-legitimacy | PASS | OIDC subject `repo:anungis437/nzila-os:environment:production` (not wildcard) |
| evidence-legitimacy | PASS | corpus grounded in az + gates; no fabricated evidence; human GO by approver |

No domain is asserted PASS without corresponding executable or Azure evidence.
