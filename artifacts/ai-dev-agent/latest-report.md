# Nzila AI Agent Runner Report

- Generated: 2026-05-04T01:55:10.643Z
- Phase: validate
- Decision: GO
- Risk Level: low

## Stages
- implementation (PASS)
  - pnpm.cmd typecheck => PASS
  - pnpm.cmd lint => PASS
- security-governance (PASS)
  - pnpm.cmd prod:region:validate => PASS
  - pnpm.cmd typecheck => PASS
  - pnpm.cmd lint => PASS
  - pnpm.cmd test:fast => PASS
  - pnpm.cmd governance:check => PASS
  - pnpm.cmd decision:coverage:strict => PASS
  - pnpm.cmd ue:qa:gate -- --target ux => PASS
  - pnpm.cmd intelligence:pipeline-health => PASS
  - pnpm.cmd nar:chain:verify => PASS
  - pnpm.cmd validate:claims => PASS
  - pnpm.cmd sre:alerts:dry-run => PASS

## Changed Files
- rtifacts/ue-qa/latest-results.json
- rtifacts/ue-qa/qa-report.json
- rtifacts/ue-qa/qa-report.md
- rtifacts/ue-qa/readiness-summary.md
- eports/claim-verification.json
- eports/claim-verification.md
- eports/sre-alert-routing-dry-run.json
- eports/unsafe-claims.md

## Remaining Gaps
- none
