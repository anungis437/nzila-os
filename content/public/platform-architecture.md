---
title: Platform Architecture
description: Overview of the Nzila technology Backbone — the shared infrastructure layer that powers every vertical in the portfolio.
category: Technical
order: 2
date: 2026-02-01
---

## What is the Backbone?

The **Nzila Backbone** is a multi-Org infrastructure layer that provides shared services to every product in the portfolio. It is not a platform-as-a-service — it is an internal framework that enforces consistency, security, and quality across all verticals.

The Backbone philosophy: **build it once, secure it once, audit it once, and share it everywhere**.

---

## Core Services

### Technology Stack

| Service | Technology | Purpose |
|---------|------------|---------|
| Authentication | Email/password + Entra SSO | Identity, RBAC, session management, MFA |
| Web Framework | Next.js 16 (App Router) | Server-rendered React applications |
| Styling | Tailwind CSS v4 | Consistent design system |
| ORM / DB | Drizzle ORM + PostgreSQL | Type-safe queries with RLS enforcement |
| Deployment | Azure Static Web Apps | Global CDN, auto-scaling |
| CI/CD | GitHub Actions + Turborepo | Monorepo-aware build pipelines |
| Analytics | Custom Python pipeline | Portfolio-level reporting |
| Evidence | `@nzila/os-core` seal library | Tamper-evident governance artefacts |

### Repository Layout

The entire portfolio lives in a single **pnpm monorepo** managed by Turborepo:

```
nzila-automation/
├── apps/          # Production applications (Next.js, Django hybrids)
├── packages/      # Shared libraries (db, ui, os-core, ai-core, ...)
├── tooling/       # Contract tests, CI scripts, database tooling
├── content/       # Markdown content (public-facing + internal)
├── governance/    # Reports, compliance artifacts, evidence
└── docs/          # Architecture decision records, runbooks
```

---

## Design Principles

### 1. Convention over configuration

Shared configs (`tsconfig`, ESLint, Tailwind presets) reduce per-app boilerplate and enforce consistency. A new app can be scaffolded in minutes with all security and quality gates pre-configured.

### 2. Org isolation by default

Every database table that stores user or org data includes an `org_id` column. PostgreSQL Row-Level Security policies enforce isolation at the database layer — application bugs cannot leak cross-org data.

### 3. Progressive trust, not progressive security

Security controls are maximal from day one. Features are gated behind flags; security is not. There is no "we'll harden it later" in the Nzila Backbone.

### 4. Tamper-evident evidence

All CI runs produce a cryptographically sealed evidence pack (SHA-256 Merkle root + HMAC-SHA256). This provides a verifiable audit trail of every build, test run, and deployment.

---

## Org Isolation Architecture

```
┌────────────────────────────────────────┐
│       Auth Layer (platform-auth)       │
│  JWT contains: userId, orgId, roles    │
└───────────────┬────────────────────────┘
                │ orgId extracted server-side
┌───────────────▼────────────────────────┐
│         Application Layer              │
│  withRLSContext(db, orgId, userId)     │
│  Sets PostgreSQL session variables     │
└───────────────┬────────────────────────┘
                │ SET app.current_org_id = ?
┌───────────────▼────────────────────────┐
│         PostgreSQL + RLS               │
│  USING (org_id = current_org_id())     │
│  Enforced on every SELECT/INSERT       │
└────────────────────────────────────────┘
```

The `orgId` flows from the identity token — it is never accepted from user-supplied request parameters.

---

## Audit & Evidence Architecture

### Audit events

Every write operation (via the shared `withAudit()` wrapper or Django `AuditLogMiddleware`) produces an append-only audit record with:

- Actor: `userId` + `orgId`
- Action: namespaced string (e.g. `member.invite`)
- Entity: the affected resource ID
- SHA-256 content hash, linked to the previous event's hash

Database triggers prevent UPDATE and DELETE on audit tables at the PostgreSQL level.

### Evidence packs

At the end of every CI run, an evidence pack is assembled:

| Component | Contents |
|-----------|---------|
| `pack.json` | SBOM, test results, audit report, coverage, build metadata |
| `seal.json` | Merkle root + HMAC-SHA256 signature |

The `verifySeal()` function from `@nzila/os-core` is called as a blocking CI gate — any pack verification failure stops the pipeline.

---

## CI Governance Gates

Every pull request must pass these eight gates before merge:

1. **Secret scan** — Gitleaks + TruffleHog, zero tolerance
2. **Dependency audit** — CRITICAL CVEs block merge
3. **Trivy** — Container + filesystem CVE scan, CRITICAL = fail
4. **SBOM generation** — CycloneDX, licence policy validation
5. **Contract tests** — Cross-stack invariant enforcement
6. **UE evidence** — UnionEyes collect → seal → verify
7. **ABR evidence** — ABR collect → seal → verify
8. **Red-team** — Adversarial test suite (daily + on PR)

A `governance-gate` job joins all eight and exits 1 if any fails.

---

## Extending the Backbone

New verticals follow the scaffolding in `tech-repo-scaffold/`. The scaffold includes:

- Pre-configured Next.js with auth middleware
- Django backend with audit middleware + org isolation
- Evidence scripts (collect, seal, verify)
- CI workflow template with all 8 governance gates
- Contract test stubs for org isolation and audit coverage

A new vertical gets full governance coverage on day one, not after launch.
