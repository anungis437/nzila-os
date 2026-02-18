/**
 * Nzila Business OS - Governance Replicability Extensions
 * 
 * Extends governance workflows with replicability notation support.
 * Enables:
 * - Cloning governance templates across entities
 * - Tracking template lineage and provenance
 * - Auditing divergence from templates
 * - Version-controlled governance policies
 */

import { z } from 'zod'

// ============================================================================
// REPLICABILITY TYPES
// ============================================================================

/**
 * Types of replicable governance artifacts
 */
export enum ReplicableType {
  WORKFLOW_TEMPLATE = 'WORKFLOW_TEMPLATE',
  EQUITY_TEMPLATE = 'EQUITY_TEMPLATE',
  POLICY_TEMPLATE = 'POLICY_TEMPLATE',
  RUNBOOK_TEMPLATE = 'RUNBOOK_TEMPLATE',
  WORKFLOW_INSTANCE = 'WORKFLOW_INSTANCE',
}

/**
 * Replication relationship type
 */
export enum ReplicationRelation {
  IS_TEMPLATE = 'IS_TEMPLATE',
  CLONED_FROM = 'CLONED_FROM',
  DERIVED_FROM = 'DERIVED_FROM',
  INSTANTIATED_FROM = 'INSTANTIATED_FROM',
}

/**
 * A single divergence from a template
 */
export const DivergenceSchema = z.object({
  field: z.string(),                    // Which field diverged
  originalValue: z.unknown(),           // Value in template
  currentValue: z.unknown(),            // Current value in instance
  divergedAt: z.string().datetime(),   // When divergence occurred
  divergedBy: z.string().uuid(),        // Who made the change
  reason: z.string().optional(),       // Why it was changed
})

export type Divergence = z.infer<typeof DivergenceSchema>

/**
 * Replicability metadata for any governance artifact
 */
export const ReplicabilityMetadataSchema = z.object({
  // Identity
  replicationId: z.string().uuid(),      // Unique ID for this replication chain
  version: z.string(),                   // Semantic version of this artifact
  
  // Template relationship
  isTemplate: z.boolean().default(false),
  sourceId: z.string().uuid().optional(),     // ID of source template
  sourceVersion: z.string().optional(),        // Version of source template
  relation: z.nativeEnum(ReplicationRelation).optional(),
  
  // Template management
  templateName: z.string().optional(),         // Human-readable template name
  templateCategory: z.string().optional(),     // Category (e.g., "equity", "governance")
  deprecated: z.boolean().default(false),
  deprecatedBy: z.string().optional(),
  deprecatedAt: z.string().datetime().optional(),
  
  // Divergence tracking
  divergenceLog: z.array(DivergenceSchema).default([]),
  autoSyncWithTemplate: z.boolean().default(false),  // Auto-update from template
  
  // Provenance
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  
  // Access control
  isPublic: z.boolean().default(false),      // Can other entities clone this?
  allowedCloners: z.array(z.string().uuid()).default([]), // Specific entities allowed
  
  // Audit
  cloneCount: z.number().int().nonnegative().default(0),
  lastClonedAt: z.string().datetime().optional(),
})

export type ReplicabilityMetadata = z.infer<typeof ReplicabilityMetadataSchema>

/**
 * Extended workflow with replicability
 */
export const ReplicableWorkflowSchema = z.object({
  // Original workflow fields (embedded)
  id: z.string().uuid(),
  workflowType: z.string(),
  requestorId: z.string().uuid(),
  requestorName: z.string(),
  requestDate: z.string().datetime(),
  action: z.string(),
  actionParams: z.record(z.string(), z.unknown()),
  description: z.string(),
  amount: z.number().optional(),
  status: z.string(),
  currentStep: z.number().int().nonnegative(),
  steps: z.array(z.object({
    order: z.number().int(),
    type: z.enum(['APPROVAL', 'NOTICE', 'WAIT', 'DOCUMENT']),
    actor: z.enum(['board', 'shareholders', 'specific', 'system']),
    actorId: z.string().uuid().optional(),
    status: z.string(),
    required: z.boolean(),
    description: z.string(),
    completedAt: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
    response: z.string().optional(),
  })),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  
  // Replicability extension
  replicability: ReplicabilityMetadataSchema,
})

export type ReplicableWorkflow = z.infer<typeof ReplicableWorkflowSchema>

/**
 * Extended resolution with replicability
 */
