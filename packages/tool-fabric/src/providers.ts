/**
 * @nzila/tool-fabric — external tool providers
 *
 * A provider is a *source of descriptors*. It never holds authority: the
 * `authority` field is the literal 'NONE' and is part of the type so no
 * provider can be modelled as self-authorising.
 */
import { z } from 'zod'

import {
  type ToolDescriptor,
  type ToolSideEffect,
  type ToolSourceClass,
} from './types'

export interface ToolProviderDescriptor {
  readonly providerId: string
  readonly displayName: string
  readonly kind: 'REGISTRY' | 'HARNESS_GENERATOR' | 'NATIVE'
  readonly homepage?: string
  readonly license?: string
  readonly defaultSourceClass: ToolSourceClass
  readonly authority: 'NONE'
  readonly installModel: string
  readonly telemetry: {
    readonly thirdParty: boolean
    /** Env the broker injects unconditionally for this provider's tools. */
    readonly forcedOptOutEnv: Readonly<Record<string, string>>
  }
}

/** CLI-Hub: public registry + package manager for CLI-Anything harnesses. */
export const CLI_HUB_PROVIDER: ToolProviderDescriptor = {
  providerId: 'cli-hub',
  displayName: 'CLI-Hub (CLI-Anything registry)',
  kind: 'REGISTRY',
  homepage: 'https://github.com/HKUDS/CLI-Anything',
  license: 'Apache-2.0',
  defaultSourceClass: 'REGISTRY_LISTED',
  authority: 'NONE',
  installModel: 'pip install (frequently git+https from a mutable ref)',
  telemetry: {
    thirdParty: true,
    forcedOptOutEnv: { CLI_HUB_NO_ANALYTICS: '1' },
  },
}

/** CLI-Anything methodology as a development-time harness generator. */
export const CLI_ANYTHING_GENERATOR_PROVIDER: ToolProviderDescriptor = {
  providerId: 'cli-anything-generator',
  displayName: 'CLI-Anything harness generator',
  kind: 'HARNESS_GENERATOR',
  homepage: 'https://github.com/HKUDS/CLI-Anything',
  license: 'Apache-2.0',
  defaultSourceClass: 'GENERATED_HARNESS',
  authority: 'NONE',
  installModel: 'development-time only; output is a candidate, not a tool',
  telemetry: {
    thirdParty: true,
    forcedOptOutEnv: { CLI_HUB_NO_ANALYTICS: '1' },
  },
}

export class ToolProviderRegistry {
  private readonly providers = new Map<string, ToolProviderDescriptor>()

  constructor(initial: readonly ToolProviderDescriptor[] = [CLI_HUB_PROVIDER, CLI_ANYTHING_GENERATOR_PROVIDER]) {
    for (const p of initial) this.register(p)
  }

  register(provider: ToolProviderDescriptor): void {
    if (provider.authority !== 'NONE') {
      throw new Error('Tool providers cannot hold authority')
    }
    if (this.providers.has(provider.providerId)) {
      throw new Error(`Provider "${provider.providerId}" is already registered`)
    }
    this.providers.set(provider.providerId, provider)
  }

  get(providerId: string): ToolProviderDescriptor | undefined {
    return this.providers.get(providerId)
  }

  list(): readonly ToolProviderDescriptor[] {
    return Array.from(this.providers.values())
  }

  /** Env the broker must force for a provider's tools (telemetry opt-out). */
  forcedEnvFor(providerId: string): Readonly<Record<string, string>> {
    return this.providers.get(providerId)?.telemetry.forcedOptOutEnv ?? {}
  }
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/
const COMMIT_PIN = /@[0-9a-f]{40}(?:#|$)/i

/**
 * Subset of the CLI-Hub registry.json entry shape that we read. Everything
 * else upstream adds is ignored; unknown fields never reach a descriptor.
 */
const cliHubEntrySchema = z
  .object({
    name: z.string().regex(NAME_PATTERN),
    version: z.string().min(1),
    display_name: z.string().optional(),
    description: z.string().optional(),
    homepage: z.string().nullish(),
    source_url: z.string().nullish(),
    install_cmd: z.string().min(1),
    entry_point: z.string().min(1).optional(),
    skill_md: z.string().nullish(),
    category: z.string().optional(),
  })
  .passthrough()

export type CliHubRegistryEntry = z.input<typeof cliHubEntrySchema>

const UNKNOWN_EFFECTS_FLOOR: readonly ToolSideEffect[] = [
  'FILESYSTEM_READ',
  'FILESYSTEM_WRITE',
  'SUBPROCESS_EXECUTION',
]

/** True when the install command does not resolve to an immutable artefact. */
export function isMutableInstall(installCmd: string): boolean {
  if (/git\+/.test(installCmd)) return !COMMIT_PIN.test(installCmd)
  return !/==\s*\d/.test(installCmd)
}

/**
 * Normalises a CLI-Hub registry entry into a DISCOVERED descriptor.
 *
 * Capabilities are NOT inferred from the description or category: registry
 * text is untrusted. Side effects start at a conservative floor because the
 * registry does not declare them.
 */
export function normalizeCliHubEntry(entry: unknown, discoveredAt: string): ToolDescriptor {
  const parsed = cliHubEntrySchema.parse(entry)
  const mutable = isMutableInstall(parsed.install_cmd)
  const notes: string[] = []
  if (mutable) notes.push('install command resolves to a mutable upstream ref; no digest pin')
  if (!parsed.source_url) notes.push('registry entry has no source_url')

  const descriptor: ToolDescriptor = {
    identity: {
      name: `${CLI_HUB_PROVIDER.providerId}/${parsed.name}`,
      version: parsed.version,
      providerId: CLI_HUB_PROVIDER.providerId,
      sourceRepository: parsed.source_url ?? undefined,
      packageCoordinates: parsed.install_cmd,
    },
    sourceClass: 'REGISTRY_LISTED',
    displayName: parsed.display_name,
    claimedCapabilities: [],
    commands: parsed.entry_point
      ? [{ name: parsed.entry_point, sideEffects: UNKNOWN_EFFECTS_FLOOR, supportsJsonOutput: true }]
      : [],
    declaredSideEffects: UNKNOWN_EFFECTS_FLOOR,
    provenance: {
      discoveredVia: CLI_HUB_PROVIDER.providerId,
      discoveredAt,
      mutableUpstream: mutable,
      notes,
    },
  }
  return descriptor
}
