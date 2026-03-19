import type { DomainEvent, EventMetadata } from '@nzila/contracts'

// ─── Event Handler Type ─────────────────────────────────────────────────────

export type EventHandler<T = Record<string, unknown>> = (
  event: DomainEvent & { payload: T },
) => void | Promise<void>

// ─── Typed Event Bus ────────────────────────────────────────────────────────

export class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>()
  private readonly wildcardHandlers: EventHandler[] = []

  on<T = Record<string, unknown>>(eventType: string, handler: EventHandler<T>): () => void {
    const existing = this.handlers.get(eventType) ?? []
    existing.push(handler as EventHandler)
    this.handlers.set(eventType, existing)

    return () => {
      const idx = existing.indexOf(handler as EventHandler)
      if (idx >= 0) existing.splice(idx, 1)
    }
  }

  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.push(handler)
    return () => {
      const idx = this.wildcardHandlers.indexOf(handler)
      if (idx >= 0) this.wildcardHandlers.splice(idx, 1)
    }
  }

  async emit(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? []
    const allHandlers = [...handlers, ...this.wildcardHandlers]

    const errors: Error[] = []

    for (const handler of allHandlers) {
      try {
        await handler(event)
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)))
      }
    }

    if (errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ')
      throw new Error(`Event handler errors (${errors.length}): ${errorMessages}`)
    }
  }

  async emitSafe(event: DomainEvent): Promise<{ delivered: number; errors: Error[] }> {
    const handlers = this.handlers.get(event.type) ?? []
    const allHandlers = [...handlers, ...this.wildcardHandlers]

    const errors: Error[] = []
    let delivered = 0

    for (const handler of allHandlers) {
      try {
        await handler(event)
        delivered++
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)))
      }
    }

    return { delivered, errors }
  }

  hasHandlers(eventType: string): boolean {
    return (this.handlers.get(eventType)?.length ?? 0) > 0 || this.wildcardHandlers.length > 0
  }

  clear(): void {
    this.handlers.clear()
    this.wildcardHandlers.length = 0
  }
}
