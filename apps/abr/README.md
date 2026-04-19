# @nzila/abr

ABR Insight OS is NzilaOS's Canada-first enterprise operating system for Anti-Black racism prevention, response, accountability, learning, and measurable institutional change.

ABR is not a generic DEI LMS, generic complaint tracker, or generic legaltech tool. It is institutional accountability infrastructure.

## Canonical Product Definition

ABR Insight OS is designed for serious Canadian institutions that need auditable, privacy-safe, evidence-based operating workflows for Anti-Black racism governance.

Core principles:

- Canada-first legal and institutional context
- Bilingual by design (EN/FR)
- Privacy-first evidence handling and access controls
- Evidence-based operations, not symbolic reporting
- Measurable outcomes tied to policy, learning, and remediation

## Stack

- **Framework:** Next.js 16 (App Router) + Django backend sidecar
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS v4
- **AI:** `@nzila/ai-sdk` + `@nzila/ml-sdk`
- **Port:** 3004

## Quick Start

```bash
pnpm dev:abr          # or: cd apps/abr && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values.

### Required Env Vars

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session encryption |
| `AZURE_AD_CLIENT_ID` / `SECRET` / `TENANT_ID` | Entra SSO (optional) |
| `NEXT_PUBLIC_API_URL` | Django backend URL (default `http://localhost:8000`) |

## Django Backend

The `backend/` directory contains a Django app providing AI analytics, billing, compliance, and notification services.

```bash
cd apps/abr/backend
pip install -r requirements.txt
python manage.py runserver 8000
```

## Core Modules

1. Tribunal Intelligence
2. Learning and Certification
3. Incident Response
4. Accountability Analytics
5. Executive Governance
6. Shared Enterprise Core

## Sprint 2 Delivered

- Persistent ABR incident, events, actions, notes, learning assignment, and daily metrics tables.
- Incident lifecycle engine with strict transition enforcement.
- Assignment, reassignment, ownership, and due-date accountability workflows.
- Incident chronology timeline with event + notes + remediation traces.
- Remediation tracker with owner, due date, status, and evidence-ready fields.
- Executive-ready operational dashboard metrics and export endpoints.
- Seeded demo organizations, users, incidents, actions, and notes for buyer walkthroughs.
- Org-isolated access path enforced in API routes and service queries.

## Sprint 3 Delivered

- Tribunal intelligence explorer with Canadian ABR case records, filters, source status, freshness, and case detail views.
- Intelligence ingestion governance layer with source registry, import jobs, stale-source awareness, and manual review queue.
- Premium executive governance views for CHRO, CEO/COO, Board, and public-sector audiences.
- Enterprise learning surfaces with courses, cohorts, assignments, certifications, and incident-linked recommendations.
- Demo-mode buyer walkthrough support for seeded institutions using `?demo=true`.
- Procurement, trust, and ROI in-product surfaces plus buyer-ready reports and outbound pipeline assets.

## Sprint 4 Delivered (ABR Final-Delta)

**Intelligence Persistence & Governance**
- Converted intelligence from seeded-only to persistent runtime storage: `sources`, `cases`, `ingest_jobs`, `review_queue` tables.
- CSV/JSON import job wrapper (`intelligence-ingest.ts`) for institutional data ingestion with duplicate handling and confidence scoring.
- Demo/pilot/production data separation at service level to prevent seeded walkthrough data from mixing with live imports.
- Source registry, case metadata, ingest job status, and manual review queue entries all persistable and queryable.

**Incident Governance & Role-Based Redaction**
- Fine-grained note scopes wired at service boundary (query-time redaction in `incidents/service.ts`).
- Role-based incident retrieval with automatic redaction of sensitive notes per user role.
- Demo seed updated to use new visibility contract with explicit scope metadata.
- Async/await calls properly propagated across all intelligence service callers.

**Export Layer & Go-To-Market Pipeline**
- Three dedicated REST export endpoints: `/api/abr/export/executive-summary`, `/api/abr/export/incidents`, `/api/abr/export/remediation`.
- Role-aware filtering for all export artifacts (executive-safe summaries, redacted incident notes, role-filtered remediation views).
- Central export module (`governance/export.ts`) for consistent role-based output across all artifact types.
- CRM-linked pipeline service (`pipeline/service.ts`) for tracking demo→proposal→procurement→close activities with operator visibility.
- Dedicated pipeline operator dashboard page (`[locale]/dashboard/pipeline/`) with execution state and CRM link surface.

**Bilingual Dashboard Coverage**
- English/French message catalogs (`en-CA.json`, `fr-CA.json`) fully populated for dashboard chrome and core operator pages.
- All core operator pages localized: intelligence discovery, governance, learning, ROI, trust, and pipeline tracking.
- Locale-aware routing and navigation functional across all ABR dashboard surfaces.

**Validation & Quality**
- Full workspace typecheck passing (no type errors or regressions).
- 6/6 ABR smoke tests passing (intelligence ingest, export role-filtering, pipeline state, bilingual rendering).
- Async/await regressions resolved across all intelligence service callers.
- Duplicate fields corrected in export module schemas.

## Platform Reuse (No Duplicate Infrastructure)

ABR reuses NzilaOS shared core capabilities:

- Auth and session management (`@nzila/platform-auth`)
- RBAC and org isolation controls
- Billing and packaging systems
- Audit logging and evidence chain standards
- Export infrastructure (CSV/PDF/PPT-ready content pipelines)
- Notification patterns
- Observability and operational telemetry
- Test harness and governance gates
- Localization foundation (EN/FR)
