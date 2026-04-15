# @nzila/platform-billing

Authoritative platform billing primitives.

## Owns

- Shared billing contracts and billing service entrypoints
- Cross-app invoice/subscription lifecycle primitives

## Does Not Own

- Product-specific checkout UX and domain monetization policy
- Revenue aggregation and platform monetization rollups (use @nzila/platform-revenue)

## Use This When

- Implementing billing primitives consumed by multiple apps
- Standardizing billing behavior across product surfaces

## Adjacent Packages

- @nzila/platform-revenue: cross-app revenue intelligence and rollups
- @nzila/platform-contracts: canonical contract shapes used by billing APIs