export const ReplicableResolutionSchema = z.object({
  // Original resolution fields
  id: z.string().uuid(),
  resolutionNumber: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string(),
  recitals: z.array(z.string()),
  clauses: z.array(z.object({
    number: z.string(),
    text: z.string(),
    votesFor: z.number().int().nonnegative().optional(),
    votesAgainst: z.number().int().nonnegative().optional(),
    votesAbstain: z.number().int().nonnegative().optional(),
  })),
  requiredQuorum: z.number().min(0).max(100),
  requiredApproval: z.number().min(0).max(100),
  votesFor: z.number().int().nonnegative(),
  votesAgainst: z.number().int().nonnegative(),
  votesAbstain: z.number().int().nonnegative(),
  quorumMet: z.boolean(),
  approved: z.boolean(),
  signatures: z.array(z.object({
    signerId: z.string().uuid(),
    signerName: z.string(),
    signerRole: z.string(),
    signedAt: z.string().datetime(),
    signatureHash: z.string().optional(),
  })),
  workflowId: z.string().uuid().optional(),
  relatedAction: z.string().optional(),
  meetingId: z.string().uuid().optional(),
  meetingDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FILED']),
  effectiveDate: z.string().datetime().optional(),
  documentUrls: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  
  // Replicability extension
  replicability: ReplicabilityMetadataSchema,
})

export type ReplicableResolution = z.infer<typeof ReplicableResolutionSchema>

/**
 * Template registry entry
 */
export const TemplateRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  type: z.nativeEnum(ReplicableType),
  category: z.string(),
  version: z.string(),
  
  // The actual template content (JSON)
  content: z.record(z.string(), z.unknown()),
  
  // Metadata
  replicability: ReplicabilityMetadataSchema,
  
  // Usage statistics
  usageCount: z.number().int().nonnegative().default(0),
  avgCompletionTime: z.number().optional(), // in hours
  
  // Validation
  validationRules: z.record(z.string(), z.unknown()).default({}),
  isValid: z.boolean().default(true),
  lastValidated: z.string().datetime().optional(),
  validationErrors: z.array(z.string()).default([]),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type TemplateRegistryEntry = z.infer<typeof TemplateRegistryEntrySchema>

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create replicability metadata for a new template
 */
export function createTemplateMetadata(
  name: string,
  category: string,
  createdBy: string,
  content: Record<string, unknown>
): ReplicabilityMetadata {
  const now = new Date().toISOString()
  
  return {
    replicationId: crypto.randomUUID(),
    version: '1.0.0',
    isTemplate: true,
    templateName: name,
    templateCategory: category,
    divergenceLog: [],
    autoSyncWithTemplate: false,
    createdBy,
    createdAt: now,
    updatedAt: now,
    isPublic: false,
    allowedCloners: [],
    cloneCount: 0,
    deprecated: false,
  }
}

/**
 * Clone a template to create a new instance
 */
export function cloneFromTemplate(
  template: TemplateRegistryEntry,
  targetEntityId: string,
  clonedBy: string,
  modifications?: Partial<Record<string, unknown>>
): { content: Record<string, unknown>; replicability: ReplicabilityMetadata } {
  const now = new Date().toISOString()
  const originalContent = { ...template.content }
  const modifiedContent = modifications 
    ? { ...originalContent, ...modifications }
    : originalContent
  
  // Track divergences
  const divergenceLog: Divergence[] = []
  if (modifications) {
    for (const [key, newValue] of Object.entries(modifications)) {
      divergenceLog.push({
        field: key,
        originalValue: originalContent[key],
        currentValue: newValue,
        divergedAt: now,
        divergedBy: clonedBy,
        reason: 'Manual customization',
      })
    }
  }
  
  return {
    content: modifiedContent,
    replicability: {
      replicationId: crypto.randomUUID(),
      version: '1.0.0',
      isTemplate: false,
      sourceId: template.id,
      sourceVersion: template.version,
      relation: ReplicationRelation.CLONED_FROM,
      templateName: template.name,
      templateCategory: template.category,
      divergenceLog,
      autoSyncWithTemplate: false,
      createdBy: clonedBy,
      createdAt: now,
      updatedAt: now,
      isPublic: false,
      allowedCloners: [],
      cloneCount: 0,
      deprecated: false,
    },
  }
}

/**
 * Update a cloned instance to match template updates
 */
export function syncWithTemplate(
  current: ReplicabilityMetadata,
  template: TemplateRegistryEntry,
  updatedBy: string
): ReplicabilityMetadata {
  const now = new Date().toISOString()
  
  // This would need more complex logic to merge template changes
  // with existing customizations
  return {
    ...current,
    sourceVersion: template.version,
    updatedAt: now,
  }
}

// ============================================================================
// TEMPLATE REGISTRY
// ============================================================================

