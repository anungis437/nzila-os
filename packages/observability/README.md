# @nzila/observability

Supporting observability package for compatibility.

## Owns

- Legacy helper surfaces still consumed by selected apps/packages

## Does Not Own

- Canonical platform observability contract surface
- Canonical app boot telemetry entrypoint

## New Work Guidance

- Use @nzila/os-core telemetry boot path plus @nzila/platform-observability primitives.
- Do not expand this package as a parallel observability abstraction.
