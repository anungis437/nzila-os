# 04 — Technology

## Objective

Summarize the shared platform technology, architecture, deployment, and engineering-operating evidence behind the Nzila product portfolio.

## Evidence Summary

- **Nzila OS is architected as shared decision infrastructure across multiple product surfaces.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `packages/decision-core/`.
- **The repository uses a monorepo structure with pnpm workspaces and Turborepo.** **Confidence: Verified.** Evidence: `README.md`, `package.json`.
- **Authentication is centralized in @nzila/platform-auth.** **Confidence: Verified.** Evidence: `README.md`, `packages/platform-auth/package.json`, `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.
- **Production-readiness artifacts exist for selected live runtimes.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-certification.md`, `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md`.

## Shared Technology Platform

| Platform element | Assessment | Confidence | Evidence |
|---|---|---|---|
| Decision core | Canonical decision primitives exported from @nzila/decision-core | Verified | `README.md`, `packages/decision-core/package.json` |
| Shared database layer | Central Drizzle-based package @nzila/db | Verified | `packages/db/package.json`, `README.md` |
| Shared UI | Cross-app UI package @nzila/ui | Verified | `packages/ui/package.json` |
| Pilot proof layer | Dedicated pilot metrics package @nzila/platform-pilot-metrics | Verified | `packages/platform-pilot-metrics/package.json` |
| Auth authority | One platform auth package for identity, authz, password, magic link, invites, MFA, and Entra | Verified | `packages/platform-auth/package.json` |

## Authentication / Authorization

