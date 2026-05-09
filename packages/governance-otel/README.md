# @nzila/governance-otel

OpenTelemetry adapter that maps governance event envelopes onto OTel spans with semantic governance attributes. Reuses whatever OTel provider is already installed by the host app (`@nzila/os-core/telemetry`); does NOT install or replace the SDK.

See [docs/nzila-runtime-integration/opentelemetry-governance-integration.md](../../docs/nzila-runtime-integration/opentelemetry-governance-integration.md).

## Posture

- Forbidden person-resolving attribute keys are refused at the adapter boundary.
- `info` spans inherit the parent sampler. `warning` and `critical` spans are forced-sampled.
- Spans are short and semantically meaningful. Large payloads belong in evidence records, not span attributes.
