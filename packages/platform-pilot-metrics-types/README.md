# @nzila/platform-pilot-metrics-types

Canonical type and schema definitions for pilot metrics across Nzila OS.

## Owns

- Shared pilot metrics type contracts used by apps and platform services
- Runtime-safe schema definitions for pilot metric payloads and summaries
- Typed interfaces for pilot scorecards and reporting outputs

## Does Not Own

- Pilot metric ingestion or persistence logic
- Alerting execution or dashboard delivery logic

## Use This When

- Defining pilot metric payloads consumed by multiple packages
- Enforcing schema consistency for pilot metric exchanges
- Versioning pilot data contracts safely across services

## Adjacent Packages

- @nzila/platform-pilot-metrics: service and rollup implementation layer
