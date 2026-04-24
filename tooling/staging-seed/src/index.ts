/**
 * Public API of @nzila/staging-seed.
 *
 * Per-app seeders import {@link registerSeeder} and the shared fakers from
 * here.
 */

export {
  SEED_PROFILES,
  SEED_APPS,
} from './core/types'
export type {
  ProfileTargetMap,
  ProfileTargets,
  SeedApp,
  SeedAppReport,
  SeedContext,
  SeedLogger,
  SeedProfile,
  SeedReporter,
  SeedRng,
  SeedRunReport,
  SeedStepRecord,
  SeedTime,
  SeederModule,
} from './core/types'

export {
  PROFILE_TARGETS,
  DEFAULT_PROFILE,
  getProfileTargets,
  isSeedProfile,
} from './core/profiles'

export { createRng, DEFAULT_SEED } from './core/rng'
export { createTime } from './core/time'
export { createReporter } from './core/reporter'
export { registerSeeder, getSeeder, listSeeders, __resetRegistryForTests } from './core/registry'
export { runSeed } from './core/runner'
export type { RunOptions } from './core/runner'

export * as shared from './shared'
