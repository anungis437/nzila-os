# @nzila/events

Supporting event package retained for compatibility and migration.

## Owns

- Legacy-compatible event helpers used by packages not yet converged

## Does Not Own

- Canonical platform event envelope
- Cross-service event fabric orchestration

## New Work Guidance

- Use @nzila/platform-events for canonical event bus and envelope concerns.
- Use @nzila/platform-event-fabric for cross-service event correlation/orchestration.
