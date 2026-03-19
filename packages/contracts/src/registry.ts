import type { z } from 'zod'
import { EVENT_CONTRACTS, type EventType } from './domain.js'

// ─── Contract Registry ─────────────────────────────────────────────────────

export interface ContractEntry {
  readonly eventType: string
  readonly version: number
  readonly schema: z.ZodType
  readonly registeredAt: string
}

export class ContractRegistry {
  private readonly contracts = new Map<string, ContractEntry>()

  register(eventType: string, version: number, schema: z.ZodType): void {
    const key = `${eventType}:v${version}`
    this.contracts.set(key, {
      eventType,
      version,
      schema,
      registeredAt: new Date().toISOString(),
    })
  }

  get(eventType: string, version: number): ContractEntry | undefined {
    return this.contracts.get(`${eventType}:v${version}`)
  }

  validate(eventType: string, version: number, payload: unknown): { valid: boolean; errors?: string[] } {
    const entry = this.get(eventType, version)
    if (!entry) {
      return { valid: false, errors: [`No contract registered for ${eventType} v${version}`] }
    }

    const result = entry.schema.safeParse(payload)
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      }
    }
    return { valid: true }
  }

  listContracts(): ContractEntry[] {
    return Array.from(this.contracts.values())
  }
}

// ─── Default Registry with Built-in Contracts ───────────────────────────────

export function createDefaultRegistry(): ContractRegistry {
  const registry = new ContractRegistry()

  for (const [eventType, versions] of Object.entries(EVENT_CONTRACTS)) {
    for (const [versionKey, schema] of Object.entries(versions)) {
      const version = parseInt(versionKey.replace('v', ''), 10)
      registry.register(eventType, version, schema)
    }
  }

  return registry
}

let globalRegistry: ContractRegistry | undefined

export function getContractRegistry(): ContractRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry()
  }
  return globalRegistry
}

export function setContractRegistry(registry: ContractRegistry): void {
  globalRegistry = registry
}

// ─── Type-safe Validation Helper ────────────────────────────────────────────

export function validateEventPayload<T extends EventType>(
  eventType: T,
  version: number,
  payload: unknown,
): { valid: boolean; errors?: string[] } {
  return getContractRegistry().validate(eventType, version, payload)
}
