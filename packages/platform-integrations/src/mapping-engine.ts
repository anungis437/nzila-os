/**
 * @nzila/platform-integrations — Mapping Engine
 *
 * Reusable schema mapping and transformation engine.
 * Supports field renaming, enum translation, date normalization,
 * nested extraction, identity lookup, and validation.
 */
import type {
  MappingRuleDefinition,
  FieldMapping,
  MappingResult,
  MappingError,
  MappingWarning,
  TransformationStep,
  MappingOperationType,
  EnumTranslationMap,
  DateNormalizationConfig,
  ValidationRule,
} from '@nzila/platform-integrations-types'

// ─── Mapping Context ─────────────────────────────────────────────────────────

export interface MappingContext {
  readonly orgId: string
  readonly connectionId: string
  resolveIdentity?(entityType: string, externalId: string): Promise<string | null>
}

// ─── Mapping Engine ──────────────────────────────────────────────────────────

export class MappingEngine {
  /**
   * Execute a mapping rule against an input payload.
   * Returns a structured result with data, errors, warnings, and transformation log.
   */
  async execute(
    input: Record<string, unknown>,
    rule: MappingRuleDefinition,
    context: MappingContext,
  ): Promise<MappingResult> {
    const errors: MappingError[] = []
    const warnings: MappingWarning[] = []
    const log: TransformationStep[] = []
    const output: Record<string, unknown> = {}

    // Pre-validation
    if (rule.preValidation) {
      const preErrors = this.validate(input, rule.preValidation)
      if (preErrors.length > 0) {
        return { success: false, data: null, errors: preErrors, warnings: [], transformationLog: [] }
      }
    }

    // Apply field mappings
    for (const field of rule.fields) {
      try {
        const result = await this.applyFieldMapping(input, field, context)
        if (result.error) {
          if (field.required) {
            errors.push(result.error)
          } else {
            warnings.push({ field: field.targetField, message: result.error.message, code: result.error.code })
          }
        } else {
          output[field.targetField] = result.value
          log.push({
            field: field.targetField,
            operation: field.operation,
            sourceValue: result.sourceValue,
            resultValue: result.value,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown mapping error'
        errors.push({ field: field.targetField, message, code: 'MAPPING_EXCEPTION', sourceValue: undefined })
      }
    }

    // Post-validation
    if (rule.postValidation && errors.length === 0) {
      const postErrors = this.validate(output, rule.postValidation)
      errors.push(...postErrors)
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? output : null,
      errors,
      warnings,
      transformationLog: log,
    }
  }

  /**
   * Dry-run mode — validate and preview without committing.
   */
  async preview(
    input: Record<string, unknown>,
    rule: MappingRuleDefinition,
    context: MappingContext,
  ): Promise<MappingResult> {
    return this.execute(input, rule, context)
  }

  /**
   * Validate a mapping rule definition for correctness.
   */
  validateRule(rule: MappingRuleDefinition): MappingError[] {
    const errors: MappingError[] = []
    const targetFields = new Set<string>()

    for (const field of rule.fields) {
      if (targetFields.has(field.targetField)) {
        errors.push({
          field: field.targetField,
          message: `Duplicate target field: ${field.targetField}`,
          code: 'DUPLICATE_TARGET',
        })
      }
      targetFields.add(field.targetField)

      if (field.operation === 'enum_translate' && !field.config['mappings']) {
        errors.push({
          field: field.targetField,
          message: 'enum_translate requires a "mappings" config',
          code: 'MISSING_CONFIG',
        })
      }
    }

    return errors
  }

  // ─── Private Methods ─────────────────────────────────────────────────────

  private async applyFieldMapping(
    input: Record<string, unknown>,
    field: FieldMapping,
    context: MappingContext,
  ): Promise<{ value: unknown; sourceValue: unknown; error?: MappingError }> {
    const sourceValue = this.getNestedValue(input, field.sourceField)

    switch (field.operation) {
      case 'rename':
        if (sourceValue === undefined && field.required) {
          return { value: undefined, sourceValue, error: { field: field.targetField, message: `Required field missing: ${field.sourceField}`, code: 'REQUIRED_MISSING' } }
        }
        return { value: sourceValue, sourceValue }

      case 'constant':
        return { value: field.config['value'], sourceValue }

      case 'default':
        return { value: sourceValue ?? field.config['defaultValue'], sourceValue }

      case 'enum_translate': {
        const map = field.config as unknown as EnumTranslationMap
        const source = String(sourceValue ?? '')
        const translated = map.mappings?.[source]
        if (translated !== undefined) {
          return { value: translated, sourceValue }
        }
        if (map.unmappedPolicy === 'use_default' && map.defaultValue !== undefined) {
          return { value: map.defaultValue, sourceValue }
        }
        if (map.unmappedPolicy === 'skip') {
          return { value: undefined, sourceValue }
        }
        return { value: undefined, sourceValue, error: { field: field.targetField, message: `No enum mapping for value: ${source}`, code: 'ENUM_UNMAPPED', sourceValue } }
      }

      case 'nested_extract': {
        const path = (field.config['path'] as string) ?? field.sourceField
        const extracted = this.getNestedValue(input, path)
        return { value: extracted, sourceValue: extracted }
      }

      case 'date_normalize': {
        const config = field.config as unknown as DateNormalizationConfig
        if (sourceValue == null) {
          return { value: config.fallbackValue ?? null, sourceValue }
        }
        try {
          const date = new Date(String(sourceValue))
          if (isNaN(date.getTime())) {
            return { value: undefined, sourceValue, error: { field: field.targetField, message: `Invalid date: ${sourceValue}`, code: 'INVALID_DATE', sourceValue } }
          }
          return { value: date.toISOString(), sourceValue }
        } catch {
          return { value: undefined, sourceValue, error: { field: field.targetField, message: `Date parse error: ${sourceValue}`, code: 'DATE_PARSE_ERROR', sourceValue } }
        }
      }

      case 'identity_lookup': {
        if (!context.resolveIdentity) {
          return { value: undefined, sourceValue, error: { field: field.targetField, message: 'Identity resolver not configured', code: 'NO_IDENTITY_RESOLVER' } }
        }
        const entityType = (field.config['entityType'] as string) ?? 'user'
        const resolved = await context.resolveIdentity(entityType, String(sourceValue))
        if (!resolved && field.required) {
          return { value: undefined, sourceValue, error: { field: field.targetField, message: `Identity not found: ${sourceValue}`, code: 'IDENTITY_NOT_FOUND', sourceValue } }
        }
        return { value: resolved, sourceValue }
      }

      case 'coerce': {
        const targetType = field.config['type'] as string
        return { value: this.coerceValue(sourceValue, targetType), sourceValue }
      }

      case 'omit':
        return { value: undefined, sourceValue }

      case 'flatten': {
        if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
          const flattened = this.flattenObject(sourceValue as Record<string, unknown>, field.config['prefix'] as string)
          return { value: flattened, sourceValue }
        }
        return { value: sourceValue, sourceValue }
      }

      case 'computed': {
        // computed fields evaluate a simple expression
        const expr = field.config['expression'] as string
        if (!expr) {
          return { value: undefined, sourceValue, error: { field: field.targetField, message: 'Computed field requires an expression', code: 'MISSING_EXPRESSION' } }
        }
        // Only support simple template-style expressions: ${fieldName}
        const computed = expr.replace(/\$\{([^}]+)\}/g, (_, key) => {
          const val = this.getNestedValue(input, key.trim())
          return val != null ? String(val) : ''
        })
        return { value: computed, sourceValue }
      }

      default:
        return { value: sourceValue, sourceValue, error: { field: field.targetField, message: `Unknown operation: ${field.operation}`, code: 'UNKNOWN_OPERATION' } }
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.')
    let current: unknown = obj
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  private coerceValue(value: unknown, targetType: string): unknown {
    if (value == null) return null
    switch (targetType) {
      case 'string': return String(value)
      case 'number': return Number(value)
      case 'boolean': return Boolean(value)
      case 'integer': return Math.round(Number(value))
      default: return value
    }
  }

  private flattenObject(obj: Record<string, unknown>, prefix?: string): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, fullKey))
      } else {
        result[fullKey] = value
      }
    }
    return result
  }

  private validate(data: Record<string, unknown>, rules: readonly ValidationRule[]): MappingError[] {
    const errors: MappingError[] = []

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field)

      switch (rule.rule) {
        case 'required':
          if (value == null || value === '') {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_REQUIRED' })
          }
          break
        case 'min_length':
          if (typeof value === 'string' && value.length < (rule.params['min'] as number ?? 0)) {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_MIN_LENGTH' })
          }
          break
        case 'max_length':
          if (typeof value === 'string' && value.length > (rule.params['max'] as number ?? Infinity)) {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_MAX_LENGTH' })
          }
          break
        case 'pattern':
          if (typeof value === 'string' && !(new RegExp(rule.params['pattern'] as string).test(value))) {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_PATTERN' })
          }
          break
        case 'enum':
          if (!((rule.params['values'] as string[]) ?? []).includes(String(value))) {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_ENUM' })
          }
          break
        case 'type': {
          const expectedType = rule.params['type'] as string
          if (expectedType && typeof value !== expectedType) {
            errors.push({ field: rule.field, message: rule.message, code: 'VALIDATION_TYPE' })
          }
          break
        }
      }
    }

    return errors
  }
}
