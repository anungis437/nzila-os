/**
 * @nzila/platform-ontology — Ontology Type Registry
 *
 * Runtime registry for ontology type definitions.
 * Supports core types + per-vertical extensions.
 */
import type {
  OntologyEntityType,
  OntologyTypeDefinition,
  OntologyRelationship,
  OntologyEntity,
  CreateOntologyEntityInput,
  CreateRelationshipInput,
} from './types'
import { OntologyEntityTypes as _OntologyEntityTypes, RelationshipTypes } from './types'
import {
  getTypeDefinition,
  getAllTypeDefinitions,
  isRelationshipAllowed,
} from './relationships'

// ── Registry State ──────────────────────────────────────────────────────────

const customTypes = new Map<string, OntologyTypeDefinition>()

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get the ontology definition for a given entity type.
 * Checks custom extensions first, then canonical definitions.
 */
export function getOntologyDefinition(
  entityType: OntologyEntityType | string,
): OntologyTypeDefinition | undefined {
  return customTypes.get(entityType) ?? getTypeDefinition(entityType as OntologyEntityType)
}

/**
 * Register a custom or vertical-specific ontology type.
 * Will override built-in definitions if the same entityType is used.
 */
export function registerOntologyType(definition: OntologyTypeDefinition): void {
  customTypes.set(definition.entityType, definition)
}

/**
 * List all registered ontology definitions (built-in + custom).
 */
export function listOntologyDefinitions(): readonly OntologyTypeDefinition[] {
  const builtIn = getAllTypeDefinitions()
  const customList = Array.from(customTypes.values()).filter(
    (c) => !builtIn.some((b) => b.entityType === c.entityType),
  )
  return [...builtIn, ...customList]
}

/**
 * Resolve allowed ontology relationships for a given entity type.
 */
export function resolveOntologyRelationships(entityType: OntologyEntityType | string) {
  const def = getOntologyDefinition(entityType)
  return def?.allowedRelationships ?? []
}

/**
 * Check whether a relationship between two entity types is valid.
 */
export function validateRelationshipAllowed(
  sourceType: OntologyEntityType,
  targetType: OntologyEntityType,
  relationshipType: string,
): boolean {
  // Check custom registry first
  const customDef = customTypes.get(sourceType)
  if (customDef) {
    return customDef.allowedRelationships.some(
      (r) =>
        r.targetEntityType === targetType &&
        r.relationshipType === relationshipType,
    )
  }
  return isRelationshipAllowed(sourceType, targetType, relationshipType as (typeof RelationshipTypes)[keyof typeof RelationshipTypes])
}

/**
 * Build an ontology entity object from input (pure, no I/O).
 */
export function buildOntologyEntity(
  id: string,
  input: CreateOntologyEntityInput,
  now: string,
): OntologyEntity {
  return {
    id,
    tenantId: input.tenantId,
    entityType: input.entityType,
    canonicalName: input.canonicalName,
    aliases: input.aliases ?? [],
    status: input.status ?? 'active',
    tags: input.tags ?? [],
    sourceSystems: input.sourceSystems ?? [],
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Build a relationship object from input (pure, no I/O).
 */
export function buildOntologyRelationship(
  id: string,
  input: CreateRelationshipInput,
  now: string,
): OntologyRelationship {
  return {
    id,
    tenantId: input.tenantId,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    relationshipType: input.relationshipType,
    metadata: input.metadata ?? {},
    createdAt: now,
  }
}

/**
 * Reset custom registry (for testing).
 */
export function resetRegistry(): void {
  customTypes.clear()
}
