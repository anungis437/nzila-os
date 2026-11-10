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
