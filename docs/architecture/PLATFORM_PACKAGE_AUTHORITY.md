# Platform Package Authority Decision

Status: accepted
Date: 2026-04-14
Owner: @nzila/platform

## Decision

Nzila OS adopts one authoritative package boundary per shared concern and constrains overlapping packages to supporting or migration roles.

The normative map is stored in governance/platform-package-authority.json and is enforced by:

- pnpm platform:authority:check
- pnpm platform:adoption:check

## Concern Authority Matrix

| Concern | Authoritative package(s) | Supporting packages | Not for expansion |
|---|---|---|---|
| auth | @nzila/platform-auth | — | none |
| contracts | @nzila/platform-contracts | @nzila/contracts | @nzila/contracts for new cross-app contracts |
| eventing | @nzila/platform-events, @nzila/platform-event-fabric | @nzila/events | @nzila/events for new event envelope work |
| observability | @nzila/os-core, @nzila/platform-observability | @nzila/otel-core, @nzila/observability | @nzila/observability for new telemetry wrappers |
| org context | @nzila/org | — | none |
| evidence | @nzila/platform-evidence-pack | @nzila/evidence | none |
| notifications | @nzila/platform-notifications | comms packages | none |
| integrations | @nzila/platform-integrations, @nzila/platform-integrations-control-plane | integrations-core/runtime/db | @nzila/integrations for new integration orchestration |
| revenue | @nzila/platform-revenue | — | none |
| billing | @nzila/platform-billing | — | none |
| deployment | @nzila/platform-deploy | — | none |
| feature flags | @nzila/platform-feature-flags | — | none |
| data fabric | @nzila/platform-data-fabric | — | none |

## Rationale

1. Existing platform packages already provide the required capability; consolidation should improve adoption and governance rather than re-foundation.
2. Controlled layering preserves app autonomy while reducing cross-app ambiguity.
3. Enforcement through scripts and machine-readable exceptions keeps migration paths explicit and time-bound.

## Consequences

1. New platform abstractions that duplicate the concerns above are prohibited unless preceded by a formal deprecation/migration decision.
2. Packages listed as supporting remain valid, but must not become parallel sources of truth for platform-wide concerns.
3. App adoption status is measurable per concern and tier via the runtime adoption gate report.
