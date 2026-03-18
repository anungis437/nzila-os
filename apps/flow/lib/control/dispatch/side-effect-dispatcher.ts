/**
 * Flow — Side Effect Dispatcher
 *
 * Dispatches external integration side effects AFTER authoritative
 * state mutation and event persistence. Side effects never control
 * domain state — failures produce warnings, not rollbacks.
 */
import { logger } from '@/lib/logger'
import { IntegrationDispatchError } from '@/lib/control/errors/integration-dispatch-error'

export type SideEffectType = 'zoho_sync' | 'shopify_sync' | 'canva_update' | 'customer_notification'

export interface SideEffectRequest {
  type: SideEffectType
  entity_type: string
  entity_id: string
  org_id: string
  payload: Record<string, unknown>
}

export interface SideEffectResult {
  type: SideEffectType
  success: boolean
  warning?: string
  error?: string
}

type SideEffectHandler = (request: SideEffectRequest) => Promise<SideEffectResult>
const handlers = new Map<SideEffectType, SideEffectHandler>()

export function registerSideEffectHandler(
  type: SideEffectType,
  handler: SideEffectHandler,
): void {
  handlers.set(type, handler)
}

export async function dispatchSideEffect(
  request: SideEffectRequest,
): Promise<SideEffectResult> {
  const handler = handlers.get(request.type)
  if (!handler) {
    logger.warn('No side-effect handler registered', { type: request.type })
    return {
      type: request.type,
      success: false,
      warning: `No handler registered for side-effect type "${request.type}"`,
    }
  }

  try {
    const result = await handler(request)

    if (!result.success) {
      logger.warn('Side-effect dispatch returned failure', {
        type: request.type,
        entityId: request.entity_id,
        error: result.error,
      })
    }

    return result
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('Side-effect dispatch threw', {
      type: request.type,
      entityId: request.entity_id,
      error: message,
    })

    return {
      type: request.type,
      success: false,
      error: message,
    }
  }
}

export async function dispatchSideEffects(
  requests: SideEffectRequest[],
): Promise<{ results: SideEffectResult[]; warnings: string[] }> {
  const results: SideEffectResult[] = []
  const warnings: string[] = []

  for (const request of requests) {
    const result = await dispatchSideEffect(request)
    results.push(result)
    if (result.warning) warnings.push(result.warning)
    if (result.error) warnings.push(`[${request.type}] ${result.error}`)
  }

  return { results, warnings }
}
