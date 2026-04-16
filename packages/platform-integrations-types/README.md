# @nzila/platform-integrations-types

Canonical type contracts and schemas for integration workflows in Nzila OS.

## Owns

- Shared integration interfaces for connectors, sync, identity, and delivery
- Event and mapping contract types used by integration packages
- Zod-backed schema definitions for runtime-safe integration payloads

## Does Not Own

- Connector runtime implementations
- App-level integration business logic

## Use This When

- Defining or extending integration contracts consumed by multiple packages
- Validating connector payloads and integration events
- Keeping integration interfaces consistent across platform and apps

## Adjacent Packages

- @nzila/platform-integrations: integration orchestration runtime
- @nzila/platform-integrations-connectors: connector implementations
