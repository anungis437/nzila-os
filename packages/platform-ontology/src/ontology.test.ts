/**
 * @nzila/platform-ontology — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { OntologyEntityType } from './index'
import {
  OntologyEntityTypes,
  RelationshipTypes,
  validateEntity,
  validateCreateEntity,
  validateRelationship,
  validateCreateRelationship,
  getOntologyDefinition,
  registerOntologyType,
  resolveOntologyRelationships,
  validateRelationshipAllowed,
  buildOntologyEntity,
  buildOntologyRelationship,
  isRelationshipAllowed,
  listOntologyDefinitions,
  getTypeDefinition,
  getRelationshipsFor,
  ontologyEntities,
  ontologyRelationships,
  resetRegistry,
} from './index'

function runDrizzleExtraConfig(table: Record<PropertyKey, unknown>): unknown[] {
  const symbols = Object.getOwnPropertySymbols(table)
  const builder = symbols.find((s) => s.toString() === 'Symbol(drizzle:ExtraConfigBuilder)')
  const cols = symbols.find((s) => s.toString() === 'Symbol(drizzle:ExtraConfigColumns)')

  expect(builder).toBeDefined()
  expect(cols).toBeDefined()

  return (table as Record<PropertyKey, (arg: unknown) => unknown[]>)[builder!](
    (table as Record<PropertyKey, unknown>)[cols!],
  )
}

describe('platform-ontology', () => {
  beforeEach(() => {
    resetRegistry()
  })

  describe('validators', () => {
    it('validates a correct CreateOntologyEntity input', () => {
      const result = validateCreateEntity({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        entityType: OntologyEntityTypes.CLIENT,
        canonicalName: 'Jane Doe',
      })
      expect(result.success).toBe(true)
    })

    it('rejects an entity missing tenantId', () => {
      const result = validateCreateEntity({
        entityType: OntologyEntityTypes.CLIENT,
        canonicalName: 'Jane Doe',
      })
      expect(result.success).toBe(false)
    })

    it('rejects an invalid entity type', () => {
      const result = validateCreateEntity({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        entityType: 'InvalidType',
        canonicalName: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('validates a correct CreateRelationship input', () => {
      const result = validateCreateRelationship({
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        sourceEntityType: OntologyEntityTypes.CLIENT,
        sourceEntityId: '550e8400-e29b-41d4-a716-446655440001',
        targetEntityType: OntologyEntityTypes.FAMILY,
        targetEntityId: '550e8400-e29b-41d4-a716-446655440002',
        relationshipType: RelationshipTypes.HAS,
      })
      expect(result.success).toBe(true)
    })

    it('validates full entity and relationship payloads', () => {
      const now = new Date().toISOString()

      const entityResult = validateEntity({
        id: '550e8400-e29b-41d4-a716-446655440120',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        entityType: OntologyEntityTypes.CLIENT,
        canonicalName: 'Jane Doe',
        aliases: [],
        status: 'active',
        tags: [],
        sourceSystems: [],
        metadata: {},
        createdAt: now,
        updatedAt: now,
      })
      expect(entityResult.success).toBe(true)

      const relationshipResult = validateRelationship({
        id: '550e8400-e29b-41d4-a716-446655440121',
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        sourceEntityType: OntologyEntityTypes.CLIENT,
        sourceEntityId: '550e8400-e29b-41d4-a716-446655440001',
        targetEntityType: OntologyEntityTypes.FAMILY,
        targetEntityId: '550e8400-e29b-41d4-a716-446655440002',
        relationshipType: RelationshipTypes.HAS,
        metadata: {},
        createdAt: now,
      })
      expect(relationshipResult.success).toBe(true)
    })

    it('rejects invalid full entity and relationship payloads', () => {
      expect(validateEntity({}).success).toBe(false)
      expect(validateRelationship({}).success).toBe(false)
    })
  })

  describe('relationships', () => {
    it('reports Client HAS Family as allowed', () => {
      expect(
        isRelationshipAllowed(
          OntologyEntityTypes.CLIENT,
          OntologyEntityTypes.FAMILY,
          RelationshipTypes.HAS,
        ),
      ).toBe(true)
    })

    it('reports Decision PRODUCES Approval as allowed', () => {
      expect(
        isRelationshipAllowed(
          OntologyEntityTypes.DECISION,
          OntologyEntityTypes.APPROVAL,
          RelationshipTypes.PRODUCES,
        ),
      ).toBe(true)
    })

    it('reports Farmer LINKS_TO Parcel as allowed', () => {
      expect(
        isRelationshipAllowed(
          OntologyEntityTypes.FARMER,
          OntologyEntityTypes.PARCEL,
          RelationshipTypes.LINKS_TO,
        ),
      ).toBe(true)
    })

    it('rejects invalid relationship', () => {
      expect(
        isRelationshipAllowed(
          OntologyEntityTypes.FARMER,
          OntologyEntityTypes.INVOICE,
          RelationshipTypes.PRODUCES,
        ),
      ).toBe(false)
    })

    it('returns default definitions for unknown types and no relationships', () => {
      const unknown = 'UnknownType' as unknown as OntologyEntityType
      const def = getTypeDefinition(unknown)
      expect(def.entityType).toBe(unknown)
      expect(def.allowedRelationships).toEqual([])

      const rels = getRelationshipsFor(unknown)
      expect(rels).toEqual([])
    })
  })

  describe('registry', () => {
    it('returns built-in ontology definitions', () => {
      const def = getOntologyDefinition(OntologyEntityTypes.CLIENT)
      expect(def).toBeDefined()
      expect(def!.entityType).toBe('Client')
    })

    it('supports custom type registration', () => {
      registerOntologyType({
        entityType: 'CustomWidget' as unknown as OntologyEntityType,
        description: 'A custom widget entity',
        requiredFields: ['canonicalName'],
        optionalFields: ['color'],
        allowedRelationships: [],
      })
      const def = getOntologyDefinition('CustomWidget')
      expect(def).toBeDefined()
      expect(def!.description).toBe('A custom widget entity')
    })

    it('lists all definitions including custom', () => {
      registerOntologyType({
        entityType: 'CustomWidget' as unknown as OntologyEntityType,
        description: 'Widget',
        requiredFields: ['canonicalName'],
        optionalFields: [],
        allowedRelationships: [],
      })
      const all = listOntologyDefinitions()
      expect(all.some((d) => d.entityType === ('CustomWidget' as unknown as OntologyEntityType))).toBe(true)
    })

    it('resolves relationships for an entity type', () => {
      const rels = resolveOntologyRelationships(OntologyEntityTypes.CASE)
      expect(rels.length).toBeGreaterThan(0)
      expect(rels.some((r) => r.targetEntityType === OntologyEntityTypes.DOCUMENT)).toBe(true)
    })

    it('uses custom relationship validation when custom source type exists', () => {
      registerOntologyType({
        entityType: 'CustomWidget' as unknown as OntologyEntityType,
        description: 'Custom widget',
        requiredFields: ['canonicalName'],
        optionalFields: [],
        allowedRelationships: [
          {
            relationshipType: RelationshipTypes.LINKS_TO,
            targetEntityType: OntologyEntityTypes.CLIENT,
            cardinality: 'many',
            description: 'Widget links to clients',
          },
        ],
      })

      expect(
        validateRelationshipAllowed(
          'CustomWidget' as unknown as OntologyEntityType,
          OntologyEntityTypes.CLIENT,
          RelationshipTypes.LINKS_TO,
        ),
      ).toBe(true)

      expect(
        validateRelationshipAllowed(
          'CustomWidget' as unknown as OntologyEntityType,
          OntologyEntityTypes.CLIENT,
          RelationshipTypes.HAS,
        ),
      ).toBe(false)
    })

    it('falls back to canonical relationship validation for built-in source types', () => {
      expect(
        validateRelationshipAllowed(
          OntologyEntityTypes.CLIENT,
          OntologyEntityTypes.FAMILY,
          RelationshipTypes.HAS,
        ),
      ).toBe(true)
    })
  })

  describe('builders', () => {
    it('builds an ontology entity', () => {
      const now = new Date().toISOString()
      const entity = buildOntologyEntity(
        '550e8400-e29b-41d4-a716-446655440099',
        {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          entityType: OntologyEntityTypes.CLIENT,
          canonicalName: 'Jane Doe',
          tags: ['mobility'],
        },
        now,
      )
      expect(entity.id).toBe('550e8400-e29b-41d4-a716-446655440099')
      expect(entity.entityType).toBe('Client')
      expect(entity.status).toBe('active')
      expect(entity.tags).toEqual(['mobility'])
    })

    it('builds an ontology relationship', () => {
      const now = new Date().toISOString()
      const rel = buildOntologyRelationship(
        '550e8400-e29b-41d4-a716-446655440098',
        {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          sourceEntityType: OntologyEntityTypes.CLIENT,
          sourceEntityId: '550e8400-e29b-41d4-a716-446655440001',
          targetEntityType: OntologyEntityTypes.FAMILY,
          targetEntityId: '550e8400-e29b-41d4-a716-446655440002',
          relationshipType: RelationshipTypes.HAS,
        },
        now,
      )
      expect(rel.relationshipType).toBe('HAS')
      expect(rel.sourceEntityType).toBe('Client')
    })

    it('exercises drizzle schema extra config builders', () => {
      const entityConfig = runDrizzleExtraConfig(ontologyEntities as unknown as Record<PropertyKey, unknown>)
      expect(entityConfig).toHaveLength(4)

      const relationshipConfig = runDrizzleExtraConfig(ontologyRelationships as unknown as Record<PropertyKey, unknown>)
      expect(relationshipConfig).toHaveLength(4)
    })
  })
})
