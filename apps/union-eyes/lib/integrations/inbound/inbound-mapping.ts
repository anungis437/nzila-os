/**
 * The versioned mapping a receipt pins (INT-11).
 *
 * A stored rule (ue_integration_mapping_versions.rule, the platform MappingRuleDefinition shape) is interpreted here,
 * deterministically: the same payload and the same version always give the same result. Only the operations below are
 * supported; a rule that names any other operation fails the delivery rather than being half-applied. An error names the
 * target field and a code, never the source value.
 */
import type { FieldMapping, MappingRuleDefinition } from '@nzila/platform-integrations-types'

export interface InboundMappingResult {
  readonly success: boolean
  readonly data: Record<string, unknown> | null
  readonly errors: ReadonlyArray<{ field: string; code: string }>
}

export const SUPPORTED_OPERATIONS = ['rename', 'constant', 'default', 'enum_translate', 'omit'] as const

function read(input: Record<string, unknown>, path: string): unknown {
  let current: unknown = input
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function apply(input: Record<string, unknown>, field: FieldMapping): { value?: unknown; code?: string } {
  const source = read(input, field.sourceField)
  switch (field.operation) {
    case 'rename':
      return source === undefined || source === null ? { code: 'REQUIRED_MISSING' } : { value: source }
    case 'constant':
      return 'value' in field.config ? { value: field.config.value } : { code: 'RULE_INVALID' }
    case 'default':
      return { value: source === undefined || source === null ? field.config.value : source }
    case 'enum_translate': {
      const map = field.config.map as Record<string, unknown> | undefined
      if (!map || typeof map !== 'object') return { code: 'RULE_INVALID' }
      if (source === undefined || source === null) return { code: 'REQUIRED_MISSING' }
      const key = String(source)
      // An unmapped source value is an error, never a fallback.
      return Object.prototype.hasOwnProperty.call(map, key) ? { value: map[key] } : { code: 'ENUM_UNMAPPED' }
    }
    case 'omit':
      return {}
    default:
      return { code: 'OPERATION_UNSUPPORTED' }
  }
}

export function applyInboundMapping(input: Record<string, unknown>, rule: MappingRuleDefinition): InboundMappingResult {
  const errors: Array<{ field: string; code: string }> = []
  const output: Record<string, unknown> = {}
  if (!rule || !Array.isArray(rule.fields) || rule.fields.length === 0) return { success: false, data: null, errors: [{ field: 'rule', code: 'RULE_INVALID' }] }
  for (const field of rule.fields) {
    const result = apply(input, field)
    if (result.code) {
      // An optional field that is simply absent is left out; a broken rule or an unmapped value is an error either way.
      if (result.code === 'REQUIRED_MISSING' && !field.required) continue
      errors.push({ field: field.targetField, code: result.code })
    } else if (field.operation !== 'omit' && result.value !== undefined) {
      output[field.targetField] = result.value
    }
  }
  return errors.length ? { success: false, data: null, errors } : { success: true, data: output, errors }
}
