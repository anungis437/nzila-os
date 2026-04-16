# Nzila OS — Canonical Repo Inventory

> Auto-generated on 2026-04-16 by `tooling/repo-inventory`. Do not edit manually.

## Summary

| Metric | Count |
|--------|-------|
| Apps | 17 |
| Packages | 166 |
| GitHub Workflows | 35 |
| Contract Test Files | 195 |
| TS/JS Test Files | 1146 |
| Python Test Files | 31 |

## Apps

| App | Framework | Port | README | .env.example | platform-shell | platform-auth | Code Files | Purpose |
|-----|-----------|------|--------|--------------|----------------|---------------|------------|---------|
| abr | Next.js + Django | 3014 | ✅ | ✅ | ✅ | ✅ | 202 | Agricultural Business Review — compliance audits, analytics, and Django-backed A |
| agrimo | Next.js + Django | 3007 | ✅ | ✅ | ✅ | ✅ | 100 | Agricultural field operations — harvest tracking, production management, logisti |
| cfo | Next.js | 3005 | ✅ | ✅ | ✅ | ✅ | 234 | CFO finance dashboard — ledger management, tax tools, AI advisory, document inte |
| console | Next.js | 3001 | ✅ | ✅ | ✅ | ✅ | 206 | Internal operations console — platform governance, compliance, analytics, integr |
| control-plane | Next.js | 3010 | ✅ | ✅ | ✅ | ✅ | 200 | Platform control plane — multi-tenant governance, workflow orchestration, anomal |
| cora | Next.js | 3009 | ✅ | ✅ | ✅ | ✅ | 37 | Agricultural intelligence dashboard — yield forecasting, price signals, risk ana |
| flow | Next.js | 3003 | ✅ | ✅ | ✅ | ✅ | 319 | Commerce vertical — end-to-end order management, quoting, invoicing, inventory,  |
| mobility | Next.js | 3012 | ✅ | ✅ | ✅ | ✅ | 36 | Investment migration advisory platform — case management, program intelligence,  |
| mobility-client-portal | Next.js | 3013 | ✅ | ✅ | ❌ | ✅ | 32 | Client-facing portal for investment migration applicants to track cases, upload  |
| nacp-exams | Next.js | 3011 | ✅ | ✅ | ✅ | ✅ | 61 | National Anti-Corruption Programme examination and assessment platform. |
| orchestrator-api | Fastify | — | ✅ | ✅ | ❌ | ❌ | 26 | Fastify-based API server for workflow orchestration, job dispatch, and platform  |
| partners | Next.js | 3004 | ✅ | ✅ | ✅ | ✅ | 100 | Partner portal for managing deals, commissions, certifications, and go-to-market |
| platform-admin | Next.js | 3015 | ✅ | ✅ | ✅ | ✅ | 29 | Internal admin console for managing platform services — events, knowledge, ontol |
| trade | Next.js | 3008 | ✅ | ✅ | ✅ | ✅ | 51 | Cross-border trade management — deals, listings, shipments, and commission track |
| union-eyes | Next.js + Django | 3002 | ✅ | ✅ | ✅ | ✅ | 3132 | Full-stack union case management platform — grievance lifecycle, collective barg |
| web | Next.js | 3000 | ✅ | ✅ | ❌ | ✅ | 60 | Public marketing site for the Nzila platform — landing pages, resource library,  |
| zonga | Next.js + Django | 3006 | ✅ | ✅ | ✅ | ✅ | 402 | Africa-first music distribution, streaming, and royalty management platform. |

## Workflows

- agri-core-check.yml
- agri-gov-ingestion-check.yml
- ai-governance.yml
- app-floor-check.yml
- canary-deploy.yml
- ci.yml
- compliance-drift.yml
- compliance.yml
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
- game-day.yml
- gitops-deploy.yml
- lighthouse.yml
- nzila-governance.yml
- nzila-playbook-runner.yml
- ops-pack.yml
- platform-automation.yml
- preview-deploy.yml
- red-team.yml
- release-train.yml
- repo-inventory-check.yml
- sbom.yml
- secret-scan.yml
- security-design-review.yml
- trivy.yml
- zonga-check.yml
