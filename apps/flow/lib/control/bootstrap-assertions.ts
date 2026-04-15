/**
 * Flow — Control Bootstrap Assertions
 *
 * Ensures critical control-layer registration is present at runtime.
 */
import {
  getRegisteredCommandTypes,
  getRequiredCriticalCommandTypes,
} from '@/lib/control/command-bus'
import {
  getRegisteredSideEffectTypes,
  REQUIRED_SIDE_EFFECT_TYPES,
} from '@/lib/control/dispatch/side-effect-dispatcher'
import { isEventPersistenceInitialized } from '@/lib/events/persist'

export interface BootstrapAssertionResult {
  ok: boolean
  missingCriticalCommands: string[]
  missingSideEffects: string[]
  eventPersistenceInitialized: boolean
  errors: string[]
}

export function validateBootstrapState(): BootstrapAssertionResult {
  const registeredCommands = new Set(getRegisteredCommandTypes())
  const missingCriticalCommands = getRequiredCriticalCommandTypes().filter((cmd) => !registeredCommands.has(cmd))

  const registeredSideEffects = new Set(getRegisteredSideEffectTypes())
  const missingSideEffects = REQUIRED_SIDE_EFFECT_TYPES.filter((type) => !registeredSideEffects.has(type))

  const eventPersistenceInitialized = isEventPersistenceInitialized()

  const errors: string[] = []
  if (missingCriticalCommands.length > 0) {
    errors.push(`Missing critical command handlers: ${missingCriticalCommands.join(', ')}`)
  }
  if (missingSideEffects.length > 0) {
    errors.push(`Missing side-effect registrations: ${missingSideEffects.join(', ')}`)
  }
  if (!eventPersistenceInitialized) {
    errors.push('Domain event persistence listener is not initialized')
  }

  return {
    ok: errors.length === 0,
    missingCriticalCommands,
    missingSideEffects,
    eventPersistenceInitialized,
    errors,
  }
}

export function assertBootstrapState(options?: { strict?: boolean }): BootstrapAssertionResult {
  const strict = options?.strict ?? process.env.NODE_ENV !== 'test'
  const result = validateBootstrapState()

  if (strict && !result.ok) {
    throw new Error(`Flow control bootstrap failed: ${result.errors.join(' | ')}`)
  }

  return result
}
