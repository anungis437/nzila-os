# @nzila/platform-auth

Authoritative platform package for authentication and authorization across Nzila OS.

## Owns

- Shared auth providers and adapters (Entra and password flows)
- Server/client auth primitives for app routes and API handlers
- Cross-app authorization guards and identity contracts

## Does Not Own

- App-specific role semantics and domain authorization policies
- Domain org context typing (use @nzila/org)

## Use This When

- Building or updating user/session auth flows in apps
- Adding route protection middleware
- Implementing standardized auth handlers

## Adjacent Packages

- @nzila/org: canonical org and actor context contract
- @nzila/platform-contracts: shared platform contract schemas used by auth adapters
