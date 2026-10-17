# @nzila/platform-ontology

Canonical business ontology for NzilaOS.

## Purpose

Defines shared entity types, relationships, and validators used across all verticals.

## Entity Types

Tenant, Organization, Person, User, Advisor, Member, Client, Family, Case, Claim, Program, Document, Communication, Task, Workflow, Decision, RiskEvent, Policy, Approval, EvidencePack, AuditEvent, Asset, Property, Deal, Invoice, Payment, Shipment, Product, Farmer, Parcel, Subsidy, RegistryRecord.

## Usage

```ts
import {
  OntologyEntityTypes,
  RelationshipTypes,
  getOntologyDefinition,
  registerOntologyType,
  resolveOntologyRelationships,
  validateCreateEntity,
  buildOntologyEntity,
} from '@nzila/platform-ontology'

// Check a relationship is valid
isRelationshipAllowed(OntologyEntityTypes.CLIENT, OntologyEntityTypes.FAMILY, RelationshipTypes.HAS)

// Register a custom vertical entity type
registerOntologyType({
  entityType: 'VehicleInspection' as unknown,
  description: 'A mobility vehicle inspection',
  requiredFields: ['canonicalName'],
  optionalFields: ['inspectorId', 'result'],
  allowedRelationships: [],
})
```

## Drizzle Schema

Import `ontologyEntities` and `ontologyRelationships` from `@nzila/platform-ontology/schema` for DB access.

## Institutional vocabulary

`@nzila/platform-ontology/institutional` provides the additive institutional kinds,
directed relations and `institutionalRelationshipAllowed` validator used by the
local operating runtime. InstitutionalProduct is deliberately separate from
commerce Product. Source/reference types and precise consumption, ownership,
affected-estate, intended-implementation and evidence relations do not change
legacy ontology validators, registries, Drizzle tables or relationship meanings.
Type-pair validity is not permission: both endpoint visibility and action-specific
scope/authority must still pass the institutional boundary.

See the [CP4 closeout](../../docs/architecture/NZILA_OS_CP4_OPERATING_RUNTIME_CLOSEOUT.md)
for scoped proof and limitations; no production graph migration was performed.
