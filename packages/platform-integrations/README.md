# @nzila/platform-integrations

Authoritative orchestration layer for platform-level integrations.

## Owns

- Connector orchestration lifecycle
- Integration execution, webhook, and sync orchestration contracts
- Cross-connector governance hooks (audit, idempotency, rate limiting)

## Does Not Own

- Vertical-specific connector business rules
- UI/operations surface concerns (use @nzila/platform-integrations-control-plane)

## Use This When

- Building cross-app integration runtime features
- Adding connector lifecycle controls and shared policies
- Implementing integration orchestration that spans domains

## Adjacent Packages

- @nzila/platform-integrations-control-plane: operational UI and status surface
- @nzila/integrations-core, @nzila/integrations-runtime, @nzila/integrations-db: supporting internals
- @nzila/integrations: legacy-compatible package, not for new orchestration work