- **Canonical auth authority:** `README.md` and `governance/platform-package-authority.json` designate @nzila/platform-auth as authoritative. **Confidence: Verified.**
- **Auth capability surface:** email/password, magic link, invites, MFA, risk scoring, and Entra components are exported from @nzila/platform-auth. **Confidence: Verified.** Evidence: `packages/platform-auth/package.json`.
- **Per-org auth policy model and audit logging are documented for Union Eyes.** **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AUTH_MODEL.md`.

## Multi-Tenant Architecture

- **Org-scoped by construction** is a repeated platform claim and is supported by repository artifacts around RLS, org scoping, and control maps. **Confidence: Verified.** Evidence: `README.business.md`, `SECURITY.md`, `docs/union-eyes/pilot-evidence-pack/ORG_ISOLATION_CONTROL_MAP.md`, `ARCHITECTURE.md`.
- **Row-level security and org-guard patterns are explicit.** **Confidence: Demonstrated.** Evidence: `docs/union-eyes/pilot-evidence-pack/SECURITY_BUYER_PACK.md`, `docs/union-eyes/pilot-evidence-pack/CI_GOVERNANCE_EVIDENCE.md`, `tooling/contract-tests/ue-org-column-audit.test.ts` referenced in SOC 2 evidence inventory.

## AI / ML Capabilities

- **Centralized AI consumption model:** apps consume `packages/ai-sdk/package.json` and `packages/ml-sdk/package.json`; direct provider imports are prohibited by repo contract. **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `CONTRIBUTING.md`, app `package.json` files.
- **Governed AI posture:** the platform documents advisory-only AI boundaries, confidence envelopes, route guards, and auditability expectations. **Confidence: Documented.** Evidence: `docs/categories/platform-and-operations/security/UNION_EYES_AI_RUNTIME_AND_GOVERNANCE.md`, `SECURITY.md`.
- **AI maturity is uneven by surface.** **Confidence: Verified.** Evidence: the AI runtime doc explicitly records control gaps and a “PASS WITH CONDITIONS” posture.

## Document / Evidence Engine

- **Evidence-pack capability is clearly implemented.** **Confidence: Demonstrated.** Evidence: `ARCHITECTURE.md`, `SECURITY.md`, `apps/union-eyes/lib/evidence-export.ts` as cited in buyer packs and SOC 2 evidence inventory.
- **One repository-wide standalone “document engine” package was not identified during review.** **Confidence: Not Yet Evidenced.** Evidence: package and docs review.

## Workflow Engine

- **Workflow is a first-class platform concern.** **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `governed-workflow` package in `packages/`, `apps/orchestrator-api`, `flow-engine` package, `package.json` release and workflow scripts.
- **Orchestrator API is described as the authoritative execution backbone.** **Confidence: Documented.** Evidence: `README.business.md`, `ARCHITECTURE.md`.

## Azure Deployment Infrastructure

- **Azure is the canonical cloud platform.** **Confidence: Verified.** Evidence: `README.md`, `ARCHITECTURE.md`, `docs/readiness/production-certification.md`, `docs/readiness/platform-production-runtime-inventory.md`.
- **Production certification is currently documented for Union Eyes, Web, and Partners.** **Confidence: Demonstrated.** Evidence: `docs/readiness/production-ready-release-summary.md`, `docs/readiness/platform-production-runtime-inventory.md`.
- **Container Apps, Blob, Key Vault, and PostgreSQL Flexible Server recur throughout the repo as operative infrastructure.** **Confidence: Verified.**

## CI/CD and Governance Automation

- **Repository-observed workflow count:** 52 workflow files under `.github/workflows/` as of 2026-08-01 repository scan. **Confidence: Verified.**
- **Published workflow count:** `README.md` states 47 workflows; this is slightly stale relative to current repository contents. **Confidence: Verified.**
- **Workflow categories cover CI, deployments, compliance, security, DAST, SBOM, release governance, red-team, and reliability.** **Confidence: Verified.** Evidence: `.github/workflows/` directory contents, `README.md`, `SECURITY.md`.

## PostgreSQL + Drizzle ORM

- **The shared platform uses PostgreSQL and Drizzle ORM.** **Confidence: Verified.** Evidence: `README.md`, `packages/db/package.json`, `ARCHITECTURE.md`.
- **Union Eyes additionally uses Django ORM on the authoritative backend.** **Confidence: Verified.** Evidence: `apps/union-eyes/README.md`.

## Monorepo Structure

- **pnpm + Turborepo are the canonical workspace tools.** **Confidence: Verified.** Evidence: `README.md`, `package.json`.
- **Repo scale:** 26 app directories and 225 package directories were present at review time. **Confidence: Verified.** Evidence: `apps/`, `packages/`.

## Shared UI and API Architecture

- **Shared UI package:** @nzila/ui. **Confidence: Verified.** Evidence: `packages/ui/package.json`.
- **API architecture:** Next.js app routes, Fastify orchestrator API, and app-specific backend/service patterns are all documented. **Confidence: Verified.** Evidence: `ARCHITECTURE.md`, `apps/union-eyes/README.md`, `README.business.md`.

## Supporting Artifacts

- `README.md`
- `ARCHITECTURE.md`
- `package.json`
- `packages/decision-core/package.json`
- `packages/platform-auth/package.json`
- `packages/db/package.json`
- `packages/ui/package.json`
- `packages/platform-pilot-metrics/package.json`
- `governance/platform-package-authority.json`
- `docs/readiness/production-certification.md`
- `.github/workflows/`

## Current Maturity

The shared technology platform is the strongest part of the dossier. It is richly evidenced, repeatable, and tied to release and proof systems. Product-specific production evidence is strongest for Union Eyes and shared platform infrastructure, not uniformly across all commercial surfaces.

## Commercialization Relevance

This technology base supports arguments for scalability, shared-cost leverage, faster productization, and stronger procurement posture. It is directly relevant to lenders and partners assessing execution capacity.

## Gaps

- Repo-wide architecture counts in published docs lag the current directory state.
- AI governance is substantial but not uniformly proven on every AI route.
- A single repo-wide document-engine abstraction is not clearly surfaced as a named package.

## Next Milestone

Publish a single, current platform fact sheet that reconciles live counts, production-certified surfaces, and shared package authorities for external diligence use.
