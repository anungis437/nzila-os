/**
 * What the deployment supplies (UE-CONV-H-024): the variable names the deployment files set for the application, read from the files that set them.
 *
 *   - `infrastructure/bicep/ue-v2/modules/apps.bicep`: the `{ name: 'X', value | secretRef }` entries of the application container (the scheduled-job
 *     containers beneath it are a different process and are not read), and the Key Vault secret names it references.
 *   - `.github/workflows/deploy-union-eyes.yml`: the `"NAME=value"` strings the deploy step passes to `az containerapp update --set-env-vars`, the
 *     `ensure_*kv_backed_secret "<secret>" "NAME"` wiring of Key Vault secrets to variables, and the `--build-arg NAME=` of the image build.
 *   - `Dockerfile`: the `ARG` and `ENV` lines of the build and of the Union Eyes image.
 *
 * These are not parsed as a language: they are the three conventions the files are written in, and a name that appears in one of those positions is supplied.
 */

export interface BicepSurface {
  /** Environment variable name -> the Key Vault secret it is read from (empty for a plain value). */
  env: Map<string, { secret: string | null }>
  /** Key Vault secrets the application container declares. */
  secrets: Set<string>
}

const NAME = '[A-Z][A-Z0-9_]{1,}'

export function parseBicep(text: string): BicepSurface {
  // The scheduled-job containers come after the application and have their own environment.
  const jobs = text.indexOf('resource cronJobs')
  const application = jobs >= 0 ? text.slice(0, jobs) : text
  const env = new Map<string, { secret: string | null }>()
  for (const match of application.matchAll(new RegExp(`\\{\\s*name:\\s*'(${NAME})'\\s*,\\s*(value|secretRef):\\s*([^}\\n]+?)\\s*\\}`, 'g'))) {
    const reference = match[2] === 'secretRef' ? /'([^']+)'/.exec(match[3])?.[1] ?? null : null
    env.set(match[1], { secret: reference })
  }
  const secrets = new Set<string>()
  for (const list of application.matchAll(/var\s+(?:secretNames|stripeSecretNames)\s*=\s*(?:[^\[\n]*\?\s*)?\[([^\]]*)\]/g)) for (const item of list[1].matchAll(/'([^']+)'/g)) secrets.add(item[1])
  return { env, secrets }
}

/** The names the deploy workflow supplies to the application container or the image build. */
export function parseWorkflow(text: string): Set<string> {
  const names = new Set<string>()
  for (const match of text.matchAll(new RegExp(`["']\\$?\\{?(${NAME})=`, 'g'))) names.add(match[1])
  for (const match of text.matchAll(new RegExp(`ensure_(?:required_)?kv_backed_secret\\s+"[^"]+"\\s+"(${NAME})"`, 'g'))) names.add(match[1])
  for (const match of text.matchAll(new RegExp(`--build-arg\\s+(${NAME})=`, 'g'))) names.add(match[1])
  return names
}

export function parseDockerfile(text: string): Set<string> {
  const names = new Set<string>()
  for (const match of text.matchAll(new RegExp(`^\\s*(?:ENV|ARG)\\s+(${NAME})\\b`, 'gm'))) names.add(match[1])
  return names
}

/** Names the container platform or the framework injects: a registry entry may claim `platform` only for these. */
export const PLATFORM_INJECTED: ReadonlySet<string> = new Set([
  'NEXT_RUNTIME',
  'NEXT_PHASE',
  '__NEXT_BUILDING',
  'NEXT_TELEMETRY_DISABLED',
  'HOSTNAME',
  'CI',
  'npm_package_version',
  'NODE_OPTIONS',
  'VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'BUILD_ID',
  'ANALYZE',
  'OPENSSL_CONF',
  'OPENSSL_MODULES',
])
