/**
 * Flow — Event Requirement Enforcement
 *
 * Critical commands must emit at least one domain event on success.
 */
import { logger } from '@/lib/logger'

export interface EventRequirementResult {
  ok: boolean
  message?: string
}

export function enforceCriticalCommandEventRequirement(input: {
  commandType: string
  isCritical: boolean
  success: boolean
  emittedEventIds?: string[]
}): EventRequirementResult {
  if (!input.success || !input.isCritical) return { ok: true }

  const emittedCount = input.emittedEventIds?.length ?? 0
  if (emittedCount > 0) return { ok: true }

  const message = `Critical command ${input.commandType} succeeded without emitting domain events`
  logger.error('Event requirement violated', {
    commandType: input.commandType,
  })

  return { ok: false, message }
}
