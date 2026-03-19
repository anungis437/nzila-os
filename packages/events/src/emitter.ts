import { randomUUID } from 'node:crypto'
import type { DomainEvent, EventMetadata } from '@nzila/contracts'
import { getContractRegistry } from '@nzila/contracts'
import type { EventBus } from './bus.js'
import type { EventStore } from './store.js'

// ─── Emitter Configuration ─────────────────────────────────────────────────

export interface EventEmitterConfig {
  readonly bus: EventBus
  readonly store?: EventStore
  readonly validateContracts?: boolean
  readonly source: string
}

// ─── Typed Event Emitter ────────────────────────────────────────────────────

export class EventEmitter {
  private readonly config: EventEmitterConfig

  constructor(config: EventEmitterConfig) {
    this.config = config
  }

  async emitEvent(
    eventType: string,
    payload: Record<string, unknown>,
    metadata: Omit<EventMetadata, 'source'>,
    version = 1,
  ): Promise<DomainEvent> {
    // Validate against contract if enabled
    if (this.config.validateContracts !== false) {
      const registry = getContractRegistry()
      const validation = registry.validate(eventType, version, payload)
      if (!validation.valid) {
        throw new Error(
          `Contract violation for ${eventType} v${version}: ${validation.errors?.join(', ')}`,
        )
      }
    }

    const event: DomainEvent = {
      id: randomUUID(),
      type: eventType,
      version,
      payload,
      metadata: {
        ...metadata,
        source: this.config.source,
      },
      timestamp: new Date().toISOString(),
    }

    // Persist if store is configured
    if (this.config.store) {
      await this.config.store.save(event)
    }

    // Dispatch to bus
    await this.config.bus.emit(event)

    return event
  }
}

// ─── Convenience Functions ──────────────────────────────────────────────────

let globalEmitter: EventEmitter | undefined

export function setGlobalEmitter(emitter: EventEmitter): void {
  globalEmitter = emitter
}

export function getGlobalEmitter(): EventEmitter {
  if (!globalEmitter) {
    throw new Error('Global EventEmitter not configured — call setGlobalEmitter() first')
  }
  return globalEmitter
}

export async function emitEvent(
  eventType: string,
  payload: Record<string, unknown>,
  metadata: Omit<EventMetadata, 'source'>,
  version = 1,
): Promise<DomainEvent> {
  return getGlobalEmitter().emitEvent(eventType, payload, metadata, version)
}
