/**
 * @nzila/platform-ontology — Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { OntologyEntityType } from './index'
import {
  OntologyEntityTypes,
  RelationshipTypes,
  validateCreateEntity,
  validateCreateRelationship,
  getOntologyDefinition,
  registerOntologyType,
  resolveOntologyRelationships,
  buildOntologyEntity,
  buildOntologyRelationship,
  isRelationshipAllowed,
  listOntologyDefinitions,
  resetRegistry,
} from './index'

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
  })
})
