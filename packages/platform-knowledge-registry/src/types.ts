/**
 * @nzila/platform-knowledge-registry — Types
 *
 * Centralized knowledge asset types for policies, rules, playbooks, etc.
 */
import { z } from 'zod'

// ── Knowledge Types ─────────────────────────────────────────────────────────

export const KnowledgeTypes = {
  POLICY: 'policy',
  RULE: 'rule',
  PROGRAM_REQUIREMENT: 'program_requirement',
  PLAYBOOK: 'playbook',
  TEMPLATE: 'template',
  THRESHOLD_TABLE: 'threshold_table',
  JURISDICTION_NOTE: 'jurisdiction_note',
  COMPLIANCE_PROCEDURE: 'compliance_procedure',
  TAXONOMY_DEFINITION: 'taxonomy_definition',
  PROMPT_TEMPLATE: 'prompt_template',
  DECISION_RULE: 'decision_rule',
} as const

export type KnowledgeType = (typeof KnowledgeTypes)[keyof typeof KnowledgeTypes]

// ── Knowledge Asset Status ──────────────────────────────────────────────────

export const KnowledgeStatuses = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  ARCHIVED: 'archived',
} as const

export type KnowledgeStatus = (typeof KnowledgeStatuses)[keyof typeof KnowledgeStatuses]

// ── Knowledge Asset ─────────────────────────────────────────────────────────

export interface KnowledgeAsset {
  readonly id: string
  readonly tenantScope: string
  readonly domainScope: string
  readonly title: string
  readonly knowledgeType: KnowledgeType
  readonly source: string
  readonly version: number
  readonly effectiveDate: string
  readonly status: KnowledgeStatus
  readonly tags: readonly string[]
  readonly structuredPayload: Record<string, unknown>
  readonly textPayload: string
  readonly createdAt: string
  readonly updatedAt: string
}

// ── Knowledge Version ───────────────────────────────────────────────────────

export interface KnowledgeVersion {
  readonly id: string
  readonly assetId: string
  readonly version: number
  readonly structuredPayload: Record<string, unknown>
  readonly textPayload: string
  readonly changedBy: string
  readonly changeReason: string
  readonly createdAt: string
}

// ── Create / Update DTOs ────────────────────────────────────────────────────

export interface CreateKnowledgeAssetInput {
  readonly tenantScope: string
  readonly domainScope: string
  readonly title: string
  readonly knowledgeType: KnowledgeType
  readonly source: string
  readonly effectiveDate: string
  readonly tags?: readonly string[]
  readonly structuredPayload?: Record<string, unknown>
  readonly textPayload?: string
}

export interface UpdateKnowledgeAssetInput {
  readonly title?: string
  readonly status?: KnowledgeStatus
  readonly effectiveDate?: string
  readonly tags?: readonly string[]
  readonly structuredPayload?: Record<string, unknown>
  readonly textPayload?: string
  readonly changedBy: string
  readonly changeReason: string
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface KnowledgeSearchQuery {
  readonly tenantScope?: string
  readonly domainScope?: string
  readonly knowledgeType?: KnowledgeType
  readonly tags?: readonly string[]
  readonly status?: KnowledgeStatus
  readonly query?: string
}

// ── Knowledge Store Interface ───────────────────────────────────────────────

export interface KnowledgeStore {
  register(asset: KnowledgeAsset): Promise<void>
  get(id: string): Promise<KnowledgeAsset | undefined>
  search(query: KnowledgeSearchQuery): Promise<readonly KnowledgeAsset[]>
  update(id: string, input: UpdateKnowledgeAssetInput): Promise<KnowledgeAsset | undefined>
  getVersion(assetId: string, version: number): Promise<KnowledgeVersion | undefined>
  listVersions(assetId: string): Promise<readonly KnowledgeVersion[]>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const knowledgeTypeValues = Object.values(KnowledgeTypes) as [string, ...string[]]
const knowledgeStatusValues = Object.values(KnowledgeStatuses) as [string, ...string[]]

export const KnowledgeAssetSchema = z.object({
  id: z.guid(),
  tenantScope: z.string().min(1),
  domainScope: z.string().min(1),
  title: z.string().min(1).max(512),
  knowledgeType: z.enum(knowledgeTypeValues),
  source: z.string().min(1),
  version: z.number().int().positive(),
  effectiveDate: z.string().datetime(),
  status: z.enum(knowledgeStatusValues),
  tags: z.array(z.string().min(1)).default([]),
  structuredPayload: z.record(z.string(), z.unknown()).prefault({}),
  textPayload: z.string().default(''),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const CreateKnowledgeAssetSchema = z.object({
  tenantScope: z.string().min(1),
  domainScope: z.string().min(1),
  title: z.string().min(1).max(512),
  knowledgeType: z.enum(knowledgeTypeValues),
  source: z.string().min(1),
  effectiveDate: z.string().datetime(),
  tags: z.array(z.string().min(1)).optional(),
  structuredPayload: z.record(z.string(), z.unknown()).optional(),
  textPayload: z.string().optional(),
})
