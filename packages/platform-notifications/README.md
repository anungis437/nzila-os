# @nzila/platform-notifications

Authoritative notification orchestration package for platform flows.

## Owns

- Shared notification dispatch contracts
- Cross-app notification service abstraction and orchestration interfaces

## Does Not Own

- Channel-specific provider implementations as standalone domain logic
- App-specific notification UX preferences

## Use This When

- Adding shared notification sending behavior used by multiple apps
- Standardizing notification contract payloads and dispatch semantics

## Adjacent Packages

- @nzila/comms-email, @nzila/comms-sms, @nzila/comms-push: channel adapters
- @nzila/platform-contracts: shared payload and contract types
