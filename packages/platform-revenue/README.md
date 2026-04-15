# @nzila/platform-revenue

Authoritative cross-app revenue package.

## Owns

- Shared revenue service contracts used by product apps and control-plane rollups
- Revenue summaries, subscriptions, and platform-wide monetization primitives

## Does Not Own

- App-local monetization UX and domain-specific pricing internals
- Billing execution primitives (use @nzila/platform-billing)

## Use This When

- Implementing revenue-aware product features in apps
- Building control-plane revenue aggregation and reporting

## Adjacent Packages

- @nzila/platform-billing: billing and invoice primitives
- Domain monetization packages (for example zonga-*): product-specific logic layered on top
