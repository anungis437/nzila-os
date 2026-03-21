import type { DomainEvent } from '@nzila/contracts'

// ─── Event Store Interface ──────────────────────────────────────────────────

export interface EventStore {
  save(event: DomainEvent): Promise<void>
  getByType(eventType: string, options?: { limit?: number }): Promise<DomainEvent[]>
  getByCorrelation(correlationId: string): Promise<DomainEvent[]>
  getByOrg(orgId: string, options?: { limit?: number }): Promise<DomainEvent[]>
}

// ─── In-Memory Event Store (testing / development) ──────────────────────────

export class InMemoryEventStore implements EventStore {
  private readonly events: DomainEvent[] = []

  async save(event: DomainEvent): Promise<void> {
    this.events.push(Object.freeze({ ...event }))
  }

  async getByType(eventType: string, options?: { limit?: number }): Promise<DomainEvent[]> {
    const filtered = this.events.filter((e) => e.type === eventType)
    return filtered.slice(-(options?.limit ?? 1000))
  }

  async getByCorrelation(correlationId: string): Promise<DomainEvent[]> {
    return this.events.filter((e) => e.metadata.correlationId === correlationId)
  }

  async getByOrg(orgId: string, options?: { limit?: number }): Promise<DomainEvent[]> {
    const filtered = this.events.filter((e) => e.metadata.orgId === orgId)
    return filtered.slice(-(options?.limit ?? 1000))
  }

  /** Test helper */
  getAll(): readonly DomainEvent[] {
    return this.events
  }
}
