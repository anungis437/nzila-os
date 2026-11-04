/**
 * Secret strength (UE-CONV-H-024): what counts as a configured secret.
 *
 * A secret that is missing, empty, a placeholder (`change-me`, the value in an example file, the build-time placeholder the Dockerfile uses), repeated
 * characters, or shorter than the key it is meant to be, is not a secret: anyone who has seen the repository has it. Code that verifies or signs with a secret
 * asks `usableSecret`, and the readiness endpoints ask `secretProblem` of every secret the registry says a deployment requires, so the two cannot disagree.
 *
 * Outside a deployment (a developer's machine, a test run) a short secret is accepted, because the suites use short ones; a placeholder never is.
 */
import { isDeployedRuntime, type EnvironmentSource } from '@/lib/runtime/production-guard'

export type SecretProblem = 'missing' | 'placeholder' | 'repetitive' | 'too_short'

export const DEFAULT_MIN_SECRET_LENGTH = 32

/** Never a secret, anywhere: the placeholders a template or an example file ships with. */
const PLACEHOLDER_ALWAYS = /^(?:change[-_ ]?me|replace[-_ ]?me|placeholder|todo|tbd|fixme|example|undefined|null|your[-_ ].+|<[^>]*>|x{4,}|\*{4,})$/i
/** Words the suites use as short test secrets: refused in a deployment, where nothing is a test. */
const PLACEHOLDER_IN_DEPLOYMENT = /^(?:sample|dummy|default|secret|password|passw0rd|test|testing|none)$/i
const PLACEHOLDER_INSIDE = /(change[-_ ]?me|replace[-_ ]?me|placeholder|your[-_ ]secret|django-insecure|build[-_]placeholder)/i

/** Why a value is not a secret, or null when it could be one. `deployed` adds the words and the length a test secret gets away with. */
export function secretProblem(value: string | undefined | null, minLength: number = DEFAULT_MIN_SECRET_LENGTH, deployed = true): SecretProblem | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return 'missing'
  if (PLACEHOLDER_ALWAYS.test(trimmed) || PLACEHOLDER_INSIDE.test(trimmed) || (deployed && PLACEHOLDER_IN_DEPLOYMENT.test(trimmed))) return 'placeholder'
  if (deployed && trimmed.length >= 8 && (new Set(trimmed).size <= 2 || /^(.{1,8})\1+$/.test(trimmed))) return 'repetitive'
  if (deployed && trimmed.length < minLength) return 'too_short'
  return null
}

/**
 * The secret to use, or null when this process must treat it as not configured. In a deployment the full rules apply; elsewhere a short secret is
 * accepted (the suites use short ones), a placeholder or an empty one is not.
 */
export function usableSecret(value: string | undefined | null, options: { minLength?: number; env?: EnvironmentSource } = {}): string | null {
  const deployed = isDeployedRuntime(options.env ?? process.env)
  return secretProblem(value, options.minLength ?? DEFAULT_MIN_SECRET_LENGTH, deployed) === null ? (value ?? '').trim() : null
}
