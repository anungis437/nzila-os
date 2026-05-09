/**
 * Production Guard
 *
 * Hard guard for destructive scripts (seeds, resets, fixture loaders, E2E setup)
 * to prevent accidental execution against the production environment.
 *
 * Source of truth (in priority order):
 *   1. UE_ENVIRONMENT  — canonical Phase A env identity (staging|demo|pilot|production)
 *   2. NEXT_PUBLIC_APP_ENV — public mirror, used by some legacy callers
 *   3. NODE_ENV — last-resort fallback (should never be the only signal)
 *
 * Usage at the top of any seed/reset script:
 *
 *     import { assertNotProduction } from '@/lib/runtime/production-guard'
 *     assertNotProduction('seed-clc-demo-environment')
 *
 * Override (CI, recovery, intentional prod re-seed):
 *     ALLOW_PRODUCTION_SEED=1 npx tsx scripts/seed-...
 *
 * The override requires an explicit operator action; it is never set by
 * default in any deployed container or CI pipeline.
 */

const PRODUCTION_TOKENS = new Set(['production', 'prod'])

export type ResolvedEnvironment = {
  environment: string
  source: 'UE_ENVIRONMENT' | 'NEXT_PUBLIC_APP_ENV' | 'NODE_ENV' | 'unset'
}

export function resolveEnvironment(): ResolvedEnvironment {
  const ue = (process.env.UE_ENVIRONMENT ?? '').trim().toLowerCase()
  if (ue) return { environment: ue, source: 'UE_ENVIRONMENT' }

  const pub = (process.env.NEXT_PUBLIC_APP_ENV ?? '').trim().toLowerCase()
  if (pub) return { environment: pub, source: 'NEXT_PUBLIC_APP_ENV' }

  // NODE_ENV is malformed in some live containers (e.g.
  // "production NEXT_PUBLIC_APP_ENV=staging"); split on whitespace.
  const node = (process.env.NODE_ENV ?? '').trim().toLowerCase().split(/\s+/)[0]
  if (node) return { environment: node, source: 'NODE_ENV' }

  return { environment: '', source: 'unset' }
}

export function isProduction(): boolean {
  const { environment } = resolveEnvironment()
  return PRODUCTION_TOKENS.has(environment)
}

export function assertNotProduction(scriptName: string): void {
  const resolved = resolveEnvironment()

  if (!PRODUCTION_TOKENS.has(resolved.environment)) {
    return
  }

  if (process.env.ALLOW_PRODUCTION_SEED === '1') {
    process.stderr.write(
      `[production-guard] ALLOW_PRODUCTION_SEED=1 override active. Continuing ${scriptName} against production. This action is auditable.\n`,
    )
    return
  }

  const message =
    `[production-guard] Refusing to run "${scriptName}" against environment="${resolved.environment}" ` +
    `(resolved from ${resolved.source}). ` +
    `Demo, test and reset scripts are blocked in production. ` +
    `If this is an intentional one-time recovery, re-run with ALLOW_PRODUCTION_SEED=1.`

  process.stderr.write(message + '\n')
  throw new Error(message)
}
