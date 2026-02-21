---
title: Platform Architecture
description: Overview of the Nzila technology backbone that powers all verticals.
category: Technical
order: 2
---

# Platform Architecture

The Nzila backbone is a multi-Org infrastructure layer that provides shared services to every product in the portfolio.

## Core Services

| Service | Technology | Purpose |
|---------|------------|---------|
| Authentication | Clerk | SSO, RBAC, session management |
| Web Framework | Next.js 16 (App Router) | Server-rendered React applications |
| Styling | Tailwind CSS v4 | Consistent design system |
| Deployment | Azure Static Web Apps | Global CDN, auto-scaling |
| CI/CD | GitHub Actions + Turborepo | Monorepo-aware build pipelines |
| Analytics | Custom Python pipeline | Portfolio-level reporting |

## Design Principles

1. **Convention over configuration** — Shared configs reduce per-app boilerplate.
2. **Content/code separation** — Markdown content is curated separately from application code.
3. **Progressive enhancement** — Start with static rendering, add interactivity where needed.
4. **Security by default** — Auth middleware protects all internal routes automatically.
