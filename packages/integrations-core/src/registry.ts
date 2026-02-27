/**
 * Nzila OS — Integration Control Plane: Adapter Registry
 *
 * Manages adapter registration and lookup per provider + channel.
 */
import type { IntegrationAdapter, IntegrationProvider, IntegrationType } from './types'

type RegistryKey = `${IntegrationProvider}:${IntegrationType}`

function registryKey(provider: IntegrationProvider, channel: IntegrationType): RegistryKey {
  return `${provider}:${channel}`
}

export class IntegrationRegistry {
  private readonly adapters = new Map<RegistryKey, IntegrationAdapter>()

  register(adapter: IntegrationAdapter): void {
    const key = registryKey(adapter.provider, adapter.channel)
    if (this.adapters.has(key)) {
      throw new Error(`Adapter already registered for ${key}`)
    }
    this.adapters.set(key, adapter)
  }

  get(provider: IntegrationProvider, channel: IntegrationType): IntegrationAdapter | undefined {
    return this.adapters.get(registryKey(provider, channel))
  }

  getOrThrow(provider: IntegrationProvider, channel: IntegrationType): IntegrationAdapter {
    const adapter = this.get(provider, channel)
    if (!adapter) {
      throw new Error(`No adapter registered for ${provider}:${channel}`)
    }
    return adapter
  }

  has(provider: IntegrationProvider, channel: IntegrationType): boolean {
    return this.adapters.has(registryKey(provider, channel))
  }

  listProviders(): IntegrationProvider[] {
    const providers = new Set<IntegrationProvider>()
    for (const adapter of this.adapters.values()) {
      providers.add(adapter.provider)
    }
    return [...providers]
  }

  listAdapters(): readonly IntegrationAdapter[] {
    return [...this.adapters.values()]
  }

  clear(): void {
    this.adapters.clear()
  }
}

/** Singleton registry for the platform */
export const integrationRegistry = new IntegrationRegistry()
