# V2 staging managed telemetry

The application initializes `@nzila/os-core/telemetry`, but the V2 environment
previously had no trace destination. An unconfigured HTTP exporter aimed at
localhost cannot satisfy deployed telemetry acceptance.

The staging Bicep creates an Application Insights resource in Canada Central,
backed by the environment's existing Log Analytics workspace, and configures
Azure Container Apps' managed OpenTelemetry agent to send traces and logs to it.
The resource and agent properties are conditional on staging. The production
configuration remains unchanged.

[Microsoft's managed agent contract](https://learn.microsoft.com/en-us/azure/container-apps/opentelemetry-agents)
injects an OTLP endpoint and `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`. The application
bootstrap now selects the matching gRPC exporter when requested, preserving the
existing HTTP/JSON default. Trace-specific protocol and endpoint settings take
precedence. Unsupported protocols report initialization failure instead of
silently sending a different wire format.

The staging-only deployment role gained `Microsoft.Insights/components/read`
and `Microsoft.Insights/components/write`. Its sole assignable scope remains
`nzila-canada-staging-rg`; no data-plane permission or production scope was added.
The measured control-plane receipt is
[evidence/ue-v2-telemetry-role-20261110.json](evidence/ue-v2-telemetry-role-20261110.json).

Validation: the Bicep compiled, eight telemetry tests passed (including collector
transport and endpoint checks), and the scoped dependency lock passes frozen
lockfile validation. These are source checks. Actual candidate-bound traces,
request/audit correlation, and Azure Monitor queries remain required before
`STAGING_GO`.



## Managed environment provider contract

Controlled foundation apply [43028242463](https://github.com/anungis437/nzila-os/actions/runs/43028242463)
failed before application rollout: Azure rejected the telemetry properties on
`Microsoft.App/managedEnvironments@2024-03-01`. The staging environment now uses
`2026-07-01`, whose [resource contract](https://learn.microsoft.com/en-us/azure/templates/microsoft.app/2026-07-01/managedenvironments)
includes both `appInsightsConfiguration` and `openTelemetryConfiguration`.
Production retains its existing `2024-03-01` resource and properties. The
subscription's registered provider explicitly advertises the staging API.
Compilation and what-if did not detect the older provider rejection; only a
successful controlled apply and actual Azure Monitor evidence can qualify it.

The same failed apply returned `ServerNameAlreadyExists` for the unqualified
PostgreSQL name. Staging now appends the subscription's first eight characters:
`nzila-ue-v2-staging-db-d562ba7f`. Azure's global name-availability API confirmed
that name available on 2026-11-11. Production keeps its existing server name.
The global check must be repeated before the fresh apply; resource absence
inside one resource group is insufficient evidence of global availability.

The [provider failure receipt](evidence/ue-v2-foundation-provider-contracts-20261111.json)
preserves the failed attempt and the measured name check. It confers no runtime
acceptance, application deployment or production authorization.

## Export privacy and single execution

Next and the HTTP instrumentation attach complete request URLs, including
callback query strings. The exporter now strips query/fragment values and URL
credentials before either transport serializes a span. Sensitive credential
attributes are redacted across spans, events and links; error URLs are cleaned.
Trace/span identity, route, status, correlation and token-usage counts remain.
Completed SDK spans are not mutated. Initialization diagnostics also strip URL
credentials. This applies to Next-owned spans as well as the application's.

A real dependency inspection reproduced a synthetic callback code in `http.url`
and `http.target`. The [local transport receipt](evidence/ue-v2-telemetry-privacy-local-20261110.json)
records actual HTTP/JSON and gRPC/protobuf collector bytes: synthetic callback,
SAS, cookie and URL-password values were absent while the span, trace ID and
correlation survived. The receipt pins the measured source bytes; it is not
Azure acceptance. Thirteen telemetry tests and the isolated package typecheck
passed, including long/malformed URLs, both exporter lifecycles and immutable
SDK spans.

The span helper's business callback also executes outside the instrumentation
fallback catch. A failed business operation is propagated once rather than
being retried as though instrumentation initialization had failed. Its existing
failure regression now asserts exactly one invocation. No production resource
or deployment was changed.
