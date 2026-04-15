/**
 * Flow — Runtime Control Layer Bootstrap
 *
 * Registers handlers, side-effect integrations, and domain event persistence.
 * Safe to call multiple times.
 */
import { assertBootstrapState } from '@/lib/control/bootstrap-assertions'
import { initEventPersistence } from '@/lib/events/persist'

let bootstrapped = false

export async function bootstrapFlowControlLayer(): Promise<void> {
  if (bootstrapped) {
    assertBootstrapState({ strict: process.env.NODE_ENV !== 'test' })
    return
  }

  // Module side effects perform registration.
  await import('@/lib/control/register-handlers')
  await import('@/lib/control/register-integrations')

  // Event persistence must be active for reliable audit history.
  initEventPersistence()

  assertBootstrapState({ strict: process.env.NODE_ENV !== 'test' })
  bootstrapped = true
}

export function isFlowControlLayerBootstrapped(): boolean {
  return bootstrapped
}
