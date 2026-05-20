# SOC 2 Readiness — Nzila OS

> **Status**: Pre-audit readiness scaffold (May 2026). Nzila OS has **not yet
> completed** a SOC 2 Type I or Type II examination. This directory tracks the
> control mapping, evidence inventory, and gap log that will support a future
> SOC 2 engagement.

## Scope

- **Service**: Nzila OS multi-org governance platform, including the Union Eyes
  (CUPE pilot) vertical.
- **Trust Services Criteria** in scope: Security (CC1–CC9), Availability,
  Confidentiality, Privacy.
- **Boundary**: Production Azure Canada Central deployment + supporting
  GitHub-hosted CI/CD pipeline.

## Documents in this directory

| File | Purpose |
|------|---------|
| [`control-mapping.md`](./control-mapping.md) | Mapping of SOC 2 Trust Services Criteria → existing Nzila controls and evidence artifacts |
| [`evidence-inventory.md`](./evidence-inventory.md) | Catalogue of evidence artifacts (policies, logs, contract tests, audit packs) and where they live in the repo |
| [`gap-log.md`](./gap-log.md) | Known gaps that must be closed before a Type I audit can begin (pen-test, vendor SOC 2 reports, formal access reviews, etc.) |

## How this fits with existing governance

- Vendor questionnaire and DPA already live under
  `docs/categories/platform-and-operations/governance/`.
- Hash-chained audit logs and evidence sealing
  (`apps/union-eyes/lib/evidence-export.ts`) underpin CC7 (system operations)
  evidence.
- Contract tests in `tooling/contract-tests/` are the primary CC8 (change
  management) evidence stream.
- This directory aggregates and indexes those existing artifacts — it does
  **not** introduce a new compliance regime.

## Out of scope for this scaffold

- HIPAA mappings (tracked separately under
  `docs/categories/platform-and-operations/governance/`).
- ISO 27001 (no current commitment).
- FedRAMP / IRAP (not in Canadian residency target).
