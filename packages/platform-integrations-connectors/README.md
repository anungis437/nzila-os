# @nzila/platform-integrations-connectors

Connector implementations for integration transport and delivery in Nzila OS.

## Owns

- Reusable connector implementations for webhook, REST API, and CSV/SFTP flows
- Connector execution wiring against platform integration contracts
- Connector-level payload validation and typed connector outputs

## Does Not Own

- Domain-specific mapping rules and business transforms
- Product-specific orchestration policies

## Use This When

- Integrating external systems through standardized connector adapters
- Building transport-specific integration handlers with shared contracts
- Reusing connector primitives across multiple apps

## Adjacent Packages

- @nzila/platform-integrations: integration orchestration layer
- @nzila/platform-integrations-types: canonical connector types and schemas
