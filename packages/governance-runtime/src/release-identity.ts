/**
 * @nzila/governance-runtime — Release identity
 *
 * Reads release identity from explicit sources only. Heuristic inference
 * (e.g., "guess from package.json") is structurally rejected.
 *
 * @module @nzila/governance-runtime/release-identity
 */
import { z } from 'zod'

import type { ReleaseIdentity } from './types'

export const releaseIdentitySchema: z.ZodType<ReleaseIdentity> = z
  .object({
    releaseId: z.string().min(1),
    commitSha: z
      .string()
      .min(7)
      .regex(/^[0-9a-f]+$/i, { message: 'commitSha must be hex' }),
    manifestHash: z.string().min(8),
    builtAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()

export interface ReleaseIdentitySource {
  readonly releaseId?: string
  readonly commitSha?: string
  readonly manifestHash?: string
  readonly builtAt?: string
}

export class UnknownReleaseStateError extends Error {
  constructor(missing: readonly string[]) {
    super(
      `unknown_release_state: required release identity field(s) missing: ${missing.join(', ')}`,
    )
    this.name = 'UnknownReleaseStateError'
  }
}

/**
 * Read release identity from environment variables. Throws
 * `UnknownReleaseStateError` if any required field is missing or if
 * validation fails.
 *
 * Default env keys:
 *  - NZILA_RELEASE_ID
 *  - NZILA_COMMIT_SHA
 *  - NZILA_MANIFEST_HASH
 *  - NZILA_BUILT_AT
 */
export function readReleaseIdentityFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ReleaseIdentity {
  const source: ReleaseIdentitySource = {
    releaseId: env.NZILA_RELEASE_ID,
    commitSha: env.NZILA_COMMIT_SHA,
    manifestHash: env.NZILA_MANIFEST_HASH,
    builtAt: env.NZILA_BUILT_AT,
  }
  return readReleaseIdentity(source)
}

export function readReleaseIdentity(source: ReleaseIdentitySource): ReleaseIdentity {
  const missing: string[] = []
  if (!source.releaseId) missing.push('releaseId')
  if (!source.commitSha) missing.push('commitSha')
  if (!source.manifestHash) missing.push('manifestHash')
  if (!source.builtAt) missing.push('builtAt')
  if (missing.length > 0) throw new UnknownReleaseStateError(missing)
  return releaseIdentitySchema.parse(source)
}