/**
 * In-memory template registry (would be database in production)
 */
class TemplateRegistry {
  private templates: Map<string, TemplateRegistryEntry> = new Map()
  
  /**
   * Register a new template
   */
  register(entry: TemplateRegistryEntry): void {
    this.templates.set(entry.id, entry)
  }
  
  /**
   * Get template by ID
   */
  get(id: string): TemplateRegistryEntry | undefined {
    return this.templates.get(id)
  }
  
  /**
   * Get all templates of a specific type
   */
  getByType(type: ReplicableType): TemplateRegistryEntry[] {
    return Array.from(this.templates.values()).filter(t => t.type === type)
  }
  
  /**
   * Get all templates in a category
   */
  getByCategory(category: string): TemplateRegistryEntry[] {
    return Array.from(this.templates.values()).filter(t => t.category === category)
  }
  
  /**
   * Get all active templates
   */
  getActive(): TemplateRegistryEntry[] {
    return Array.from(this.templates.values()).filter(t => !t.replicability.deprecated)
  }
  
  /**
   * Clone a template for a specific entity
   */
  clone(
    templateId: string,
    entityId: string,
    userId: string,
    modifications?: Partial<Record<string, unknown>>
  ): { content: Record<string, unknown>; replicability: ReplicabilityMetadata } | null {
    const template = this.templates.get(templateId)
    if (!template) return null
    
    const result = cloneFromTemplate(template, entityId, userId, modifications)
    
    // Update clone count on template
    template.replicability.cloneCount++
    template.replicability.lastClonedAt = new Date().toISOString()
    
    return result
  }
  
  /**
   * List all templates
   */
  list(): TemplateRegistryEntry[] {
    return Array.from(this.templates.values())
  }
  
  /**
   * Deprecate a template
   */
  deprecate(id: string, deprecatedBy: string): boolean {
    const template = this.templates.get(id)
    if (!template) return false
    
    template.replicability.deprecated = true
    template.replicability.deprecatedBy = deprecatedBy
    template.replicability.deprecatedAt = new Date().toISOString()
    
    return true
  }
}

// Singleton instance
export const templateRegistry = new TemplateRegistry()

// ============================================================================
// PRE-DEFINED TEMPLATES
// ============================================================================

/**
 * Standard workflow templates
 */
export const STANDARD_WORKFLOW_TEMPLATES = {
  SHARE_ISSUANCE: {
    name: 'Standard Share Issuance',
    category: 'equity',
    type: ReplicableType.WORKFLOW_TEMPLATE,
    description: 'Standard workflow for issuing new shares',
    steps: [
      { order: 0, type: 'APPROVAL' as const, actor: 'board' as const, required: true, description: 'Board approval' },
      { order: 1, type: 'DOCUMENT' as const, actor: 'system' as const, required: true, description: 'Generate subscription agreement' },
      { order: 2, type: 'NOTICE' as const, actor: 'shareholders' as const, required: false, description: 'Shareholder notification' },
    ],
    estimatedDuration: 5,
  },
  
  SHARE_TRANSFER: {
    name: 'Standard Share Transfer',
    category: 'equity',
    type: ReplicableType.WORKFLOW_TEMPLATE,
    description: 'Standard workflow for transferring shares',
    steps: [
      { order: 0, type: 'APPROVAL' as const, actor: 'board' as const, required: true, description: 'Board approval' },
      { order: 1, type: 'DOCUMENT' as const, actor: 'system' as const, required: true, description: 'Generate transfer agreement' },
    ],
    estimatedDuration: 3,
  },
  
  BOARD_RESOLUTION: {
    name: 'Board Resolution',
    category: 'governance',
    type: ReplicableType.WORKFLOW_TEMPLATE,
    description: 'Standard board resolution workflow',
    steps: [
      { order: 0, type: 'APPROVAL' as const, actor: 'board' as const, required: true, description: 'Board vote' },
    ],
    estimatedDuration: 1,
  },
}

/**
 * Initialize standard templates in registry
 */
export function initializeStandardTemplates(createdBy: string): void {
  for (const [key, template] of Object.entries(STANDARD_WORKFLOW_TEMPLATES)) {
    const now = new Date().toISOString()
    
    const entry: TemplateRegistryEntry = {
      id: crypto.randomUUID(),
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      version: '1.0.0',
      content: template as unknown as Record<string, unknown>,
      replicability: createTemplateMetadata(template.name, template.category, createdBy, template),
      usageCount: 0,
      validationRules: {},
      isValid: true,
      validationErrors: [],
      createdAt: now,
      updatedAt: now,
    }
    
    templateRegistry.register(entry)
  }
}
