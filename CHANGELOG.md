# Changelog

All notable changes to the Nzila Automation platform will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.0.0] — 2026-03-08

NzilaOS v1.0.0 — Union-Eyes GA release. 100 merged PRs, 7,669+ tests, 0 TypeScript errors, all CI workflows green, Azure deployed.

### Highlights
- **Union-Eyes (CAPE)**: Full collective agreement processing engine — parsing, interpretation, grievance tracking, employer templates, steward workload management, per-org representation protocol, draft recovery, E2E pilot readiness.
- **Platform**: 13 apps (web, console, partners, union-eyes, abr, cfo, orchestrator-api, trade, pondu, cora, zonga, nacp-exams, flow), 50+ shared packages, dual-stack Next.js 16 + Django 5.
- **Enterprise hardening**: RBAC, contract tests, SLO gating, SBOM generation, governance gate, secret scanning (Gitleaks + TruffleHog + Snyk), evidence packs, compliance workflow.
- **Azure**: Container Apps deployment pipeline, GitOps multi-app build (7 apps), ACR image registry, PostgreSQL Flexible Server, Key Vault, VNet.

### Added
- **Union-Eyes CAPE engine**: Agreement parsing, clause interpretation, grievance workflows, employer notice templates, steward workload dashboards, representation protocol, pilot readiness checks, audit report, demo flow.
- **Enterprise security**: Gitleaks monorepo config, pre-commit guardrails (Lefthook), CWE-798/614/89 remediation, security audit gaps closed.
- **Platform packages**: ai-core, ai-sdk, ml-core, ml-sdk, analytics, automation, commerce-core, commerce-audit, agri-core, agri-intelligence, agri-traceability, chatops-slack, chatops-teams, and 35+ more.
- **CI/CD pipelines**: CI (lint + typecheck + tests), GitOps Deploy (7-app matrix build), Deploy Union-Eyes, SBOM Generation, Governance Gate, Secret Scan, Compliance evidence collection.
- **Operational excellence**: SLO policies, cost policies, performance budgets, disaster recovery runbooks, incident response playbooks, on-call schedules, business continuity plans.
- **Documentation**: World-class READMEs (root + Union-Eyes), architecture docs, procurement pack, RFP generator, platform readiness assessment, enterprise readiness report.

### Fixed
- Docker builds: added `pnpm rebuild next` for next/server module resolution (#142).
- Docker builds: removed non-existent console/public COPY (#143).
- Compliance workflow: create evidence directory before writing (#144).
- GitOps Deploy: switched from unconfigured OIDC to AZURE_CREDENTIALS auth (#145).

### Infrastructure
- Azure cleanup: consolidated from 36 resources / 7 RGs to 11 resources / 1 core RG.
- Deleted stale App Service deployments (unioneyes-staging-rg, unioneyes-prod-rg).
- Scaled unused hello-world Container Apps to zero replicas.
- Single ACR (`nzilastagingacr`), single PostgreSQL server, single Key Vault.
