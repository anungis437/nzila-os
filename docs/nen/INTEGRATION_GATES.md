# NEN — Nzila OS integration gates (initial draft PR)

## Verified baseline

NEN v1.3.2 is a fictional Python/SQLite reference. It demonstrated local financial-state tamper detection and explicit multi-enterprise allocation/approval. **Do not migrate the SQLite database or Python demo sessions into the Nzila OS authoritative data stores.**

## What this PR contains

- Isolated Next.js app with the Black Enterprise visual identity, platform-auth sign-in and guarded, read-only workbench.
- `@nzila/nen-core` TypeScript rules covering proposed teaming, partner acknowledgement, buyer approval, lead acceptance, precise cent allocations, privacy-limited projection, and non-double-counted gross contract value.
- EXPERIMENTAL app registration; no release, external emails, public data ingestion or financial transactions.

## Acceptance gates before production records

1. Org membership and NEN mandates resolved from platform authority; validate write and read access at every repository boundary (not caller-supplied actor context).
2. PostgreSQL/Drizzle schema and reviewed migration for business passport, source credentials, buyer requirements, consortia, buyer approval and participant rights.
3. Immutable financial events with durable transactional outbox, independent integrity checkpoints, restore drills and provider-confirmed payment evidence.
4. Versioned document bytes, malware screening, e-signature/legal agreements and regulator/competition counsel review.
5. Real CanadaBuys ingestion and verified buyer/supplier consent; no scraping outside authorized terms.
6. Native EN-CA/FR-CA accessibility and full real browser-to-server end-to-end tests.
7. Explicit commercial approval before NEN becomes a new active sales lane; existing Nzila OS GTM priorities remain unchanged.

## Economic measurement

Report unique contract gross value once. Record company-level proposed allocations separately. Contract allocations are neither receipts nor independent confirmation of profits or wealth creation. Bilingual public branding emphasizes Black business ownership and intergenerational assets.
