# Web Domain Model

## Purpose
The web app is Nzila's public-facing growth and trust surface. It captures demand, communicates proof, and routes qualified interest into governed internal workflows.

## Core Domain Entities

## Lead
- id: string
- name: string
- email: string
- company?: string
- vertical?: string
- message?: string
- source: string
- utmSource?: string
- utmMedium?: string
- utmCampaign?: string
- createdAt: string

Business rules:
- `email` must be valid.
- Honeypot `website` must remain empty.
- Leads are rate-limited by client IP window.

## Marketing Event
- event: string
- page?: string
- ts?: string
- properties?: Record<string, unknown>

Business rules:
- Payload must pass schema validation.
- Payload size is capped to protect endpoint reliability.

## Published Content
- slug: string
- title: string
- status: 'draft' | 'published' | 'archived'
- author: string

Business rules:
- Slug is generated and must be stable for canonical routing.
- Only published content is surfaced publicly.

## Bounded Contexts
- Acquisition: lead capture, attribution, conversion telemetry.
- Trust & Proof: governance/evidence exports and policy status endpoints.
- Publishing: marketing content lifecycle and localization.

## External Integrations
- HubSpot: contact and deal synchronization for qualified inquiries.
- Platform Auth: role-aware internal/partner surfaces where applicable.
- Telemetry Pipeline: structured event ingestion for analytics.

## Quality Invariants
- `/api/health` and `/api/metrics` must remain stable.
- Contact capture must enforce schema validation and anti-spam controls.
- Telemetry route must reject invalid/oversized payloads.
- Evidence export route must remain available for auditability.
