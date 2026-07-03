# Full E2E Environment Validation

Authority: docs/nzila-finalization/master-finalization-index.md
As of 2026-07-03. Verified via Azure CLI + live HTTPS smoke + repo gates.

LIVE runtime validation of the production surface (build to deploy to verify to domain cutover) is recorded in proof-artifacts/rollout-attestations/finalization-attestations.jsonl. Automated cross-app Playwright E2E is DEFERRED/PARTIAL and tracked separately (apps/union-eyes/playwright.config.ts; .github/workflows/e2e.yml).
