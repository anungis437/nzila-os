# ADR-AGRI-001: Cora and Agrimo Product Boundary Reconstitution

**Date**: 2026-10-07  
**Status**: ACCEPTED  
**Decision scope**: Product ownership and agricultural architecture doctrine  
**Implementation scope**: Documentation and metadata only

## Context

The earlier Agri Stack doctrine described Agrimo as the operational source
system and Cora as its read-only analytics companion. This accurately
described the initial implementation, but it no longer reflects the accepted
product direction. Leaving it as active product doctrine would make Cora
architecturally subordinate to Agrimo and incorrectly assign emerging-market
operational ownership to Cora.

This ADR supersedes that product-boundary doctrine without claiming that
runtime implementation has already caught up.

## Previous Doctrine

- Agrimo was the operational agricultural product and source of truth.
- Cora was a read-only analytics companion consuming Agrimo data.
- Shared agricultural packages were assigned to Agrimo.

These were prior product and implementation assumptions, not evidence that
the accepted Cora product ceiling is implemented.

## Decision

NzilaOS remains the shared control plane and owns identity, organization and
tenant scoping, authorization, policy, evidence and provenance, audit,
consent/data sharing, workflow, methodology/versioning, integration
contracts, intelligence governance, commerce/settlement primitives, and
observability.

Cora is a first-class product: **the intelligence and coordination network
for the food economy**. Its primary context is Canada and data-rich
agricultural environments. Its intended product ownership includes farm
enterprise and farmer intelligence, value creation, opportunity discovery
and passports, association intelligence, collective opportunity and action,
agricultural evidence interpretation, benchmark/framework application,
standards and capital readiness, commerce/settlement awareness,
research/policy outcomes, and food-system intelligence.

Agrimo is also a first-class product: **the operational agricultural
platform for cooperative, offline-first, and emerging-market agricultural
environments**. Its primary context is the DRC and comparable emerging
markets. It owns operational agricultural execution, cooperative
operations, field/season capture, offline-first workflows, and
execution-oriented producer/cooperative experiences.

Neither product is subordinate to, a deployment profile of, or a replacement
for the other. They may interoperate through governed contracts.

## Shared-Core Principle

Cora and Agrimo reuse shared agricultural primitives only where semantics
are genuinely common, such as producer/farm, field, season, commodity,
production observations, and evidence/provenance references. Shared
primitives do not imply shared product behavior or product ownership.
Materially different concepts remain product-owned.

`@nzila/agri-core` is shared agricultural domain infrastructure, not an
Agrimo-only product package. Other agricultural packages may continue to
support Agrimo operational execution where that is their actual responsibility.

## Current Implementation and Migration Implications

The repository currently implements Cora as a read-only surface over
agricultural operational data. Its org context returns read-only permissions,
and `tooling/contract-tests/cora-readonly.test.ts` prohibits mutation paths.
That is a **REFACTOR_REQUIRED** implementation assumption before Cora can
deliver any future write-capable Cora-owned workflows. It remains in force
until a separately scoped change designs, authorizes, and tests those
workflows. This ADR does not grant write permissions or relax security.

The current codebase imports shared agricultural packages rather than
importing between the two apps; this is a safe shared-core shape. No
production migration or destructive schema change is required for this
doctrine decision.

## Explicit Non-Goals

- No Cora ceiling product capability is implemented or runtime-validated by
  this ADR.
- No Agrimo deprecation, migration, absorption, or deployment change.
- No change to authorization, data access, schemas, or production data.
- No payment rail, credit underwriting, certification authority, or vendor
  integration is authorized.
- No external standard or National Index methodology is inferred.

## Superseded References and Classification

| Reference                                                                 | Prior classification      | Treatment                                                             |
| ------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------- |
| `apps/cora/README.md`                                                     | Active doctrine           | Updated to the new boundary; current read-only implementation noted   |
| `README.business.md`                                                      | Active product summary    | Updated to the new product roles                                      |
| `docs/categories/products-and-market/agri/00-overview.md`                 | Active doctrine           | Rewritten to establish peer products and shared core                  |
| `docs/categories/products-and-market/agri/01-market-map.md`               | Active doctrine           | Updated to distinguish Agrimo and Cora operating contexts             |
| `docs/categories/products-and-market/agri/02-architecture.md`             | Implementation assumption | Updated to distinguish current shape from product ownership           |
| `docs/categories/products-and-market/agri/04-events-and-integrations.md`  | Implementation assumption | Retained as current flow, explicitly not an ownership rule            |
| `docs/categories/products-and-market/agri/05-security-and-isolation.md`   | Implementation assumption | Current Cora read-only permissions remain documented as current state |
| `docs/categories/platform-and-operations/migration/app-alignment/cora.md` | Historical record         | Marked superseded; it described an unrelated planned compliance app   |
| `governance/business/investor-materials/one-pager-cora.md`                | Historical draft          | Marked superseded and not current product or readiness evidence       |
| `governance/business/verticals/agrotech/README.md`                        | Historical draft          | Marked superseded and not current product or readiness evidence       |
| `governance/foundations/repo/package-lifecycle.json`                      | Ownership metadata        | Shared `agri-core` no longer assigned only to Agrimo                  |
| `docs/categories/products-and-market/README.md`                           | Documentation index       | Added the ADR to product documentation navigation                     |

## Reuse Matrix

| Concern                                                          | Disposition                  | Existing repository basis                                               |
| ---------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| Producer, crop, harvest, lot and agricultural operational shapes | EXISTING_CANONICAL / EXTEND  | `@nzila/agri-core` types and schemas                                    |
| Org context and authentication                                   | EXISTING_CANONICAL           | `@nzila/platform-auth`, `@nzila/org`, Cora/Agrimo org resolution        |
| Evidence sealing and provenance                                  | EXISTING_CANONICAL           | `@nzila/evidence`, `@nzila/agri-provenance`, `@nzila/agri-traceability` |
| Read-only agricultural data access                               | EXISTING_CANONICAL           | `@nzila/agri-db/readonly`                                               |
| Commerce and trade contracts                                     | EXISTING_CANONICAL           | `@nzila/commerce-core`, `@nzila/trade-core`                             |
| Consent and access decisions                                     | EXISTING_CANONICAL           | `@nzila/consent-engine`                                                 |
| Cora product-owned food-economy capabilities                     | MISSING / DESIGN_NOT_STARTED | Explicitly deferred to later slices                                     |
| App-to-app imports                                               | DO_NOT_DUPLICATE             | No direct Cora↔Agrimo imports found in inspected source                 |

## Coupling Assessment

| Coupling                                                                          | Classification                        | Phase 0A disposition                                        |
| --------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| Cora and Agrimo use `@nzila/agri-core` and other shared packages                  | SAFE_SHARED_CORE                      | Preserve                                                    |
| Each app resolves org context through platform auth                               | SAFE_SHARED_CORE                      | Preserve                                                    |
| Cora reads through the read-only repository and its mutation prohibition contract | REFACTOR_REQUIRED                     | Preserve now; design separately before new write capability |
| Direct app-to-app imports                                                         | No coupling found in inspected source | No change                                                   |
| Destructive schema or production dependency                                       | No blocker found                      | No migration                                                |

## Consequences

- Active product documentation must describe Cora and Agrimo as peers with
  distinct operating contexts.
- Existing read-only enforcement remains a runtime safety control, not a
  permanent definition of Cora's product scope.
- Future capability work must reuse governed shared services and must not
  duplicate shared identity, evidence, consent, policy, or commerce rails.
- Product capability/maturity status remains unchanged by this decision.
