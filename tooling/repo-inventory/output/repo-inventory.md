# Nzila OS — Canonical Repo Inventory

> Auto-generated on 2026-05-01 by `tooling/repo-inventory`. Do not edit manually.

## Summary

| Metric | Count |
|--------|-------|
| Apps | 24 |
| Packages (packages/*) | 189 |
| Workspace Packages (apps|packages|services|tooling) | 219 |
| GitHub Workflows | 47 |
| Contract Test Files | 233 |
| TS/JS Test Files | 1290 |
| Python Test Files | 31 |

## Apps

| App | Framework | Port | README | .env.example | platform-shell | platform-auth | Code Files | Purpose |
|-----|-----------|------|--------|--------------|----------------|---------------|------------|---------|
| abr | Next.js + Django | 3014 | ✅ | ✅ | ✅ | ✅ | 248 | FAIRCASE (formerly ABR) — Canada-first enterprise operating system for Anti-Blac |
| agrimo | Next.js + Django | 3007 | ✅ | ✅ | ✅ | ✅ | 102 | Agricultural field operations — harvest tracking, production management, logisti |
| cfo | Next.js | 3005 | ✅ | ✅ | ✅ | ✅ | 237 | CFO finance dashboard — ledger management, tax tools, AI advisory, document inte |
| console | Next.js | 3001 | ✅ | ✅ | ✅ | ✅ | 355 | Internal operations console — platform governance, compliance, analytics, integr |
| control-plane | Next.js | 3010 | ✅ | ✅ | ✅ | ✅ | 250 | Platform control plane — multi-tenant governance, workflow orchestration, anomal |
| cora | Next.js | 3009 | ✅ | ✅ | ✅ | ✅ | 39 | Agricultural intelligence dashboard — yield forecasting, price signals, risk ana |
| flow | Next.js | 3003 | ✅ | ✅ | ✅ | ✅ | 346 | Commerce vertical — end-to-end order management, quoting, invoicing, inventory,  |
| maestria | Next.js | 3021 | ✅ | ✅ | ❌ | ✅ | 73 |  |
| mobility | Next.js | 3012 | ✅ | ✅ | ✅ | ✅ | 38 | Investment migration advisory platform — case management, program intelligence,  |
| mobility-client-portal | Next.js | 3013 | ✅ | ✅ | ❌ | ✅ | 32 | Client-facing portal for investment migration applicants to track cases, upload  |
| nacp-exams | Next.js | 3011 | ✅ | ✅ | ✅ | ✅ | 61 | National Anti-Corruption Programme examination and assessment platform. |
| nzila-hq | Next.js | 3020 | ✅ | ✅ | ❌ | ✅ | 105 |  |
| orchestrator-api | Fastify | — | ✅ | ✅ | ❌ | ❌ | 30 | Fastify-based API server for workflow orchestration, job dispatch, and platform  |
| partners | Next.js | 3004 | ✅ | ✅ | ✅ | ✅ | 107 | Partner portal for managing deals, commissions, certifications, and go-to-market |
| platform-admin | Next.js | 3015 | ✅ | ✅ | ✅ | ✅ | 37 | Internal admin console for managing platform services — events, knowledge, ontol |
| test-scaffold-gp | Next.js | — | ✅ | ✅ | ❌ | ✅ | 8 |  |
| trade | Next.js | 3008 | ✅ | ✅ | ✅ | ✅ | 53 | Cross-border trade management — deals, listings, shipments, and commission track |
| union-eyes | Next.js + Django | 3002 | ✅ | ✅ | ✅ | ✅ | 3191 | Full-stack union case management platform — grievance lifecycle, collective barg |
| veridian-admin | Next.js | 3012 | ✅ | ✅ | ❌ | ✅ | 18 |  |
| veridian-care | Next.js | 3011 | ✅ | ✅ | ❌ | ✅ | 21 |  |
| veridian-site | Next.js | 3010 | ✅ | ✅ | ❌ | ✅ | 21 |  |
| web | Next.js | 3000 | ✅ | ✅ | ❌ | ✅ | 81 | Public marketing site for the Nzila platform — landing pages, resource library,  |
| weekone | Next.js | 3016 | ✅ | ✅ | ✅ | ✅ | 97 |  |
| zonga | Next.js + Django | 3006 | ✅ | ✅ | ✅ | ✅ | 450 | Africa-first music distribution, streaming, and royalty management platform. |

## Workflows

- access-review-gate.yml
- agri-core-check.yml
- ai-governance.yml
- app-floor-check.yml
- branch-tag-governance.yml
- canary-deploy.yml
- capital-discipline.yml
- ci.yml
- compliance-drift.yml
- compliance.yml
- console-weekly-digest.yml
- continuous-guards.yml
- control-tests.yml
- cupe-pilot-readiness.yml
- dast.yml
- dependabot-auto-merge.yml
- dependency-audit.yml
- deploy-console.yml
- deploy-partners.yml
- deploy-production.yml
- deploy-staging.yml
- deploy-union-eyes.yml
- deploy-web.yml
- doc-hygiene.yml
- dr-drill-reminder.yml
- e2e.yml
- flow-shopmoica-cutover-gate.yml
- game-day.yml
- gitops-deploy.yml
- lighthouse.yml
- nzila-ga-gate.yml
- nzila-governance.yml
- nzila-playbook-runner.yml
- ops-pack.yml
- platform-automation.yml
- portfolio-governance.yml
- preview-deploy.yml
- red-team.yml
- release-governance.yml
- release-train.yml
- reliability-guard.yml
- repo-inventory-check.yml
- sbom.yml
- secret-scan.yml
- security-design-review.yml
- trivy.yml
- zonga-check.yml
