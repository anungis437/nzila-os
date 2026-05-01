# Platform Admin

> Internal admin console for managing platform services — events, knowledge, ontology, and more.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS
- **Port:** 3015

## Quick Start

```bash
cd apps/platform-admin && pnpm dev
```

No `.env.example` — see `@nzila/os-core` env schema for required variables.

## Sections

| Route | Purpose |
|-------|---------|
| `/data-fabric` | Data fabric management |
| `/decisions` | Decision graph explorer |
| `/entity-graph` | Entity relationship viewer |
| `/events` | Event fabric browser |
| `/knowledge` | Knowledge registry admin |
| `/ontology` | Ontology management |
| `/orchestrator-ops` | Orchestrator operations |
| `/platform-health` | Health & diagnostics |
| `/reasoning` | Reasoning engine inspector |
| `/search` | Semantic search admin |

## Domain

Internal operations dashboard exposing all platform intelligence subsystems. Used by platform engineers and admins to inspect execution runs, manage the knowledge graph, monitor event flows, and debug reasoning/decision pipelines.

## Environment Variables

See `@nzila/os-core` env schema for required variables (`AUTH_SECRET`, `DATABASE_URL`, Entra SSO config).
