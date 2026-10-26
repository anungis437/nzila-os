/**
 * @nzila/platform-ontology — Zod Validators
 *
 * Runtime validation for ontology entities and relationships.
 */
import { z } from 'zod'
import { OntologyEntityTypes, EntityStatuses, RelationshipTypes } from './types'

const ontologyEntityTypeValues = Object.values(OntologyEntityTypes) as [
  string,
  ...string[],
]
const entityStatusValues = Object.values(EntityStatuses) as [
  string,
  ...string[],
]
const relationshipTypeValues = Object.values(RelationshipTypes) as [
  string,
  ...string[],
]

// ── Entity Schema ───────────────────────────────────────────────────────────

export const OntologyEntitySchema = z.object({
  id: z.guid(),
  tenantId: z.guid(),
  entityType: z.enum(ontologyEntityTypeValues),
  canonicalName: z.string().min(1).max(512),
  aliases: z.array(z.string().min(1)).default([]),
  status: z.enum(entityStatusValues).default('active'),
  tags: z.array(z.string().min(1)).default([]),
  sourceSystems: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).prefault({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const CreateOntologyEntitySchema = z.object({
  tenantId: z.guid(),
  entityType: z.enum(ontologyEntityTypeValues),
  canonicalName: z.string().min(1).max(512),
  aliases: z.array(z.string().min(1)).optional(),
  status: z.enum(entityStatusValues).optional(),
  tags: z.array(z.string().min(1)).optional(),
  sourceSystems: z.array(z.string().min(1)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const UpdateOntologyEntitySchema = z.object({
  canonicalName: z.string().min(1).max(512).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  status: z.enum(entityStatusValues).optional(),
  tags: z.array(z.string().min(1)).optional(),
  sourceSystems: z.array(z.string().min(1)).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Relationship Schema ─────────────────────────────────────────────────────

export const OntologyRelationshipSchema = z.object({
  id: z.guid(),
  tenantId: z.guid(),
  sourceEntityType: z.enum(ontologyEntityTypeValues),
  sourceEntityId: z.guid(),
  targetEntityType: z.enum(ontologyEntityTypeValues),
  targetEntityId: z.guid(),
  relationshipType: z.enum(relationshipTypeValues),
  metadata: z.record(z.string(), z.unknown()).prefault({}),
  createdAt: z.string().datetime(),
})

export const CreateRelationshipSchema = z.object({
  tenantId: z.guid(),
  sourceEntityType: z.enum(ontologyEntityTypeValues),
  sourceEntityId: z.guid(),
  targetEntityType: z.enum(ontologyEntityTypeValues),
  targetEntityId: z.guid(),
  relationshipType: z.enum(relationshipTypeValues),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// ── Validation Helpers ──────────────────────────────────────────────────────

export function validateEntity(data: unknown) {
  return OntologyEntitySchema.safeParse(data)
}

export function validateCreateEntity(data: unknown) {
  return CreateOntologyEntitySchema.safeParse(data)
}

export function validateRelationship(data: unknown) {
  return OntologyRelationshipSchema.safeParse(data)
}

export function validateCreateRelationship(data: unknown) {
  return CreateRelationshipSchema.safeParse(data)
}
