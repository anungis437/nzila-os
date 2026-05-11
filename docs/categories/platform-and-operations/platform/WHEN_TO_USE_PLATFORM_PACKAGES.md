# When To Use Which Platform Package

Use this guide when adding shared logic to apps or packages.

## Cross-App Concerns

| If you need... | Use | Avoid for new work |
|---|---|---|
| identity, session, route guards | @nzila/platform-auth | app-local auth wrappers that bypass platform-auth |
| cross-app contract shapes | @nzila/platform-contracts | @nzila/contracts as primary contract source |
| canonical event envelope and bus | @nzila/platform-events | @nzila/events as the main event bus |
| cross-service event orchestration/correlation | @nzila/platform-event-fabric | app-local event fabrics |
| telemetry boot + request tracing + structured logs | @nzila/os-core + @nzila/platform-observability | @nzila/observability as primary entrypoint |
| org identity and request context types | @nzila/org | app-local duplicate org context types |
| evidence lifecycle/export packs | @nzila/platform-evidence-pack | app-local evidence-pack frameworks |
| cryptographic seal primitives | @nzila/evidence | custom sealing logic |
| connector orchestration/runtime governance | @nzila/platform-integrations | @nzila/integrations for new orchestration |
| integration control-plane operations | @nzila/platform-integrations-control-plane | app-local integration ops surfaces |
| feature flag evaluation | @nzila/platform-feature-flags | app-local feature flag engines |
| monetization and revenue rollups | @nzila/platform-revenue | per-app revenue abstractions with no platform bridge |
| billing primitives | @nzila/platform-billing | duplicate billing cores |
| deployment profiles and orchestration | @nzila/platform-deploy | app-local deployment frameworks |
| canonical data ingestion/reconciliation | @nzila/platform-data-fabric | ad hoc cross-source sync frameworks |
| platform notification dispatch | @nzila/platform-notifications | app-local notification orchestrators |

## Allowed Layering

These packages are valid but subordinate to authoritative layers:

- @nzila/contracts for domain-local contract helpers
- @nzila/events for migration/compatibility support
- @nzila/otel-core for low-level OTel setup beneath platform observability
- integrations-core/runtime/db as supporting internals behind platform-integrations

## Migration Rule

If an app still uses subordinate or legacy package surfaces, add a time-bound entry in governance/exceptions/platform-concern-adoption-exceptions.json and track closure in the adoption gate report.
