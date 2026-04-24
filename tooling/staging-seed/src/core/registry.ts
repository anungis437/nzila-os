import type { SeedApp, SeederModule } from './types'

/**
 * In-process seeder registry.
 *
 * Per-app seeder modules call {@link registerSeeder} at import time.
 * The CLI imports those modules to populate the registry, then iterates
 * via {@link listSeeders}.
 */
const seeders = new Map<SeedApp, SeederModule>()

export function registerSeeder(module: SeederModule): void {
  if (seeders.has(module.app)) {
    throw new Error(
      `registerSeeder: duplicate registration for app="${module.app}". ` +
        `Each app may register exactly one seeder module.`,
    )
  }
  seeders.set(module.app, module)
}

export function getSeeder(app: SeedApp): SeederModule | undefined {
  return seeders.get(app)
}

export function listSeeders(): readonly SeederModule[] {
  return Array.from(seeders.values()).sort((a, b) => a.app.localeCompare(b.app))
}

/** Test-only — clear the registry between cases. */
export function __resetRegistryForTests(): void {
  seeders.clear()
}
