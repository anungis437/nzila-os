# @nzila/governance-telemetry

Foundational governance event contracts for Nzila runtime governance. Defines the canonical event envelope, severity vocabulary, scope vocabulary, doctrine citation shape, and the schema-validated event type taxonomy used across all Nzila products.

See the [governance telemetry architecture](../../docs/nzila-runtime-governance/governance-telemetry-architecture.md) and the [cross-product fabric](../../docs/nzila-runtime-governance/cross-product-governance-runtime-fabric.md) for the institutional contract this package materializes.

## Posture

- Schemas are governance-bearing contracts; every event must validate before emission and on ingestion.
- Envelopes are aggregation-safe by construction. Producer code that attaches individual identifiers outside aggregation-safe hashes will fail validation.
- Optimized for institutional trust, not for maximum visibility.

## Exports

- `./types` — TypeScript types (envelope, severity, scope, decision, doctrine citation, event types).
- `./schemas` — Zod schemas for each contract.
- `./events` — discriminated union of all governance event types and the registry by type id.
