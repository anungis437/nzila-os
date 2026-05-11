# Changelog

All notable changes to the Nzila Automation platform will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Union Eyes — Institutional Operating Intelligence Finalization v1
- **New kernel package** `@nzila/institutional-cognition-core`: pure, deterministic, organizationally-scoped institutional cognition primitives. 10 canonical cognition domains; explainability envelopes; intelligent + context-aware orchestration; deep-semantics taxonomy with lifecycle/drift validation.
- **Deep ontology governance**: canonical institutional taxonomy with parent inheritance, lifecycle status (active/deprecated/replaced), vocabulary bindings, breaking-drift detection. New CI violation code `ontology_lifecycle` enforces structural integrity in `tooling/governance/cognition-governance-ci.ts`.
- **Context-aware orchestration**: closed `COGNITION_EXECUTION_CONTEXTS` set (executive_briefing, governance_review, continuity_planning, incident_triage, longitudinal_review, standard) with deterministic per-context priority/budget/skipIfFeedersFailed policies. NO autonomous decisions — orchestration tunes scheduling only.
- **Institutional storytelling**: `composeInstitutionalStorybook()` projects multi-engine envelope sets into domain-grouped longitudinal narratives with chapters, taxonomy anchors, executive summaries, deduplicated review signals. Hard-fails on forbidden vocabulary.
- **Longitudinal cognition surface** (`/dashboard/longitudinal-cognition`): calm, anti-surveillance executive view of organizational story over time with confidence chips, taxonomy anchor pills, collapsible per-domain review signals.
- **Cognition route convergence**: 15 single-engine routes refactored to `cognitionRoute()`; 18 CRUD/parameterized routes pragma'd with `allow-route-bypass` rationale; full governance CI clean.
- **Wellbeing-framed organizer support**: relabeled organizer-support predictor outputs from "retention risk" → "burnout signal" to align with the file's stated "predict to support, not surveil" philosophy and labor-safe vocabulary policy.
- **Verification**: 29/29 kernel tests; 972/972 unit test files (17,076 tests) passing; full repo typecheck clean (208/208); lint clean (0 errors); governance:cognition CI clean.

### ABR Sprint 4 (Final-Delta)
- **Intelligence Persistence**: Converted intelligence from seeded-only to persistent runtime storage (sources, cases, ingest_jobs, review_queue tables).
- **Ingest Jobs**: CSV/JSON import wrapper with duplicate handling, confidence scoring, and review queue integration.
- **Role-Based Redaction**: Fine-grained note scopes wired at service boundary with query-time filtering per user role.
- **Export Endpoints**: Three REST endpoints for executive-summary, incidents, and remediation exports with role-aware redaction.
- **Go-to-Market Pipeline**: CRM-linked pipeline service for tracking demo→proposal→procurement→close activities with operator visibility.
- **Bilingual Dashboard**: Full English/French parity across all core operator surfaces (intelligence, governance, learning, ROI, trust, pipeline).
- **Validation**: Workspace typecheck passing, 6/6 smoke tests, all async/await regressions resolved.

## [1.0.0] — 2026-03-08

NzilaOS v1.0.0 — UnionEyes GA release. 100 merged PRs, 7,669+ tests, 0 TypeScript errors, all CI workflows green, Azure deployed.

### Highlights
- **UnionEyes (CAPE)**: Full collective agreement processing engine — parsing, interpretation, grievance tracking, employer templates, steward workload management, per-org representation protocol, draft recovery, E2E pilot readiness.
- **Platform**: 13 apps (web, console, partners, union-eyes, abr, cfo, orchestrator-api, trade, agrimo, cora, zonga, nacp-exams, flow), 50+ shared packages, dual-stack Next.js 16 + Django 5.
- **Enterprise hardening**: RBAC, contract tests, SLO gating, SBOM generation, governance gate, secret scanning (Gitleaks + TruffleHog + Snyk), evidence packs, compliance workflow.
- **Azure**: Container Apps deployment pipeline, GitOps multi-app build (7 apps), ACR image registry, PostgreSQL Flexible Server, Key Vault, VNet.

### Added
- **UnionEyes CAPE engine**: Agreement parsing, clause interpretation, grievance workflows, employer notice templates, steward workload dashboards, representation protocol, pilot readiness checks, audit report, demo flow.
- **Enterprise security**: Gitleaks monorepo config, pre-commit guardrails (Lefthook), CWE-798/614/89 remediation, security audit gaps closed.
- **Platform packages**: ai-core, ai-sdk, ml-core, ml-sdk, analytics, automation, commerce-core, commerce-audit, agri-core, agri-intelligence, agri-traceability, chatops-slack, chatops-teams, and 35+ more.
- **CI/CD pipelines**: CI (lint + typecheck + tests), GitOps Deploy (7-app matrix build), Deploy UnionEyes, SBOM Generation, Governance Gate, Secret Scan, Compliance evidence collection.
- **Operational excellence**: SLO policies, cost policies, performance budgets, disaster recovery runbooks, incident response playbooks, on-call schedules, business continuity plans.
- **Documentation**: World-class READMEs (root + UnionEyes), architecture docs, procurement pack, RFP generator, platform readiness assessment, enterprise readiness report.

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
