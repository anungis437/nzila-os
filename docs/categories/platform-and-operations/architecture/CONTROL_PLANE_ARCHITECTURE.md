# Control Plane Architecture

## Overview

The Control Plane is the executive and operator entry point for Nzila OS.
It provides a unified dashboard across governance, intelligence, anomaly
detection, agent workflows, module health, and procurement evidence.

## Design Principles

1. **No parallel architecture** — every feature is backed by an existing
   `@nzila/platform-*` package. The control plane is a presentation layer only.
2. **Zod-validated APIs** — every API route validates responses at runtime.
3. **Server Components first** — pages are RSC by default; client components
   are used only for interactivity (query box, sidebar nav).
4. **Four UI states** — every data section handles loading, empty, error, and success.
5. **Read-only agent workflows** — recommendations are displayed for human review;
   the UI never triggers autonomous mutations.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane UI                       │
│  Next.js App Router — RSC + Client Components            │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Overview  │ │Governance│ │ Intelli. │ │Anomalies │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │  Agents  │ │ Modules  │ │Procurem. │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
└───────────────────────┬─────────────────────────────────┘
                        │ server/data.ts
                        │ (Zod-validated)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Platform Packages                       │
│                                                           │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │ governance       │  │ intelligence     │               │
│  │ ai-query         │  │ anomaly-engine   │               │
│  │ agent-workflows  │  │ ai-governance    │               │
│  │ procurement-proof│  │ compliance-snap. │               │
│  │ evidence-pack    │  │ policy-engine    │               │
│  │ observability    │  │                  │               │
│  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

## Pages & Routes

| Route | Page | Data Source |
|---|---|---|
| `/overview` | Platform dashboard | All packages (aggregated) |
| `/governance` | Governance status & timeline | `platform-governance` |
| `/intelligence` | Insights, signals, natural-language query | `platform-intelligence`, `platform-ai-query` |
| `/anomalies` | Anomaly cards with severity & recommendation | `platform-anomaly-engine` |
| `/agents` | AI recommendations (human-review only) | `platform-agent-workflows` |
| `/modules` | Module registry with health & governance | All module metadata |
| `/procurement` | Evidence pack viewer | `platform-procurement-proof` |

## API Routes

All API routes are under `/api/control-plane/` and return `{ ok: boolean, data: T }`.

- `GET /governance/status` — Governance status
- `GET /governance/timeline` — Audit timeline entries
- `GET /intelligence/summary` — Cross-app insights
- `POST /intelligence/query` — Natural-language query (Zod-validated input)
- `GET /intelligence/signals` — Operational signals
- `GET /anomalies` — All anomalies
- `GET /anomalies/:id` — Single anomaly by ID
- `GET /agents/recommendations` — Agent recommendations
- `GET /modules` — Module registry
- `GET /procurement/latest` — Latest procurement pack
- `GET /procurement/public-key` — Pack signing public key
- `POST /procurement/validate` — Validate pack signature (Zod-validated input)

## Data Flow

```
Request → Next.js Route Handler
  → server/data.ts (server-only)
    → Try platform package adapter
    → Fallback to demo seed data
    → Zod.parse() validation
  → JSON response
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19 Server Components
- **Styling**: Tailwind CSS 4
- **Validation**: Zod
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Build**: Turbo (monorepo pipeline)
