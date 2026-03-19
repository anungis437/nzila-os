import { domainEventSchema, type DomainEvent } from './domain.js'

// ─── Runtime Validators ─────────────────────────────────────────────────────

export function validateDomainEvent(event: unknown): { valid: boolean; errors?: string[] } {
  const result = domainEventSchema.safeParse(event)
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    }
  }
  return { valid: true }
}

export function parseDomainEvent(event: unknown): DomainEvent {
  return domainEventSchema.parse(event)
}

export function safeParseDomainEvent(event: unknown): { success: true; data: DomainEvent } | { success: false; errors: string[] } {
  const result = domainEventSchema.safeParse(event)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
  }
}
