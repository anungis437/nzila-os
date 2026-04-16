# @nzila/platform-shell

Shared platform shell primitives for app composition, registry, and context boundaries.

## Owns

- Shell-level registry helpers used to compose governed app surfaces
- Shared context contracts for organization and actor-aware rendering
- Reusable shell components that integrate with platform contracts

## Does Not Own

- App-specific navigation and feature implementation
- Authentication provider internals

## Use This When

- Building app shells that must align with platform registry contracts
- Reusing shell components with consistent org and actor context
- Standardizing cross-app shell behavior and composition patterns

## Adjacent Packages

- @nzila/platform-auth: authentication and route guards
- @nzila/platform-contracts: platform contract schemas and registry contracts
- @nzila/ui: shared UI primitives
