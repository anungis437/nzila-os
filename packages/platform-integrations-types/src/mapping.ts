/**
 * @nzila/platform-integrations-types — Mapping Types
 *
 * Canonical types for schema mapping, transformation, and field rules.
 */

// ─── Mapping Rule ────────────────────────────────────────────────────────────

export type MappingOperationType =
  | 'rename'
  | 'constant'
  | 'default'
  | 'enum_translate'
  | 'nested_extract'
  | 'date_normalize'
  | 'identity_lookup'
  | 'computed'
  | 'coerce'
  | 'omit'
  | 'flatten'

export interface FieldMapping {
  readonly sourceField: string
  readonly targetField: string
  readonly operation: MappingOperationType
  readonly config: Record<string, unknown>
  readonly required: boolean
}

export interface MappingRule {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly entityType: string
  readonly ruleJson: MappingRuleDefinition
  readonly version: number
  readonly active: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface MappingRuleDefinition {
  readonly name: string
  readonly description?: string
  readonly sourceEntityType: string
  readonly targetEntityType: string
  readonly fields: readonly FieldMapping[]
  readonly preValidation?: readonly ValidationRule[]
  readonly postValidation?: readonly ValidationRule[]
}

export interface ValidationRule {
  readonly field: string
  readonly rule: 'required' | 'min_length' | 'max_length' | 'pattern' | 'enum' | 'range' | 'type' | 'custom'
  readonly params: Record<string, unknown>
  readonly message: string
}

export interface CreateMappingRuleInput {
  readonly orgId: string
  readonly connectionId: string
  readonly entityType: string
  readonly ruleJson: MappingRuleDefinition
}

// ─── Mapping Result ──────────────────────────────────────────────────────────

export interface MappingResult<T = Record<string, unknown>> {
  readonly success: boolean
  readonly data: T | null
  readonly errors: readonly MappingError[]
  readonly warnings: readonly MappingWarning[]
  readonly transformationLog: readonly TransformationStep[]
}

export interface MappingError {
  readonly field: string
  readonly message: string
  readonly code: string
  readonly sourceValue?: unknown
}

export interface MappingWarning {
  readonly field: string
  readonly message: string
  readonly code: string
}

export interface TransformationStep {
  readonly field: string
  readonly operation: MappingOperationType
  readonly sourceValue: unknown
  readonly resultValue: unknown
  readonly timestamp: string
}

// ─── Enum Translation Map ────────────────────────────────────────────────────

export interface EnumTranslationMap {
  readonly sourceEnum: string
  readonly targetEnum: string
  readonly mappings: Record<string, string>
  readonly defaultValue?: string
  readonly unmappedPolicy: 'error' | 'skip' | 'use_default'
}

// ─── Date Normalization ──────────────────────────────────────────────────────

export interface DateNormalizationConfig {
  readonly sourceFormat?: string // auto-detect if not specified
  readonly targetFormat: string // ISO 8601 default
  readonly timezone?: string
  readonly fallbackValue?: string
}
