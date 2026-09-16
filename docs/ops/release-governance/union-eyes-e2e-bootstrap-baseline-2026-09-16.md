# UnionEyes E2E Bootstrap Baseline Update - 2026-09-16

## Release Binding

- SHA: `67e0cf16d962730cf124bffbc9a9a9125d8bc98f`
- Scope: CI/E2E database bootstrap only
- Changed migration-like file: `tooling/sql/union-eyes-qa-baseline.sql`

## Reason

The UnionEyes E2E bootstrap runs scoped SQL migrations against a short-lived
Postgres database seeded from the QA baseline. The runtime privilege closure
migration expects the runtime roles and document table shape to exist before it
applies authority and document-grant constraints.

Two fail-closed bootstrap failures were observed and corrected:

- `role "union_eyes_runtime" does not exist`
- `relation "documents" does not exist`

## Operational Disposition

The baseline update provisions inert `union_eyes_runtime` and
`union_eyes_system` roles for CI bootstrap, and adds the narrow `documents`
table baseline required by the scoped migration foreign keys. This does not
change production runtime authorization, deployed RLS policies, or application
route behavior.

The corrected E2E run passed for the bound SHA:

- Workflow: `E2E Tests`
- Run: `35080776424`
- UnionEyes job: `E2E - union-eyes`
- Result: success

## Guardrail

Any future change to this QA baseline must remain limited to CI bootstrap
compatibility unless separately accompanied by production migration and runtime
acceptance evidence.
