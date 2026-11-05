/**
 * The environment registry (UE-CONV-H-024): every environment variable Union Eyes reads, and what it means to deploy without it.
 *
 * Configuration trust is a closed list. A variable the code reads and this file does not name is a deployment that can misconfigure silently; a variable this
 * file names and no code reads is configuration an operator will set for nothing. `scripts/runtime/env-census.ts` (`pnpm census:env`) holds both to zero, reads
 * the code as syntax (not text), checks the claims here against the deployment (`infrastructure/**`, `.github/workflows/deploy-union-eyes.yml`, the Dockerfile),
 * and regenerates `.env.example` from this file so the example cannot drift from it. `lib/config/env-readiness.ts` reads the same entries to say, at
 * `/api/ready` and `/api/health`, whether this deployment is configured: the variables a deployed environment requires are present and not placeholders, nothing
 * that must never be set in production is set, and every optional integration is reported as configured, not configured or half-configured.
 *
 * `required` is what the environment must have:
 *   production — every deployed environment (staging, pilot, production: all run NODE_ENV=production). Absent, the capability fails closed.
 *   staging    — staging and pilot only, and it must NOT be set in production (a staging proof secret in production is a misconfiguration).
 *   optional   — a feature, an integration or a tuning knob. Absent, `whenMissing` says exactly what happens.
 *   dev-only   — local development only; production code must refuse it (`productionProof` names the test that shows it does).
 *   test-only  — read by test or build tooling the application ships with; never meaningful in a deployed environment.
 *
 * `whenMissing` is a promise the code keeps, and is audited against it: `fail-closed` (the capability refuses, the request is denied, or the process
 * will not start), `degraded:<exact behaviour>` (it keeps running with that named behaviour, and readiness says so), `default:<value and why it is safe>`.
 * A secret never has a default.
 */

export type EnvKind = 'secret' | 'config' | 'flag'
export type EnvRequired = 'production' | 'staging' | 'optional' | 'dev-only' | 'test-only'
export type EnvWhenMissing = 'fail-closed' | `degraded:${string}` | `default:${string}`
export type EnvRuntime = 'next' | 'django'

/** How the deployment supplies a variable, or why it need not. Everything but `operator` and `not-needed` is verified against the deployment files by the census. */
export type Provision =
  | { via: 'bicep'; secret?: string }
  | { via: 'workflow' }
  | { via: 'dockerfile' }
  | { via: 'platform'; by: string }
  | { via: 'operator'; note: string }
  | { via: 'not-needed'; because: string }

/** The sections of `.env.example`, in the order they appear. */
export const ENV_GROUPS = {
  identity: 'Runtime identity and deployment',
  urls: 'Public URLs and site topology',
  database: 'Database',
  auth: 'Authentication (Entra / NextAuth, sessions, MFA)',
  authorization: 'Authorization and administrator bootstrap',
  keys: 'Encryption, signing and integrity keys',
  cron: 'Scheduled jobs and workers',
  email: 'Email',
  messaging: 'SMS and push notifications',
  calendar: 'Calendar sync',
  storage: 'Document storage and malware scanning',
  payments: 'Payments and billing',
  ai: 'AI, machine learning and voice',
  crm: 'CRM and external data sources',
  observability: 'Observability, rate limiting and caching',
  intake: 'Public intake and bot challenge',
  compliance: 'Compliance, privacy and consent text',
  integrations: 'Optional third-party integrations',
  financial: 'Financial service',
  django: 'Django backend',
  dev: 'Development, testing and escape hatches (never in a deployed environment)',
  build: 'Build and platform-injected',
} as const

export type EnvGroup = keyof typeof ENV_GROUPS

/** What a variable is for. Where a capability-registry entry exists, the area is named after it. */
export type EnvCapability =
  | 'runtime-identity'
  | 'site-topology'
  | 'database'
  | 'authentication'
  | 'authorization'
  | 'encryption'
  | 'evidence-integrity'
  | 'cron-jobs'
  | 'email-delivery'
  | 'communications-tracking'
  | 'sms-push'
  | 'calendar-sync'
  | 'document-storage'
  | 'malware-scanning'
  | 'payments'
  | 'ai-assistant'
  | 'ml-services'
  | 'voice'
  | 'crm'
  | 'external-data'
  | 'address-validation'
  | 'rate-limiting'
  | 'observability'
  | 'public-intake'
  | 'voting'
  | 'break-glass'
  | 'deadline-engine'
  | 'compliance'
  | 'tax-reporting'
  | 'integrations'
  | 'feature-flags'
  | 'financial-service'
  | 'staging-proof'
  | 'orchestration'
  | 'django-backend'
  | 'development'
  | 'build'

export interface EnvEntry {
  name: string
  kind: EnvKind
  required: EnvRequired
  capability: EnvCapability
  whenMissing: EnvWhenMissing
  provisionedBy: Provision | readonly Provision[]
  group: EnvGroup
  /** One line, written for the operator who reads `.env.example`. */
  description: string
  /** The value `.env.example` carries. Empty for a secret: an example is never a usable credential. */
  example?: string
  /** For a secret: the shortest value readiness accepts as not weak (default 16). */
  minLength?: number
  /** The optional integration(s) this variable belongs to: configured when every non-optional member is set, not configured when none is, misconfigured otherwise. */
  integration?: string | readonly string[]
  /** A member that an integration works without (a region, a base URL with a default). */
  integrationOptional?: true
  runtime?: EnvRuntime
  /** Read by a process the census does not read (the Django backend, NextAuth, the platform): a read by a validator or a probe only is then expected. */
  externalConsumer?: string
  /**
   * A variable that configures the check itself (which checks gate readiness, whether a missing contract refuses the boot) is read in a file the census
   * otherwise treats as validate-only. Names that file: the census holds that the file really reads the variable, and counts the read as use.
   */
  configuresCheckIn?: string
  /** For `dev-only` and `staging`: the test that proves production code refuses it. The census checks the file exists and names the variable. */
  productionProof?: string
}

/** A key the census cannot resolve to one name (it is built from data), with where it is read and what it produces. */
export interface EnvPattern {
  file: string
  /** The key expression as written. */
  key: string
  produces: string
  capability: EnvCapability
  whenMissing: EnvWhenMissing
  description: string
}

type EntryInput = Omit<EnvEntry, 'group' | 'capability'> & Partial<Pick<EnvEntry, 'capability'>>

const section = (group: EnvGroup, capability: EnvCapability, entries: readonly EntryInput[]): EnvEntry[] => entries.map((entry) => ({ capability, ...entry, group }))

export const bicep = (secret?: string): Provision => ({ via: 'bicep', ...(secret ? { secret } : {}) })
export const workflow: Provision = { via: 'workflow' }
export const dockerfile: Provision = { via: 'dockerfile' }
export const platform = (by: string): Provision => ({ via: 'platform', by })
export const operator = (note: string): Provision => ({ via: 'operator', note })
export const notNeeded = (because: string): Provision => ({ via: 'not-needed', because })

const TUNING = notNeeded('a tuning knob with a safe default')
const OPTIONAL_INTEGRATION = notNeeded('an optional integration: set it only in an environment that uses it')

/** A tuning knob: optional, with a default that is safe to run on. */
const knob = (name: string, fallback: string, description: string, example?: string): EntryInput => ({
  name,
  kind: 'config',
  required: 'optional',
  whenMissing: `default:${fallback}`,
  provisionedBy: TUNING,
  description,
  ...(example === undefined ? {} : { example }),
})

/** A member of an optional integration: absent, the integration is "not configured" and its feature answers as unavailable. */
const member = (integration: string | readonly string[], name: string, kind: EnvKind, behaviour: string, description: string, extra: Partial<EntryInput> = {}): EntryInput => ({
  name,
  kind,
  required: 'optional',
  whenMissing: `degraded:${behaviour}`,
  provisionedBy: OPTIONAL_INTEGRATION,
  description,
  integration,
  ...extra,
})

const ENTRIES: EnvEntry[] = [
  ...section('identity', 'runtime-identity', [
    { name: 'NODE_ENV', kind: 'config', required: 'production', whenMissing: 'degraded:Next.js start forces production, but nothing then says which deployment this is: UE_ENVIRONMENT is the identity the guards read, and readiness reports NODE_ENV missing', provisionedBy: [dockerfile, bicep(), workflow], description: 'Next.js build/runtime mode; every deployed container runs production.', example: 'development' },
    { name: 'UE_ENVIRONMENT', kind: 'config', required: 'production', whenMissing: 'degraded:identity falls back to NEXT_PUBLIC_APP_ENV, then NODE_ENV (production), then local (lib/runtime/environment.ts); readiness reports it missing', provisionedBy: [bicep(), workflow, dockerfile], description: 'Canonical deployment identity: local, dev, staging, pilot or production. The escape-hatch guards and the site topology read it.', example: 'development' },
    { name: 'NEXT_PUBLIC_APP_ENV', kind: 'config', required: 'production', whenMissing: 'degraded:the client and the staging-proof build identity fall back to UE_ENVIRONMENT; readiness reports it missing', provisionedBy: [bicep(), workflow, dockerfile], description: 'Public (client-visible, build-time) mirror of UE_ENVIRONMENT.', example: 'development' },
    { name: 'UE_DEPLOYMENT_TYPE', kind: 'config', required: 'optional', whenMissing: 'default:derived from UE_ENVIRONMENT (production gives prod, pilot gives pilot, anything else staging): lib/runtime/environment.ts', provisionedBy: [bicep(), workflow, dockerfile], description: 'Deployment type: pilot, staging or prod.' },
    { name: 'UE_FEATURE_PROFILE', kind: 'config', required: 'optional', whenMissing: 'default:executive in production and pilot, internal elsewhere (lib/runtime/environment.ts); the demo-deployment guard refuses a demo value in a deployment', provisionedBy: [bicep(), workflow, dockerfile], description: 'Server runtime profile: internal or executive. A demo profile is refused at boot.' },
    { name: 'NZILA_MODE', kind: 'config', required: 'optional', whenMissing: 'degraded:pilot and demo mutation routes stay fail-closed (lib/config/pilot-demo-runtime.ts)', provisionedBy: workflow, description: 'Platform mode: pilot, staging or production. Only pilot opens the pilot routes.' },
    { name: 'NZILA_ENV', kind: 'config', required: 'optional', whenMissing: 'default:unset; the idempotency store treats the process as non-production', provisionedBy: notNeeded('read by @nzila/os-core idempotency only to pick a stricter mode; absence is the non-strict path'), description: 'Platform environment label read by the idempotency store of @nzila/os-core.' },
    { name: 'NZILA_DEPLOYMENT_TYPE', kind: 'config', required: 'optional', whenMissing: 'default:unset; deployment type comes from UE_DEPLOYMENT_TYPE', provisionedBy: notNeeded('legacy alias of UE_DEPLOYMENT_TYPE, read by the health route and the auth package'), description: 'Legacy alias of UE_DEPLOYMENT_TYPE.' },
    { name: 'NZILA_ENVIRONMENT_CLASS', kind: 'config', required: 'optional', whenMissing: 'default:unknown (recorded on governance telemetry as environmentClass=unknown)', provisionedBy: notNeeded('a label on governance telemetry only'), description: 'Environment class stamped on governance telemetry.' },
    { name: 'NZILA_RELEASE_ID', kind: 'config', required: 'optional', whenMissing: 'default:unknown (recorded on governance telemetry as releaseId=unknown)', provisionedBy: notNeeded('a label on governance telemetry only; RELEASE_ID carries the release elsewhere'), description: 'Release id stamped on governance telemetry.' },
    { name: 'NZILA_POLICY_VERSION', kind: 'config', required: 'optional', whenMissing: 'default:v1, the policy engine version this build ships', provisionedBy: notNeeded('the policy engine version has a built-in default'), description: 'Policy engine version label.', example: 'v1' },
    { name: 'DEPLOYMENT_ENVIRONMENT', kind: 'config', required: 'optional', whenMissing: 'default:unset; the identity comes from UE_ENVIRONMENT', provisionedBy: notNeeded('an additional identity signal the auth package reads when present'), description: 'Additional deployment-identity signal read by the auth package and the NAR storage selector.' },
    { name: 'TARGET_ENVIRONMENT', kind: 'config', required: 'optional', whenMissing: 'default:production, the strictest target (the demo-deployment guard and the pilot status probe assume it when unset)', provisionedBy: workflow, description: 'Target environment the demo-deployment guard and the staging proof judge against.' },
    { name: 'NEXT_PUBLIC_UE_DEMO_PROFILE', kind: 'config', required: 'optional', whenMissing: 'default:unset; the operational package serves no demo profile, and the boot guard refuses a demo value', provisionedBy: [workflow, dockerfile], description: 'Must stay unset: a demo profile is refused at boot (lib/reality/demo-deployment-guard.ts).' },
    { name: 'UE_DEMO_PROFILE', kind: 'config', required: 'optional', whenMissing: 'default:unset; the operational package serves no demo profile', provisionedBy: [workflow, dockerfile], externalConsumer: 'nothing in this package: the deploy workflow sets it for demo deployments and lib/config/env-validation.ts types it never', description: 'Must stay unset in this package; only the separate demo package reads a demo profile.' },
    { name: 'UE_DEMO_ORG_ID', kind: 'config', required: 'optional', whenMissing: 'default:unset; the operational package serves no demo profile', provisionedBy: [workflow, dockerfile], externalConsumer: 'nothing in this package: the deploy workflow sets it for demo deployments and lib/config/env-validation.ts types it never', description: 'Must stay unset in this package; the demo organization belongs to the demo package.' },
    { name: 'NEXT_PUBLIC_UE_DEMO_ORG_SLUG', kind: 'config', required: 'optional', whenMissing: 'default:unset; the operational package serves no demo profile', provisionedBy: [workflow, dockerfile], externalConsumer: 'nothing in this package: the deploy workflow sets it for demo deployments and lib/config/env-validation.ts types it never', description: 'Must stay unset in this package; the demo organization slug belongs to the demo package.' },
    { name: 'NEXT_PUBLIC_UE_FEATURE_PROFILE', kind: 'config', required: 'optional', whenMissing: 'default:unset; the client reads no profile', provisionedBy: [workflow, dockerfile], externalConsumer: 'nothing: the deploy workflow and the Dockerfile set it and no code reads it', description: 'Public mirror of UE_FEATURE_PROFILE. Set by the deployment; no code reads it.' },
    { name: 'UE_CANONICAL_BOOTSTRAP_V2', kind: 'flag', required: 'optional', whenMissing: 'default:unset, the legacy bootstrap: canonical V2 context is off (lib/auth/canonical-bootstrap.ts); the V2 stack sets 1', provisionedBy: bicep(), description: 'Switches the canonical V2 authority bootstrap on (1) or the legacy path (0 or unset).' },
    { name: 'RUNTIME_FAIL_CLOSED', kind: 'flag', required: 'optional', whenMissing: 'default:false, advisory: missing runtime contracts are logged, not fatal (lib/runtime/fail-closed.ts)', provisionedBy: notNeeded('opt-in strictness; a deployment that sets it refuses to boot on a missing contract'), configuresCheckIn: 'lib/runtime/fail-closed.ts', description: 'true makes a missing runtime contract refuse the boot instead of logging it.' },
    { name: 'SECRET_TOPOLOGY', kind: 'config', required: 'optional', whenMissing: 'degraded:the lineage banner reports the secret topology as undeclared (lib/runtime/fail-closed.ts)', provisionedBy: notNeeded('a lineage label for the runtime contract banner'), externalConsumer: 'the runtime contract banner only', description: 'Lineage label: where the secrets come from.' },
    { name: 'SECRET_AUTHORITY', kind: 'config', required: 'optional', whenMissing: 'degraded:the lineage banner reports the secret authority as undeclared (lib/runtime/fail-closed.ts)', provisionedBy: notNeeded('a lineage label for the runtime contract banner'), externalConsumer: 'the runtime contract banner only', description: 'Lineage label: who owns the secrets.' },
    { name: 'ENVIRONMENT_ISOLATION', kind: 'config', required: 'optional', whenMissing: 'degraded:the lineage banner reports environment isolation as undeclared (lib/runtime/fail-closed.ts)', provisionedBy: notNeeded('a lineage label for the runtime contract banner'), externalConsumer: 'the runtime contract banner only', description: 'Lineage label: how this environment is isolated.' },
  ]),
  ...section('urls', 'site-topology', [
    { name: 'NEXT_PUBLIC_APP_URL', kind: 'config', required: 'production', whenMissing: 'degraded:absolute links in emails, redirects and webhooks are built on an empty base, and lib/config/env-validation.ts reports it invalid; readiness reports it missing', provisionedBy: [bicep(), workflow, dockerfile], description: 'Public URL of the application (build-time, client-visible). Production: https://app.unioneyes.app.', example: 'http://localhost:3002' },
    { name: 'NEXT_PUBLIC_SITE_URL', kind: 'config', required: 'optional', whenMissing: 'default:https://unioneyes.app for canonical and Open Graph URLs (marketing pages)', provisionedBy: [bicep(), workflow, dockerfile], description: 'Public URL of the marketing site, used for canonical URLs, metadata and the sitemap. Production: https://unioneyes.app.', example: 'http://localhost:3002' },
    { name: 'NEXT_PUBLIC_APP_URL_PRODUCTION', kind: 'config', required: 'optional', whenMissing: 'default:NEXT_PUBLIC_APP_URL (lib/site-topology.ts)', provisionedBy: notNeeded('an override of the production app URL; the topology falls back to NEXT_PUBLIC_APP_URL'), description: 'Production app URL, when it differs from NEXT_PUBLIC_APP_URL.' },
    { name: 'NEXT_PUBLIC_APP_URL_STAGING', kind: 'config', required: 'optional', whenMissing: 'default:https://staging-app.unioneyes.app, the staging app URL (lib/site-topology.ts)', provisionedBy: [workflow, dockerfile], description: 'Staging app URL.', example: 'https://staging-app.unioneyes.app' },
    { name: 'NEXT_PUBLIC_SITE_URL_PRODUCTION', kind: 'config', required: 'optional', whenMissing: 'default:NEXT_PUBLIC_SITE_URL (lib/site-topology.ts)', provisionedBy: notNeeded('an override of the production site URL; the topology falls back to NEXT_PUBLIC_SITE_URL'), description: 'Production marketing URL, when it differs from NEXT_PUBLIC_SITE_URL.' },
    { name: 'NEXT_PUBLIC_SITE_URL_STAGING', kind: 'config', required: 'optional', whenMissing: 'default:https://staging.unioneyes.app, the staging marketing URL (lib/site-topology.ts)', provisionedBy: [workflow, dockerfile], description: 'Staging marketing URL.', example: 'https://staging.unioneyes.app' },
    { name: 'UE_APP_URL', kind: 'config', required: 'optional', whenMissing: 'default:the staging or production app URL of the resolved identity (lib/site-topology.ts)', provisionedBy: [workflow, dockerfile], description: 'Canonical app URL for this environment; set per environment so staging does not inherit production metadata.', example: 'http://localhost:3002' },
    { name: 'UE_MARKETING_URL', kind: 'config', required: 'optional', whenMissing: 'default:the staging or production marketing URL of the resolved identity (lib/site-topology.ts)', provisionedBy: [workflow, dockerfile], description: 'Canonical marketing URL for this environment.', example: 'http://localhost:3002' },
    { name: 'APP_BASE_URL', kind: 'config', required: 'optional', whenMissing: 'default:NEXT_PUBLIC_APP_URL, then the production app URL, for the links in authentication emails (lib/auth-emails.ts)', provisionedBy: notNeeded('falls back to NEXT_PUBLIC_APP_URL, which the deployment sets'), description: 'Base URL of the links in authentication emails, when it differs from NEXT_PUBLIC_APP_URL.' },
    { name: 'NEXT_PUBLIC_NZILA_URL', kind: 'config', required: 'optional', whenMissing: 'default:https://nzilaventures.com, the footer link target', provisionedBy: notNeeded('the footer link has a built-in target'), description: 'Parent-company URL in the marketing footer.', example: 'https://nzilaventures.com' },
    { name: 'NEXT_PUBLIC_UNION_NAME', kind: 'config', required: 'optional', whenMissing: 'default:"Union" in training notification emails', provisionedBy: notNeeded('the email wording has a neutral default'), description: 'Union name used in training notification emails.' },
    { name: 'CORS_ALLOWED_ORIGINS', kind: 'config', required: 'optional', whenMissing: 'default:no cross-origin caller is allowed; same-origin only (proxy.ts)', provisionedBy: workflow, description: 'Comma-separated origins allowed to call the API cross-origin.' },
    { name: 'CORS_ORIGIN', kind: 'config', required: 'optional', whenMissing: 'default:no cross-origin caller is allowed; same-origin only (proxy.ts)', provisionedBy: notNeeded('legacy single-origin spelling of CORS_ALLOWED_ORIGINS'), description: 'Legacy single-origin spelling of CORS_ALLOWED_ORIGINS.' },
    { name: 'AUTH_URL', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: [bicep(), workflow], externalConsumer: 'Auth.js (next-auth) reads it for callback URLs', description: 'Canonical URL the authentication library builds callbacks on; the app URL.', example: 'http://localhost:3002' },
    { name: 'AUTH_TRUST_HOST', kind: 'flag', required: 'production', whenMissing: 'fail-closed', provisionedBy: [bicep(), workflow], externalConsumer: 'Auth.js (next-auth) reads it to trust the forwarded host behind the ingress', description: 'true behind the Azure ingress so the authentication library trusts the forwarded host.', example: 'true' },
  ]),
  ...section('database', 'database', [
    { name: 'DATABASE_URL', kind: 'secret', required: 'production', minLength: 20, whenMissing: 'fail-closed', provisionedBy: [bicep('database-url'), workflow], description: 'Tenant-scoped PostgreSQL connection string (the non-bypass union_eyes_runtime role).' },
    { name: 'SYSTEM_DATABASE_URL', kind: 'secret', required: 'production', minLength: 20, whenMissing: 'fail-closed', provisionedBy: [bicep('system-database-url'), workflow], description: 'PostgreSQL connection string of the union_eyes_system role used by system and admin paths.' },
    { name: 'AUTH_DATABASE_URL', kind: 'secret', required: 'production', minLength: 20, whenMissing: 'fail-closed', provisionedBy: bicep('auth-database-url'), description: 'PostgreSQL connection string of the dedicated authentication gateway role (ordinary auth execution).' },
    { name: 'AUTH_SYSTEM_DATABASE_URL', kind: 'secret', required: 'production', minLength: 20, whenMissing: 'fail-closed', provisionedBy: bicep('auth-database-url'), description: 'PostgreSQL connection string of the authentication system gateway role (lifecycle, cleanup, MFA admin).' },
    { name: 'DB_POOL_MAX', kind: 'config', required: 'optional', whenMissing: 'default:20 connections for the tenant pool (db/db.ts); 5 under CI and 1 under test', provisionedBy: bicep(), description: 'Maximum size of the tenant connection pool.', example: '20' },
    { name: 'DB_IDLE_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:30 seconds before an idle connection closes (db/db.ts)', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Seconds before an idle tenant connection closes.', example: '30' },
    { name: 'DB_CONNECTION_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:10 seconds to open a tenant connection (db/db.ts)', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Seconds to wait when opening a tenant connection.', example: '10' },
    { name: 'DB_QUERY_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:30000 ms statement timeout on tenant queries (db/db.ts)', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Milliseconds before a tenant statement is cancelled.', example: '30000' },
    { name: 'SYSTEM_DB_POOL_MAX', kind: 'config', required: 'optional', whenMissing: 'default:5, a deliberately small system pool (db/system-db.ts)', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Maximum size of the system connection pool.', example: '5' },
    { name: 'SYSTEM_DB_IDLE_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:30 seconds before an idle system connection closes', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Seconds before an idle system connection closes.', example: '30' },
    { name: 'SYSTEM_DB_CONNECTION_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:10 seconds to open a system connection', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Seconds to wait when opening a system connection.', example: '10' },
    { name: 'SYSTEM_DB_QUERY_TIMEOUT', kind: 'config', required: 'optional', whenMissing: 'default:30000 ms statement timeout on system queries', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Milliseconds before a system statement is cancelled.', example: '30000' },
    { name: 'DATABASE_POOL_SIZE', kind: 'config', required: 'optional', whenMissing: 'default:20 connections in the shared @nzila/db client pool', provisionedBy: notNeeded('a tuning knob with a safe default'), description: 'Pool size of the shared @nzila/db client.', example: '20' },
    { name: 'PLATFORM_DATABASE_URL', kind: 'secret', required: 'optional', whenMissing: 'degraded:the platform (cross-application) database handle throws on first use; Union Eyes does not use it for its own tenant data', provisionedBy: notNeeded('used by the shared platform database client, not by Union Eyes request paths'), description: 'Connection string of the Nzila platform database, for the shared platform client.' },
  ]),
  ...section('auth', 'authentication', [
    { name: 'AUTH_SECRET', kind: 'secret', required: 'production', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('auth-secret'), externalConsumer: 'Auth.js (next-auth) signs the session cookie with it', description: 'Signing secret of session cookies and authentication tokens: at least 32 characters, not a placeholder.' },
    { name: 'AUTH_MFA_ENCRYPTION_KEY', kind: 'secret', required: 'production', minLength: 64, whenMissing: 'fail-closed', provisionedBy: bicep('mfa-encryption-key'), description: 'AES-256-GCM key of the stored TOTP secrets: exactly 64 hex characters. A deployed environment refuses to enrol or verify MFA without it; it is never derived from AUTH_SECRET there.' },
    { name: 'AZURE_AD_TENANT_ID', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: [bicep(), dockerfile], description: 'Microsoft Entra directory (tenant) id of the application registration.' },
    { name: 'AZURE_AD_CLIENT_ID', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: [bicep(), dockerfile], description: 'Application (client) id of the Entra app registration.' },
    { name: 'AZURE_AD_CLIENT_SECRET', kind: 'secret', required: 'production', minLength: 16, whenMissing: 'fail-closed', provisionedBy: bicep('azure-ad-client-secret'), description: 'Client secret of the Entra app registration.' },
    { name: 'AZURE_AD_STAGING_SINGLE_TENANT', kind: 'flag', required: 'optional', whenMissing: 'default:unset; the multi-tenant /common issuer applies, and a production target ignores the flag (packages/platform-auth entra issuer resolution)', provisionedBy: notNeeded('a staging-only opt-in that a production target ignores'), description: 'Staging only: pin the issuer to AZURE_AD_TENANT_ID.' },
    { name: 'AZURE_AD_STAGING_SESSION_MAX_AGE_SECONDS', kind: 'config', required: 'optional', whenMissing: 'default:the standard session lifetime; the override is honoured only for a validated staging single-tenant target', provisionedBy: notNeeded('a staging-only override that other targets ignore'), description: 'Staging only: shorter session lifetime for the single-tenant staging registration.' },
    { name: 'NZILA_AUTH_ENABLE_PG_FALLBACK', kind: 'flag', required: 'optional', whenMissing: 'default:true, the PostgreSQL-backed password session stays available next to Entra sign-in', provisionedBy: notNeeded('the password session is a product feature, on by default'), description: 'false turns the PostgreSQL password-session path off (server side).', example: 'true' },
    { name: 'NEXT_PUBLIC_NZILA_AUTH_ENABLE_PG_FALLBACK', kind: 'flag', required: 'optional', whenMissing: 'default:true, the client looks for the PostgreSQL password session', provisionedBy: notNeeded('the password session is a product feature, on by default'), description: 'Client-side mirror of NZILA_AUTH_ENABLE_PG_FALLBACK (build time).', example: 'true' },
    { name: 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED', kind: 'flag', required: 'staging', whenMissing: 'fail-closed', provisionedBy: operator('staging acceptance runs set it on the staging revision for the run; no workflow does'), productionProof: 'packages/platform-auth/src/acceptance-auth.test.ts', description: 'Staging only: lets the acceptance harness sign in with the acceptance secret. Unset, the acceptance sign-in is off. Refused on any production target.' },
    { name: 'UNION_EYES_ACCEPTANCE_AUTH_SECRET', kind: 'secret', required: 'staging', minLength: 32, whenMissing: 'fail-closed', provisionedBy: operator('staging acceptance runs set it on the staging revision for the run; no workflow does'), productionProof: 'packages/platform-auth/src/acceptance-auth.test.ts', description: 'Staging only: shared secret of the acceptance sign-in (at least 32 characters). Refused on any production target.' },
  ]),
  ...section('authorization', 'authorization', [
    { name: 'PLATFORM_ADMIN_USER_IDS', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'Comma-separated user ids that hold platform administrator access across organizations. Empty means nobody does.' },
    { name: 'SUPER_ADMIN_ORG_ID', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'Organization whose administrators get cross-organization super-admin access. Unset disables that access (a warning is logged).' },
    { name: 'SUPER_ADMIN_EMAILS', kind: 'config', required: 'optional', whenMissing: 'default:only the built-in Nzila operator addresses in packages/os-core/src/config/super-admins.ts are super-admins', provisionedBy: notNeeded('adds to a built-in list; an environment without extra super-admins sets nothing'), description: 'Comma-separated extra super-admin email addresses (added to the built-in operator addresses).' },
    { name: 'UE_CANDIDATE_PROBE_TOKEN', kind: 'secret', required: 'optional', minLength: 32, whenMissing: 'degraded:the deployment probe is never authorized, so /api/version and /api/ready disclose only the minimal public build identity', provisionedBy: workflow, description: 'Bearer token the deployment workflow presents to a candidate host to read its full build identity (at least 32 characters).' },
    { name: 'DEV_ROLE_OVERRIDE', kind: 'config', required: 'dev-only', whenMissing: 'default:unset; roles come from membership', provisionedBy: notNeeded('development only: refused outside NODE_ENV=development and on any deployed runtime'), productionProof: 'lib/auth/__tests__/dev-role-override.test.ts', description: 'Development only: act as this role instead of the signed-in role.' },
    { name: 'UE_ALLOW_DEFAULT_ORG', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; a signed-in user with no organization gets none', provisionedBy: notNeeded('development only: ignored on any deployed runtime'), productionProof: 'lib/__tests__/organization-utils.test.ts', description: 'Development only: fall back to the default organization when a user has none.' },
    { name: 'UE_ALLOW_SEED_MEMBERSHIP_LINKING', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; the dashboard never links a seeded identity to a membership', provisionedBy: notNeeded('development only: ignored on any deployed runtime'), productionProof: 'lib/dashboard/__tests__/layout-bootstrap.test.ts', description: 'Development only: let the dashboard link a seeded identity to its seeded membership.' },
    { name: 'UE_MEMBER_DUES_PAYMENTS', kind: 'flag', required: 'optional', capability: 'payments', whenMissing: 'default:unset; the member dues initiation routes answer 501 (lib/dues/member-dues-flag.ts)', provisionedBy: notNeeded('member dues collection is not part of the initial launch; set 1 only when it is enabled'), description: 'Set 1 to enable member-facing dues payment initiation.', example: '' },
  ]),
  ...section('keys', 'encryption', [
    { name: 'AZURE_KEY_VAULT_URL', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: bicep(), description: 'Azure Key Vault holding the PII encryption key. A deployed environment encrypts only through it.' },
    { name: 'ENCRYPTION_KEY_NAME', kind: 'config', required: 'optional', whenMissing: 'default:pii-encryption-key, the key name the vault is provisioned with', provisionedBy: notNeeded('the vault key has a fixed provisioned name'), description: 'Name of the Key Vault key that wraps PII.', example: 'pii-encryption-key' },
    knob('KEY_ROTATION_ENABLED', 'enabled; only the value false turns rotation off', 'false disables the scheduled encryption-key rotation check.', 'true'),
    knob('KEY_MAX_AGE_DAYS', '90 days before the key is due for rotation', 'Days before the encryption key is due for rotation.', '90'),
    knob('KEY_ROTATION_GRACE_PERIOD_DAYS', '30 days during which the previous key still decrypts', 'Days the previous key stays valid for decryption after a rotation.', '30'),
    knob('MAX_KEY_VERSIONS_RETAINED', '3 retained key versions', 'Number of encryption key versions kept for decryption.', '3'),
    { name: 'FALLBACK_ENCRYPTION_KEY', kind: 'secret', required: 'dev-only', whenMissing: 'fail-closed', provisionedBy: notNeeded('development only: setting it in production blocks startup (lib/encryption.ts)'), productionProof: 'lib/__tests__/encryption.test.ts', description: 'Development only: base64 32-byte key used when no Key Vault is configured. A deployed environment refuses to start with it set.' },
    { name: 'TEST_ENCRYPTION_KEY', kind: 'secret', required: 'test-only', whenMissing: 'fail-closed', provisionedBy: notNeeded('tests only: honoured only under NODE_ENV=test on a non-deployed runtime'), productionProof: 'lib/__tests__/encryption-deployed.test.ts', description: 'Tests only: base64 32-byte key of the unit-test encryption service.' },
    { name: 'NAR_SIGNING_SECRET', kind: 'secret', required: 'production', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('nar-signing-secret'), description: 'HMAC secret that signs the immutable audit records (NAR): at least 32 characters, not a placeholder.' },
    { name: 'NAR_SIGNING_KEY_ID', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: bicep(), description: 'Identifier of the NAR signing key (names the key version a record was signed with, for rotation).' },
    { name: 'KEY_VAULT_URI', kind: 'config', required: 'optional', whenMissing: 'default:unset; NAR_SIGNING_SECRET must then come from the environment and platform secrets resolve from the environment', provisionedBy: notNeeded('an alternative source for the NAR signing secret and platform secrets; NAR_SIGNING_SECRET is the provisioned one'), description: 'Key Vault the platform packages (@nzila/os-core secrets, the NAR secret) read from.' },
    { name: 'EVIDENCE_SEAL_KEY', kind: 'secret', required: 'production', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('evidence-seal-key'), description: 'HMAC key that seals exported evidence packs: at least 32 characters, not a placeholder.' },
    { name: 'COMMUNICATIONS_TRACKING_SECRET', kind: 'secret', required: 'production', capability: 'communications-tracking', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('communications-tracking-secret'), description: 'HMAC secret of the open/click tracking tokens in sent communications: at least 32 characters, not a placeholder.' },
    { name: 'RESEND_TRACKING_SECRET', kind: 'secret', required: 'optional', capability: 'communications-tracking', minLength: 32, whenMissing: 'degraded:legacy alias: unset, COMMUNICATIONS_TRACKING_SECRET is the secret in use', provisionedBy: notNeeded('legacy alias of COMMUNICATIONS_TRACKING_SECRET'), description: 'Legacy alias of COMMUNICATIONS_TRACKING_SECRET.' },
    { name: 'EMAIL_SUPPRESSION_HASH_KEY', kind: 'secret', required: 'production', capability: 'communications-tracking', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('email-suppression-hash-key'), description: 'Keyed-hash secret of the email suppression list: at least 32 characters, not a placeholder.' },
    { name: 'PUBLIC_INTAKE_AUDIT_KEY', kind: 'secret', required: 'production', capability: 'public-intake', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('public-intake-audit-key'), description: 'Keyed-hash secret that pseudonymises the network addresses in the public-intake audit trail: at least 32 characters, not a placeholder.' },
    { name: 'VOTING_SECRET', kind: 'secret', required: 'production', capability: 'voting', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('voting-secret'), description: 'Secret that blinds and verifies ballots: at least 32 characters, not a placeholder.' },
    { name: 'NZILA_FIPS_REQUIRED', kind: 'flag', required: 'optional', whenMissing: 'default:false; the runtime does not require a FIPS-validated crypto provider', provisionedBy: notNeeded('a stricter mode an operator opts into'), description: 'true refuses to start unless the OpenSSL FIPS provider is active.' },
    { name: 'NZILA_FIPS_STRICT', kind: 'flag', required: 'optional', whenMissing: 'default:false; non-FIPS algorithms are only reported', provisionedBy: notNeeded('a stricter mode an operator opts into'), description: 'true makes a non-FIPS algorithm an error instead of a report.' },
    { name: 'OPENSSL_CONF', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'default:unset; the default OpenSSL configuration applies', provisionedBy: platform('the container image supplies it when it ships a FIPS provider'), description: 'OpenSSL configuration file (read to detect a FIPS provider).' },
    { name: 'OPENSSL_MODULES', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'default:unset; the default OpenSSL module path applies', provisionedBy: platform('the container image supplies it when it ships a FIPS provider'), description: 'OpenSSL module directory (read to detect a FIPS provider).' },
  ]),
  ...section('cron', 'cron-jobs', [
    { name: 'CRON_SECRET_KEY', kind: 'secret', required: 'production', minLength: 32, whenMissing: 'fail-closed',     provisionedBy: bicep('cron-secret'), description: 'Bearer secret every scheduled-job route requires: at least 32 characters, not a placeholder. Unset, every cron route answers 401.' },
        { name: 'CRON_SECRET', kind: 'secret', required: 'optional', minLength: 32, whenMissing: 'degraded:legacy alias: unset, CRON_SECRET_KEY is the secret in use', provisionedBy: notNeeded('legacy alias of CRON_SECRET_KEY'), description: 'Legacy alias of CRON_SECRET_KEY.' },
  ]),
  ...section('email', 'email-delivery', [
    { name: 'RESEND_API_KEY', kind: 'secret', required: 'production', minLength: 16, whenMissing: 'degraded:no email is sent: sendEmail returns success:false "Email service not configured" and the delivery is recorded as failed', provisionedBy: [bicep('resend-api-key'), workflow], description: 'API key of the Resend email provider.' },
    { name: 'RESEND_WEBHOOK_SECRET', kind: 'secret', required: 'production', minLength: 16, whenMissing: 'fail-closed', provisionedBy: bicep('resend-webhook-secret'), description: 'Signing secret of the Resend delivery webhook (bounces, complaints, opens). Unset, the webhook route answers 503 and nothing is accepted.' },
    { name: 'RESEND_FROM_EMAIL', kind: 'config', required: 'optional', whenMissing: 'default:EMAIL_FROM, then noreply@unioneyes.app, a mailbox the product owns', provisionedBy: [bicep(), workflow], description: 'Sender address of outgoing email.', example: 'noreply@unioneyes.app' },
    { name: 'EMAIL_FROM', kind: 'config', required: 'optional', whenMissing: 'default:noreply@unioneyes.app, a mailbox the product owns', provisionedBy: bicep(), description: 'Fallback sender address when RESEND_FROM_EMAIL is not set.', example: 'noreply@unioneyes.app' },
    { name: 'EMAIL_REPLY_TO', kind: 'config', required: 'optional', whenMissing: 'default:support@unioneyes.app, a mailbox the product owns', provisionedBy: bicep(), description: 'Reply-to address of outgoing email.', example: 'support@unioneyes.app' },
    { name: 'EMAIL_PROVIDER', kind: 'config', required: 'optional', whenMissing: 'default:resend; the notification service falls back to sendgrid only when RESEND_API_KEY is unset', provisionedBy: bicep(), description: 'Outgoing email provider: resend or sendgrid.', example: 'resend' },
    member('sendgrid', 'SENDGRID_API_KEY', 'secret', 'the SendGrid provider throws "SendGrid API key not configured" and notifications routed through it are recorded as failed', 'API key of the optional SendGrid email provider.'),
    member('sendgrid', 'SENDGRID_FROM_EMAIL', 'config', 'noreply@unioneyes.app is the sender', 'Sender address of the SendGrid provider.', { integrationOptional: true }),
    member('sendgrid', 'SENDGRID_FROM_NAME', 'config', 'UnionEyes is the sender name', 'Sender name of the SendGrid provider.', { integrationOptional: true }),
    member('sendgrid', 'SENDGRID_REPLY_TO_EMAIL', 'config', 'no reply-to header is added', 'Reply-to address of the SendGrid provider.', { integrationOptional: true }),
    { name: 'ADMIN_EMAIL', kind: 'config', required: 'optional', capability: 'compliance', whenMissing: 'default:admin@unioneyes.app, the product-owned administrator mailbox that receives dues and consent notices', provisionedBy: notNeeded('the notice mailbox has a product-owned default'), description: 'Administrator mailbox for dues and consent notices.', example: 'admin@unioneyes.app' },
    { name: 'DPO_EMAIL', kind: 'config', required: 'optional', capability: 'compliance', whenMissing: 'default:ADMIN_EMAIL; privacy requests go to the administrator mailbox', provisionedBy: notNeeded('falls back to the administrator mailbox'), description: 'Data-protection officer mailbox for privacy requests.' },
    { name: 'PRIVACY_OFFICER_EMAIL', kind: 'config', required: 'optional', capability: 'compliance', whenMissing: 'default:DPO_EMAIL, then ADMIN_EMAIL', provisionedBy: notNeeded('falls back to the DPO mailbox'), description: 'Provincial privacy officer mailbox.' },
  ]),
  ...section('messaging', 'sms-push', [
    member('twilio-sms', 'TWILIO_ACCOUNT_SID', 'config', 'SMS notifications throw "Twilio credentials not configured" and are recorded as failed deliveries', 'Twilio account SID of the SMS provider.'),
    member('twilio-sms', 'TWILIO_AUTH_TOKEN', 'secret', 'SMS notifications throw "Twilio credentials not configured" and are recorded as failed deliveries', 'Twilio auth token of the SMS provider.'),
    member('twilio-sms', 'TWILIO_PHONE_NUMBER', 'config', 'SMS notifications throw "Twilio credentials not configured" and are recorded as failed deliveries', 'Twilio sender phone number (E.164).'),
    member('firebase-push', 'FIREBASE_SERVICE_ACCOUNT', 'secret', 'push notifications throw "FIREBASE_SERVICE_ACCOUNT not configured" and are recorded as failed deliveries', 'Firebase service-account JSON of the push provider.'),
  ]),
  ...section('calendar', 'calendar-sync', [
    { name: 'CALENDAR_OAUTH_STATE_SECRET', kind: 'secret', required: 'optional', minLength: 32, whenMissing: 'fail-closed', provisionedBy: OPTIONAL_INTEGRATION, integration: ['google-calendar', 'microsoft-calendar'], description: 'Signs the calendar OAuth state parameter (at least 32 bytes); falls back to CALENDAR_TOKEN_ENCRYPTION_KEY. Unset, no calendar connection can start.' },
    { name: 'CALENDAR_TOKEN_ENCRYPTION_KEY', kind: 'secret', required: 'optional', minLength: 64, whenMissing: 'fail-closed', provisionedBy: OPTIONAL_INTEGRATION, integration: ['google-calendar', 'microsoft-calendar'], description: 'AES-256 key (64 hex characters) that encrypts stored calendar tokens. Unset, tokens are neither stored nor read.' },
    { name: 'CALENDAR_TOKEN_ALLOW_LEGACY_PLAINTEXT', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; a calendar token stored unencrypted must be re-authorized', provisionedBy: notNeeded('development only: refused on any deployed runtime'), productionProof: 'lib/external-calendar-sync/__tests__/token-crypto.test.ts', description: 'Development only: read calendar tokens that were stored in plaintext.' },
    member('google-calendar', 'GOOGLE_CALENDAR_CLIENT_ID', 'config', 'Google Calendar sync is unavailable and readiness reports it as not configured', 'OAuth client id of the Google Calendar integration.'),
    member('google-calendar', 'GOOGLE_CALENDAR_CLIENT_SECRET', 'secret', 'Google Calendar sync is unavailable and readiness reports it as not configured', 'OAuth client secret of the Google Calendar integration.'),
    member('google-calendar', 'GOOGLE_CALENDAR_REDIRECT_URI', 'config', 'Google Calendar sync is unavailable: a deployed environment has no localhost callback to fall back to', 'OAuth callback URL registered with Google: <app URL>/api/calendar-sync/google/callback.'),
    member('microsoft-calendar', 'MICROSOFT_CALENDAR_CLIENT_ID', 'config', 'Microsoft Calendar sync is unavailable and readiness reports it as not configured', 'OAuth client id of the Microsoft Calendar integration.'),
    member('microsoft-calendar', 'MICROSOFT_CALENDAR_CLIENT_SECRET', 'secret', 'Microsoft Calendar sync is unavailable and readiness reports it as not configured', 'OAuth client secret of the Microsoft Calendar integration.'),
    member('microsoft-calendar', 'MICROSOFT_CALENDAR_REDIRECT_URI', 'config', 'Microsoft Calendar sync is unavailable: a deployed environment has no localhost callback to fall back to', 'OAuth callback URL registered with Microsoft: <app URL>/api/calendar-sync/microsoft/callback.'),
    member('microsoft-calendar', 'MICROSOFT_TENANT_ID', 'config', 'the multi-tenant common endpoint is used', 'Directory the Microsoft Calendar OAuth app signs in against.', { integrationOptional: true }),
    knob('CALENDAR_SYNC_INTERVAL_MINUTES', '30 minutes between two manual syncs of one connection', 'Minimum minutes between syncs of one calendar connection.', '30'),
  ]),
  ...section('storage', 'document-storage', [
    { name: 'AZURE_STORAGE_ACCOUNT_NAME', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: bicep(), description: 'Azure Storage account that holds documents and audit records.' },
    { name: 'AZURE_STORAGE_ACCOUNT_KEY', kind: 'secret', required: 'production', minLength: 32, whenMissing: 'fail-closed', provisionedBy: bicep('storage-account-key'), description: 'Access key of the Azure Storage account.' },
    { name: 'AZURE_BLOB_CONTAINER', kind: 'config', required: 'optional', whenMissing: 'default:union-eyes, the container the platform provisions for member documents', provisionedBy: bicep(), description: 'Blob container of member documents.', example: 'union-eyes' },
    { name: 'AZURE_STORAGE_BLOB_ENDPOINT', kind: 'config', required: 'dev-only', whenMissing: 'default:https://<account>.blob.core.windows.net, the real storage endpoint', provisionedBy: notNeeded('development only: points the blob client at an emulator'), productionProof: 'packages/blob/src/index.test.ts', description: 'Development only: blob endpoint override (the Azurite emulator). Refused on any production runtime.' },
    { name: 'AZURE_STORAGE_CONNECTION_STRING', kind: 'secret', required: 'optional', whenMissing: 'degraded:NAR records use AZURE_STORAGE_ACCOUNT_NAME with the account key, and signature storage falls to another backend', provisionedBy: OPTIONAL_INTEGRATION, integration: ['signature-storage-azure'], description: 'Connection string of an Azure Storage account: selects Azure as the e-signature document backend, and is accepted for NAR records.' },
    { name: 'AZURE_STORAGE_CONTAINER', kind: 'config', required: 'optional', whenMissing: 'default:signatures, the e-signature container', provisionedBy: notNeeded('the signature container has a fixed provisioned name'), integration: 'signature-storage-azure', integrationOptional: true, description: 'Blob container of e-signature documents (Azure backend).', example: 'signatures' },
    { name: 'AZURE_STORAGE_CONTAINER_NAME', kind: 'config', required: 'optional', whenMissing: 'default:audit-records, the immutable NAR container', provisionedBy: notNeeded('the audit container has a fixed provisioned name'), description: 'Fallback name of the immutable audit-record container.' },
    { name: 'NAR_AUDIT_CONTAINER_NAME', kind: 'config', required: 'optional', whenMissing: 'default:AZURE_STORAGE_CONTAINER_NAME, then audit-records', provisionedBy: notNeeded('the audit container has a fixed provisioned name'), description: 'Immutable (WORM) container of NAR audit records.', example: 'audit-records' },
    { name: 'NAR_IMMUTABILITY_LOCK_MODE', kind: 'config', required: 'optional', whenMissing: 'default:locked, the strictest policy: a record cannot be altered or deleted before retention ends', provisionedBy: notNeeded('the default is the strictest mode'), description: 'locked (default) or unlocked retention policy of NAR blobs.', example: 'locked' },
    { name: 'NAR_LEGAL_HOLD', kind: 'flag', required: 'optional', whenMissing: 'default:true, a legal hold is set on every NAR blob', provisionedBy: notNeeded('the default is the strictest mode'), description: 'false skips the legal hold on NAR blobs.', example: 'true' },
    { name: 'NAR_STORAGE_MODE', kind: 'config', required: 'dev-only', whenMissing: 'default:unset; NAR records go to immutable Azure blob storage', provisionedBy: notNeeded('development only: honoured only with QA_TEST_ENV=true, UE_ENVIRONMENT=local and no production signal'), productionProof: 'packages/nar/src/storage/local-sandbox.test.ts', description: 'Development only: local_sandbox writes NAR records to a local directory (never immutable).' },
    { name: 'NAR_LOCAL_SANDBOX_DIR', kind: 'config', required: 'dev-only', whenMissing: 'default:a nar-local-sandbox folder under the OS temp directory', provisionedBy: notNeeded('development only: used by the local NAR sandbox'), productionProof: 'packages/nar/src/storage/local-sandbox.test.ts', description: 'Development only: directory of the local NAR sandbox.' },
    { name: 'CLAMAV_URL', kind: 'config', required: 'production', capability: 'malware-scanning', whenMissing: 'fail-closed', provisionedBy: bicep(), description: 'ClamAV scan endpoint. Unset or unreachable, every upload is refused in a deployed environment.' },
    { name: 'CLAMAV_FAIL_OPEN', kind: 'flag', required: 'dev-only', capability: 'malware-scanning', whenMissing: 'default:false; an unavailable scanner refuses the upload', provisionedBy: notNeeded('development only: the deployment leaves it unset, and a deployed runtime ignores it'), productionProof: 'lib/security/__tests__/clamav.test.ts', description: 'Development only: accept an upload when the scanner is unavailable. Ignored on any deployed runtime.', example: 'false' },
    { name: 'CLAMAV_ENFORCE_IN_TEST', kind: 'flag', required: 'test-only', capability: 'malware-scanning', whenMissing: 'default:unset; tests do not enforce the scanner', provisionedBy: notNeeded('tests only'), description: 'Tests only: enforce the scanner under NODE_ENV=test.' },
    { name: 'UE_DOCUMENT_STORAGE_HOSTS', kind: 'config', required: 'optional', whenMissing: 'default:nzilacanadastore.blob.core.windows.net, the approved storage host; every other host is refused', provisionedBy: operator('set only if the storage account host differs from the default'), description: 'Comma-separated approved storage hosts for attached interview documents.', example: 'nzilacanadastore.blob.core.windows.net' },
    member('signature-storage-r2', 'CLOUDFLARE_R2_ENDPOINT', 'config', 'when no Azure connection string is set either, signature documents use the S3 backend', 'Cloudflare R2 endpoint: selects R2 as the e-signature document backend.'),
    member('signature-storage-r2', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'secret', 'signature uploads throw "Missing required environment variables: CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY"', 'Cloudflare R2 access key id.'),
    member('signature-storage-r2', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'secret', 'signature uploads throw "Missing required environment variables: CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY"', 'Cloudflare R2 secret access key.'),
    member('signature-storage-r2', 'CLOUDFLARE_R2_BUCKET', 'config', 'union-eyes-signatures is the bucket', 'Cloudflare R2 bucket of e-signature documents.', { integrationOptional: true }),
    member('signature-storage-s3', 'AWS_ACCESS_KEY_ID', 'secret', 'with neither Azure nor R2 configured, signature uploads throw "Missing required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"', 'AWS access key id of the S3 e-signature document backend (the default backend).'),
    member('signature-storage-s3', 'AWS_SECRET_ACCESS_KEY', 'secret', 'with neither Azure nor R2 configured, signature uploads throw "Missing required environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"', 'AWS secret access key of the S3 e-signature document backend.'),
    member('signature-storage-s3', 'AWS_REGION', 'config', 'us-east-1 is the region', 'AWS region of the S3 backends.', { integrationOptional: true }),
    member('signature-storage-s3', 'AWS_SIGNATURES_BUCKET', 'config', 'union-eyes-signatures is the bucket', 'S3 bucket of e-signature documents.', { integrationOptional: true }),
  ]),
  ...section('payments', 'payments', [
    member('stripe', 'STRIPE_SECRET_KEY', 'secret', 'Stripe payments are unavailable: the dues provider reports not configured and the checkout routes refuse', 'Stripe secret API key.', { whenMissing: 'degraded:Stripe payments are unavailable: the dues provider reports not configured and the checkout routes refuse' }),
    member('stripe', 'STRIPE_WEBHOOK_SECRET', 'secret', 'the Stripe webhook route answers 503 and no event is accepted', 'Signing secret of the Stripe webhook endpoint.'),
    member('stripe', 'STRIPE_ENVIRONMENT', 'config', 'the Stripe environment is derived from the key prefix', 'Stripe environment label: test or live.', { integrationOptional: true }),
    member('stripe', 'STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS', 'config', 'every refund follows the default approval policy', 'Refund amount (cents) above which a second approval is required.', { integrationOptional: true }),
    member('stripe', 'STRIPE_DEFAULT_CURRENCY', 'config', 'CAD is the checkout currency', 'Default checkout currency (ISO 4217).', { integrationOptional: true, example: 'CAD' }),
    member('stripe', 'STRIPE_PRICE_ICRA_BRIEF', 'config', 'the ICRA brief checkout answers that it is not configured', 'Stripe price id of the ICRA brief.', { integrationOptional: true }),
    member('stripe', 'STRIPE_PRICE_ICRA_DIAGNOSTIC', 'config', 'the ICRA diagnostic checkout answers that it is not configured', 'Stripe price id of the ICRA diagnostic.', { integrationOptional: true }),
    member('stripe', 'STRIPE_PRICE_WORKBOOK_SELF_GUIDED', 'config', 'the workbook checkout answers that it is not configured', 'Stripe price id of the self-guided workbook.', { integrationOptional: true }),
    member('paypal', 'PAYPAL_CLIENT_ID', 'config', 'the PayPal webhook route refuses events it cannot verify', 'PayPal REST client id (webhook verification).'),
    member('paypal', 'PAYPAL_CLIENT_SECRET', 'secret', 'the PayPal webhook route refuses events it cannot verify', 'PayPal REST client secret (webhook verification).'),
    member('paypal', 'PAYPAL_WEBHOOK_ID', 'config', 'the PayPal webhook route refuses events it cannot verify', 'Id of the PayPal webhook subscription (webhook verification).'),
    member('shopify-rewards', 'SHOPIFY_ENABLED', 'flag', 'the rewards store integration is off', 'true turns the Shopify rewards integration on.', { example: 'false' }),
    member('shopify-rewards', 'SHOPIFY_SHOP_DOMAIN', 'config', 'the Shopify rewards page reports the shop as not configured', 'Shopify shop domain of the rewards store.'),
    member('shopify-rewards', 'SHOPIFY_ADMIN_TOKEN', 'secret', 'the Shopify rewards page reports the admin token as not configured', 'Shopify Admin API token.'),
    member('shopify-rewards', 'SHOPIFY_STOREFRONT_TOKEN', 'secret', 'the Shopify rewards page reports the storefront token as not configured', 'Shopify Storefront API token.'),
    member('shopify-rewards', 'SHOPIFY_WEBHOOK_SECRET', 'secret', 'the Shopify webhook route answers 500 and no event is accepted', 'Signing secret of the Shopify webhooks.'),
  ]),
  ...section('ai', 'ai-assistant', [
    { name: 'AI_SDK_BASE_URL', kind: 'config', required: 'optional', whenMissing: 'default:NEXT_PUBLIC_APP_URL, the app itself, which proxies the AI runtime', provisionedBy: notNeeded('falls back to the app URL'), description: 'Base URL of the AI runtime the AI client calls.' },
    { name: 'AI_SERVICE_KEY', kind: 'secret', required: 'optional', minLength: 32, whenMissing: 'fail-closed', provisionedBy: OPTIONAL_INTEGRATION, integration: 'ai-service', description: 'Service key the AI runtime and the operational-metrics route accept (at least 32 characters). Unset, the AI client sends none and the metrics route refuses it.' },
    { name: 'AI_SERVICE_URL', kind: 'config', required: 'optional', whenMissing: 'degraded:the ML query route answers that the AI service is not configured', provisionedBy: OPTIONAL_INTEGRATION, integration: 'ai-service', description: 'URL of the external AI service behind the ML query route.' },
    { name: 'AI_SERVICE_TOKEN', kind: 'secret', required: 'optional', minLength: 32, whenMissing: 'degraded:the ML query route calls the AI service without authorization and the service refuses it', provisionedBy: OPTIONAL_INTEGRATION, integration: 'ai-service', description: 'Bearer token for the external AI service (at least 32 characters).' },
    { name: 'QUEUE_STATUS_SERVICE_KEY', kind: 'secret', required: 'optional', capability: 'orchestration', minLength: 32, whenMissing: 'fail-closed', provisionedBy: operator('shared with the monitoring caller of /api/union-eyes/queue-status'), description: 'Service key of the queue-status route (at least 32 characters). Unset, only a signed-in administrator can read it.' },
    member('azure-openai', 'AZURE_OPENAI_ENDPOINT', 'config', 'voice transcription answers that the service is not configured', 'Azure OpenAI endpoint (voice transcription).'),
    member('azure-openai', 'AZURE_OPENAI_API_KEY', 'secret', 'voice transcription answers that the service is not configured', 'Azure OpenAI API key (voice transcription).'),
    member('azure-openai', 'AZURE_OPENAI_WHISPER_ENDPOINT', 'config', 'AZURE_OPENAI_ENDPOINT is used', 'Dedicated Whisper endpoint.', { integrationOptional: true }),
    member('azure-openai', 'AZURE_OPENAI_WHISPER_API_KEY', 'secret', 'AZURE_OPENAI_API_KEY is used', 'Dedicated Whisper API key.', { integrationOptional: true }),
    member('azure-openai', 'AZURE_OPENAI_WHISPER_DEPLOYMENT', 'config', 'whisper is the deployment name', 'Whisper deployment name.', { integrationOptional: true }),
    knob('AZURE_OPENAI_DEPLOYMENT', 'gpt-4, the model name sent to the AI runtime', 'Model (deployment) name the copilot, insights and chatbot routes request.', 'gpt-4'),
    member('azure-speech', 'AZURE_SPEECH_KEY', 'secret', 'speech synthesis throws "AZURE_SPEECH_KEY is not set" and the caller reports the voice feature unavailable', 'Azure Speech key.'),
    member('azure-speech', 'AZURE_SPEECH_REGION', 'config', 'speech synthesis throws "AZURE_SPEECH_REGION is not set" and the caller reports the voice feature unavailable', 'Azure Speech region.'),
    member('azure-vision', 'AZURE_COMPUTER_VISION_ENDPOINT', 'config', 'OCR through Azure Computer Vision is unavailable', 'Azure Computer Vision endpoint (OCR).'),
    member('azure-vision', 'AZURE_COMPUTER_VISION_KEY', 'secret', 'OCR through Azure Computer Vision is unavailable', 'Azure Computer Vision key (OCR).'),
    knob('UE_MAMBA_PROFILE_KEY', 'the chatbot profile, UE_PROFILES.CHATBOT', 'AI runtime profile the text-generation service requests.'),
    knob('UE_AUTO_CLASSIFICATION_ACCEPT_THRESHOLD', 'the built-in accept threshold of the auto-classification service; an out-of-range value is ignored', 'Confidence at or above which a classification is accepted without review.'),
    knob('UE_AUTO_CLASSIFICATION_REVIEW_THRESHOLD', 'the built-in review threshold of the auto-classification service; an out-of-range value is ignored', 'Confidence at or above which a classification goes to review instead of being discarded.'),
    { name: 'FEATURE_CASE_INTELLIGENCE_V1_ML', kind: 'flag', required: 'optional', capability: 'feature-flags', whenMissing: 'default:false; case-intelligence ML relevance is off until enabled', provisionedBy: notNeeded('a feature flag, off by default'), description: 'true turns on ML relevance in case intelligence.', example: 'false' },
    { name: 'FEATURE_CASE_INTELLIGENCE_V1_PATTERNS', kind: 'flag', required: 'optional', capability: 'feature-flags', whenMissing: 'default:true; pattern relevance stays on unless it is turned off', provisionedBy: notNeeded('a feature flag with a safe default'), description: 'false turns off pattern relevance in case intelligence.', example: 'true' },
    knob('CBA_INTEL_DOCUMENT_CONCURRENCY', '1 document at a time', 'Documents the CBA ingestion processes concurrently.', '1'),
    knob('CBA_INTEL_SOURCE_CONCURRENCY', '1 source at a time', 'Sources the CBA ingestion processes concurrently.', '1'),
    knob('CBA_INTEL_FETCH_RETRIES', '2 retries per fetch', 'Retries per document fetch in the CBA ingestion.', '2'),
    knob('CBA_INTEL_FETCH_TIMEOUT_MS', 'the built-in fetch timeout of the CBA ingestion', 'Milliseconds before a CBA document fetch times out.'),
    knob('CBA_INTEL_MAX_AUTO_REVIEW_ENQUEUES', '20 enqueues per extraction run', 'Reviews one CBA extraction run may enqueue automatically.', '20'),
    knob('CBA_INTEL_REVIEW_CONFIDENCE_THRESHOLD', 'the built-in review threshold of the CBA extraction', 'Confidence below which a CBA extraction goes to review.'),
  ]),
  ...section('crm', 'crm', [
    member('hubspot', 'HUBSPOT_API_KEY', 'secret', 'ICRA and workbook purchases are not synced to HubSpot: the sync logs that HubSpot is not configured and skips', 'HubSpot private-app token.'),
    member('hubspot', 'HUBSPOT_PIPELINE_STAGE_WORKBOOK_SELF_GUIDED_PURCHASED', 'config', 'the built-in stage id of the workbook pipeline is used', 'HubSpot pipeline stage id: workbook, self-guided purchased.', { integrationOptional: true }),
    member('hubspot', 'HUBSPOT_PIPELINE_STAGE_WORKBOOK_FACILITATED_INTEREST', 'config', 'the built-in stage id of the workbook pipeline is used', 'HubSpot pipeline stage id: workbook, facilitated interest.', { integrationOptional: true }),
    member('hubspot', 'HUBSPOT_PIPELINE_STAGE_WORKBOOK_ENTERPRISE_INQUIRY', 'config', 'the built-in stage id of the workbook pipeline is used', 'HubSpot pipeline stage id: workbook, enterprise inquiry.', { integrationOptional: true }),
    member('statcan', 'STATCAN_API_URL', 'config', 'https://api.statcan.gc.ca is the base URL', 'Statistics Canada API base URL.', { integrationOptional: true }),
    member('statcan', 'STATCAN_API_KEY', 'secret', 'requests to Statistics Canada carry no key and its public tier applies', 'Statistics Canada API key.', { integrationOptional: true }),
    member('clc-api', 'CLC_API_URL', 'config', 'smart onboarding skips the CLC lookup', 'Canadian Labour Congress API URL (smart onboarding lookup).'),
    member('clc-api', 'CLC_API_KEY', 'secret', 'smart onboarding skips the CLC lookup', 'Canadian Labour Congress API key (smart onboarding lookup).'),
    member('docusign', 'DOCUSIGN_API_KEY', 'secret', 'the DocuSign signature provider is not registered', 'DocuSign integration key.'),
    member('docusign', 'DOCUSIGN_API_ACCOUNT_ID', 'config', 'the DocuSign signature provider is not registered', 'DocuSign API account id.'),
    member('docusign', 'DOCUSIGN_ACCOUNT_ID', 'config', 'DOCUSIGN_API_ACCOUNT_ID is used', 'Legacy spelling of DOCUSIGN_API_ACCOUNT_ID.', { integrationOptional: true }),
    member('docusign', 'DOCUSIGN_ENVIRONMENT', 'config', 'the DocuSign sandbox/production selection falls to the provider default', 'DocuSign environment: sandbox or production.', { integrationOptional: true }),
    member('hellosign', 'HELLOSIGN_API_KEY', 'secret', 'the HelloSign signature provider is not registered', 'HelloSign (Dropbox Sign) API key.'),
    member('linkedin', 'LINKEDIN_CLIENT_ID', 'config', 'the LinkedIn publishing integration is not configured', 'LinkedIn OAuth client id.'),
    member('linkedin', 'LINKEDIN_CLIENT_SECRET', 'secret', 'the LinkedIn publishing integration is not configured', 'LinkedIn OAuth client secret.'),
    member('meta', 'META_APP_ID', 'config', 'the Meta (Facebook, Instagram) publishing integration is not configured', 'Meta app id.'),
    member('meta', 'META_APP_SECRET', 'secret', 'the Meta (Facebook, Instagram) publishing integration is not configured', 'Meta app secret.'),
    member('twitter', 'TWITTER_CLIENT_ID', 'config', 'the Twitter (X) publishing integration is not configured', 'Twitter (X) OAuth client id.'),
    member('twitter', 'TWITTER_CLIENT_SECRET', 'secret', 'the Twitter (X) publishing integration is not configured', 'Twitter (X) OAuth client secret.'),
  ]),
  ...section('observability', 'observability', [
    { name: 'REDIS_URL', kind: 'secret', required: 'production', capability: 'rate-limiting', whenMissing: 'degraded:the rate limiter has no shared store and applies its fail-closed/fail-open policy per request; readiness reports Redis as not configured', provisionedBy: bicep('redis-url'), description: 'Redis connection string of the shared rate-limit and cache store.' },
    { name: 'UPSTASH_REDIS_REST_URL', kind: 'config', required: 'optional', capability: 'rate-limiting', whenMissing: 'default:unset; REDIS_URL is the store', provisionedBy: OPTIONAL_INTEGRATION, integration: 'upstash-redis', description: 'Upstash Redis REST URL: the store the rate limiter prefers when both it and its token are set.' },
        { name: 'UPSTASH_REDIS_REST_TOKEN', kind: 'secret', required: 'optional', capability: 'rate-limiting', whenMissing: 'degraded:unset; REDIS_URL is the store', provisionedBy: OPTIONAL_INTEGRATION, integration: 'upstash-redis', description: 'Upstash Redis REST token.' },
    knob('RATE_LIMIT_STORE_TIMEOUT_MS', '2000 ms before a rate-limit store call is abandoned and the failure policy applies', 'Milliseconds a rate-limit check waits on the store.', '2000'),
    knob('CACHE_KEY_PREFIX', 'unioneyes, the Redis key prefix of the cache', 'Key prefix of the Redis cache.', 'unioneyes'),
    knob('CACHE_DEFAULT_TTL', '300 seconds', 'Default cache lifetime in seconds.', '300'),
    knob('CACHE_WARMUP_ENABLED', 'false; the cache is not warmed at start', 'true warms the cache at start.', 'false'),
    knob('ANALYTICS_RETENTION_DAYS', '30 days of analytics performance data', 'Days of analytics performance data kept.', '30'),
    { name: 'SENTRY_DSN', kind: 'config', required: 'optional', whenMissing: 'degraded:server-side error reporting to Sentry is off',     provisionedBy: operator('set on the container revision by the operator that owns the Sentry project'), description: 'Sentry DSN for the server and edge runtimes.' },
        { name: 'NEXT_PUBLIC_SENTRY_DSN', kind: 'config', required: 'optional', whenMissing: 'degraded:browser error reporting to Sentry is off (and the server DSN is used where one is set)', provisionedBy: operator('a build argument or container value set by the operator that owns the Sentry project'), description: 'Sentry DSN for the browser (build time).' },
    { name: 'NEXT_PUBLIC_SENTRY_ENABLED', kind: 'flag', required: 'optional', whenMissing: 'default:true; browser reporting is on whenever a DSN is set', provisionedBy: notNeeded('a switch with a safe default'), description: 'false turns browser error reporting off (build time).', example: 'true' },
    { name: 'NEXT_PUBLIC_SENTRY_ENABLE_ON_DEMO', kind: 'flag', required: 'optional', whenMissing: 'default:false; browser reporting stays off on demo hosts', provisionedBy: notNeeded('a switch with a safe default'), description: 'true lets browser error reporting run on demo hosts (build time).', example: 'false' },
    { name: 'OTEL_EXPORTER_OTLP_ENDPOINT', kind: 'config', required: 'optional', whenMissing: 'degraded:traces and metrics are not exported', provisionedBy: operator('set to the OpenTelemetry collector of the environment'), description: 'OTLP endpoint of the OpenTelemetry collector.' },
    knob('LOG_LEVEL', 'info; debug only when LOG_LEVEL=debug', 'debug turns on debug logging in the platform telemetry logger.', 'info'),
    { name: 'APP_VERSION', kind: 'config', required: 'optional', whenMissing: 'default:the release id or commit the build came from, else "unknown"; a display label of the status page only', provisionedBy: notNeeded('a display label on the status page'), description: 'Version label shown by the status page.' },
    { name: 'READY_REQUIRE_QUEUE', kind: 'flag', required: 'optional', whenMissing: 'default:false; /api/ready does not wait for the Django job backend', provisionedBy: workflow, configuresCheckIn: 'app/api/ready/route.ts', description: 'true makes /api/ready require the Django job backend to be ready.', example: 'false' },
    { name: 'READY_REQUIRE_STORAGE', kind: 'flag', required: 'optional', whenMissing: 'default:false; /api/ready does not wait for the document container', provisionedBy: notNeeded('a readiness switch an operator turns on for an environment that depends on document storage'), configuresCheckIn: 'app/api/ready/route.ts', description: 'true makes /api/ready require the Azure Blob document container to exist.', example: 'false' },
    { name: 'READY_REQUIRE_EMAIL_DELIVERY', kind: 'flag', required: 'optional', whenMissing: 'default:false; /api/ready does not check the email provider configuration', provisionedBy: workflow, configuresCheckIn: 'app/api/ready/route.ts', description: 'true makes /api/ready require the email provider (EMAIL_PROVIDER and its key and sender) to be configured.', example: 'false' },
    { name: 'READY_REQUIRE_CALENDAR_INTEGRATIONS', kind: 'flag', required: 'optional', whenMissing: 'default:false; /api/ready does not check the calendar integrations', provisionedBy: notNeeded('a readiness switch an operator turns on for an environment that depends on calendar sync'), configuresCheckIn: 'app/api/ready/route.ts', description: 'true makes /api/ready require both the Google and the Microsoft calendar client settings.', example: 'false' },
    { name: 'READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION', kind: 'flag', required: 'optional', whenMissing: 'default:false; /api/ready does not check the calendar token key', provisionedBy: notNeeded('a readiness switch an operator turns on for an environment that depends on calendar sync'), configuresCheckIn: 'app/api/ready/route.ts', description: 'true makes /api/ready require the calendar token encryption key.', example: 'false' },
    { name: 'UE_FRONTEND_IMAGE_DIGEST', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'degraded:/api/version reports frontendImageDigest as null and the deployment gate cannot match the running image', provisionedBy: workflow, description: 'Digest of the running frontend image, reported by /api/version.' },
    { name: 'UE_BACKEND_IMAGE_DIGEST', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'degraded:/api/version reports backendImageDigest as null and the deployment gate cannot match the running backend', provisionedBy: workflow, description: 'Digest of the running backend image, reported by /api/version.' },
    { name: 'DJANGO_API_URL', kind: 'config', required: 'optional', capability: 'django-backend', whenMissing: 'degraded:the Django backend is reported as not configured, and routes that proxy to it answer 503', provisionedBy: workflow, description: 'Internal URL of the Django backend (server side).' },
    { name: 'NEXT_PUBLIC_DJANGO_API_URL', kind: 'config', required: 'optional', capability: 'django-backend', whenMissing: 'default:unset; DJANGO_API_URL is the one used', provisionedBy: workflow, description: 'Public (build-time) URL of the Django backend; the server falls back to it when DJANGO_API_URL is unset.' },
  ]),
  ...section('intake', 'public-intake', [
    { name: 'TURNSTILE_SECRET_KEY', kind: 'secret', required: 'production', minLength: 16, whenMissing: 'fail-closed', provisionedBy: bicep('turnstile-secret-key'), description: 'Cloudflare Turnstile secret that verifies the bot challenge of the public intake and ICRA forms. Unset in a deployed environment, every challenge fails and the forms answer 503.' },
        { name: 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', kind: 'config', required: 'production', whenMissing: 'fail-closed', provisionedBy: dockerfile, description: 'Cloudflare Turnstile site key rendered by the public forms (build argument). Unset, the widget is not rendered and the forms cannot be submitted.' },
    knob('TRUSTED_PROXY_HOPS', '1 trusted proxy hop when reading the client address of a public intake request', 'Number of trusted reverse-proxy hops in front of the app (public intake client address).', '1'),
    knob('UE_TRUSTED_PROXY_HOPS', '1 trusted proxy hop when recording a signer network address', 'Number of trusted reverse-proxy hops in front of the app (e-signature signer address).', '1'),
    knob('OCI_PUBLIC_SECTOR_MODE', 'off; the ICRA scoring uses the private-sector weighting', 'Switches the ICRA scoring to the public-sector weighting.'),
  ]),
  ...section('compliance', 'compliance', [
    { name: 'UE_LOCATION_CONSENT_NOTICE_VERSION', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies its adopted notice; no default legal text is invented'), description: 'Version label (at most 10 characters) of the institution-adopted location-consent notice. Unset, location consent cannot be granted.' },
    { name: 'UE_LOCATION_CONSENT_NOTICE_TEXT', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies its adopted notice; no default legal text is invented'), description: 'Exact member-facing text (at most 4000 characters) of the location-consent notice. Unset, location consent cannot be granted.' },
    { name: 'UE_VOICE_DISCLOSURE_NOTICE_VERSION', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies its approved disclosure; no default legal text is invented'), description: 'Version label of the approved voice-processing disclosure. Unset, voice upload answers 503.' },
    { name: 'UE_VOICE_DISCLOSURE_NOTICE_EN_CA', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies its approved disclosure; no default legal text is invented'), description: 'English (Canada) text of the approved voice-processing disclosure. Unset, voice upload answers 503.' },
    { name: 'UE_VOICE_DISCLOSURE_NOTICE_FR_CA', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies its approved disclosure; no default legal text is invented'), description: 'French (Canada) text of the approved voice-processing disclosure. Unset, voice upload answers 503.' },
    { name: 'UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE', kind: 'config', required: 'optional', whenMissing: 'fail-closed', provisionedBy: operator('the institution supplies the reference of its approval'), description: 'Reference of the institutional approval of the voice-processing disclosure. Unset, voice upload answers 503.' },
  ]),
  ...section('integrations', 'integrations', [
    member('workday', 'WORKDAY_CLIENT_ID', 'config', 'the Workday integration reports unavailable and lists what is missing', 'Workday OAuth client id.'),
    member('workday', 'WORKDAY_CLIENT_SECRET', 'secret', 'the Workday integration reports unavailable and lists what is missing', 'Workday OAuth client secret.'),
    member('workday', 'WORKDAY_TENANT_ID', 'config', 'the Workday integration reports unavailable and lists what is missing', 'Workday tenant id.'),
    member('bamboohr', 'BAMBOOHR_API_KEY', 'secret', 'the BambooHR integration reports unavailable and lists what is missing', 'BambooHR API key.'),
    member('bamboohr', 'BAMBOOHR_SUBDOMAIN', 'config', 'the BambooHR integration reports unavailable and lists what is missing', 'BambooHR company subdomain.'),
    member('adp', 'ADP_CLIENT_ID', 'config', 'the ADP integration reports unavailable and lists what is missing', 'ADP client id.'),
    member('adp', 'ADP_CLIENT_SECRET', 'secret', 'the ADP integration reports unavailable and lists what is missing', 'ADP client secret.'),
    member('quickbooks', 'QUICKBOOKS_CLIENT_ID', 'config', 'the QuickBooks integration reports unavailable and lists what is missing', 'QuickBooks OAuth client id.'),
    member('quickbooks', 'QUICKBOOKS_CLIENT_SECRET', 'secret', 'the QuickBooks integration reports unavailable and lists what is missing', 'QuickBooks OAuth client secret.'),
    member('xero', 'XERO_CLIENT_ID', 'config', 'the Xero integration reports unavailable and lists what is missing', 'Xero OAuth client id.'),
    member('xero', 'XERO_CLIENT_SECRET', 'secret', 'the Xero integration reports unavailable and lists what is missing', 'Xero OAuth client secret.'),
    member('sunlife', 'SUNLIFE_API_KEY', 'secret', 'the Sun Life integration reports unavailable and lists what is missing', 'Sun Life API key.'),
    member('sunlife', 'SUNLIFE_API_SECRET', 'secret', 'the Sun Life integration reports unavailable and lists what is missing', 'Sun Life API secret.'),
    member('manulife', 'MANULIFE_CLIENT_ID', 'config', 'the Manulife integration reports unavailable and lists what is missing', 'Manulife client id.'),
    member('manulife', 'MANULIFE_CLIENT_SECRET', 'secret', 'the Manulife integration reports unavailable and lists what is missing', 'Manulife client secret.'),
    member('otpp', 'OTPP_API_KEY', 'secret', 'the OTPP integration reports unavailable and lists what is missing', 'Ontario Teachers pension plan API key.'),
    member('slack', 'SLACK_CLIENT_ID', 'config', 'the Slack integration reports unavailable and lists what is missing', 'Slack OAuth client id.'),
    member('slack', 'SLACK_CLIENT_SECRET', 'secret', 'the Slack integration reports unavailable and lists what is missing', 'Slack OAuth client secret.'),
    member('msteams', 'MSTEAMS_CLIENT_ID', 'config', 'the Microsoft Teams integration reports unavailable and lists what is missing', 'Microsoft Teams app client id.'),
    member('msteams', 'MSTEAMS_CLIENT_SECRET', 'secret', 'the Microsoft Teams integration reports unavailable and lists what is missing', 'Microsoft Teams app client secret.'),
    member('msteams', 'MSTEAMS_TENANT_ID', 'config', 'the Microsoft Teams integration reports unavailable and lists what is missing', 'Microsoft Teams directory (tenant) id.'),
  ]),
  ...section('django', 'django-backend', [
    { name: 'DJANGO_SECRET_KEY', kind: 'secret', required: 'production', minLength: 50, runtime: 'django', whenMissing: 'fail-closed', provisionedBy: operator('a Container App secret on the django-backend container, set by hand: the deploy workflow does not set it'), description: 'Django SECRET_KEY: at least 50 characters, not a placeholder. A serving Django process (gunicorn, celery) refuses to start without it.' },
    { name: 'REQUEST_SIGNING_SECRET', kind: 'secret', required: 'production', minLength: 32, runtime: 'django', whenMissing: 'fail-closed', provisionedBy: operator('a Container App secret on the django-backend container, set by hand: the deploy workflow does not set it'), description: 'HMAC secret of the signed-request middleware: its own value, never derived from DJANGO_SECRET_KEY. A serving Django process refuses to start without it.' },
    { name: 'WEBHOOK_DEFAULT_SECRET', kind: 'secret', required: 'production', minLength: 32, runtime: 'django', whenMissing: 'fail-closed', provisionedBy: operator('a Container App secret on the django-backend container, set by hand: the deploy workflow does not set it'), description: 'Default HMAC secret of outbound webhooks: its own value, never derived from DJANGO_SECRET_KEY. A serving Django process refuses to start without it.' },
    { name: 'DJANGO_DEBUG', kind: 'flag', required: 'dev-only', runtime: 'django', whenMissing: 'default:false, Django debug mode is off', provisionedBy: notNeeded('development only: Django refuses debug mode while it serves a non-local host'), productionProof: 'backend/config/test_settings_hardening.py', description: 'Development only: Django debug mode. Refused when DJANGO_ALLOWED_HOSTS names a non-local host.', example: 'false' },
    { name: 'DJANGO_ALLOWED_HOSTS', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'Comma-separated host names Django serves. Unset, only localhost is accepted and every real host is refused with 400.' },
    { name: 'PGHOST', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'PostgreSQL host of the Django backend. A serving Django process refuses to start without it.' },
    { name: 'PGUSER', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'PostgreSQL role of the Django backend (the least-privilege runtime role, never postgres).' },
    { name: 'PGPASSWORD', kind: 'secret', required: 'production', minLength: 12, runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'Password of the PostgreSQL role of the Django backend. A serving Django process refuses to start without it.' },
    { name: 'PGDATABASE', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:nzila_union_eyes, the database name of the platform', provisionedBy: workflow, description: 'PostgreSQL database of the Django backend.', example: 'nzila_union_eyes' },
    { name: 'PGPORT', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:5432, the PostgreSQL port', provisionedBy: workflow, description: 'PostgreSQL port of the Django backend.', example: '5432' },
    { name: 'AUTH_JWKS_URL', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'JWKS endpoint of the Entra tenant Django verifies bearer tokens against. Unset, no token verifies and every authenticated call is refused.' },
    { name: 'AUTH_ISSUER', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: operator('an environment value on the django-backend container, set by hand: the deploy workflow does not set it'), description: 'Token issuer Django requires (the Entra tenant issuer URL).' },
    { name: 'AUTH_AUDIENCE', kind: 'config', required: 'production', runtime: 'django', whenMissing: 'fail-closed', provisionedBy: operator('an environment value on the django-backend container, set by hand: the deploy workflow does not set it'), description: 'Token audience Django requires (the application client id).' },
    { name: 'AUTH_PROVIDER_NAMESPACE', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:entra, the namespace of Entra identities', provisionedBy: notNeeded('the namespace of the one identity provider in use'), description: 'Namespace prefixed to external identity ids in Django.', example: 'entra' },
    { name: 'AUTH_WEBHOOK_SECRET', kind: 'secret', required: 'optional', minLength: 16, runtime: 'django', whenMissing: 'fail-closed', provisionedBy: workflow, description: 'Signing secret of the inbound identity webhook. Unset, Django refuses every webhook call.' },
    knob('CONN_MAX_AGE', '600 seconds of persistent database connection reuse', 'Seconds Django keeps a database connection open (PgBouncer pools the rest).', '600'),
    knob('CELERY_BROKER_URL', 'the Redis database 0 of REDIS_URL', 'Celery broker URL.'),
    knob('CELERY_RESULT_BACKEND', 'django-db, results stored in the Django database', 'Celery result backend.', 'django-db'),
    { name: 'REPORTS_DIR', kind: 'config', required: 'optional', whenMissing: 'degraded:Django writes reports to /tmp/reports, and the GDPR data-export download answers "REPORTS_DIR is not configured"', provisionedBy: notNeeded('a scratch directory of the report tasks; the container filesystem is its default'), description: 'Directory the report tasks write to and the GDPR export download reads from.' },
    knob('TEMP_DIR', '/tmp/ue_temp, the scratch directory the cleanup task sweeps', 'Scratch directory of the Django cleanup task.'),
    { name: 'JURISDICTION_POLICIES_PATH', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:the policy files shipped with the backend', provisionedBy: notNeeded('the shipped jurisdiction policies are the default'), description: 'Directory of jurisdiction policy files that replaces the shipped ones.' },
    { name: 'UE_V2_PROCESS_CONTEXT', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:web; canonical V2 accepts only web or worker', provisionedBy: notNeeded('selects the web or the worker role of the canonical V2 process'), description: 'Canonical V2 process role of Django: web or worker.', example: 'web' },
    { name: 'UE_DJANGO_TEST_TEMPLATE', kind: 'config', required: 'test-only', runtime: 'django', whenMissing: 'default:unset; the Django suite runs migrations', provisionedBy: notNeeded('tests only'), description: 'Tests only: a converged database the Django suite clones instead of migrating.' },
  ]),
  ...section('dev', 'development', [
    { name: 'QA_TEST_ENV', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; no test behaviour is switched on', provisionedBy: notNeeded('development and acceptance machines only: refused on any deployed runtime'), productionProof: 'packages/platform-auth/src/password/auth-service.test.ts', description: 'Development only: enables the QA behaviours (detailed errors, the pilot flag). Refused on any deployed runtime.' },
    { name: 'PLAYWRIGHT_TEST_AUTH', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; the seeded test session is refused', provisionedBy: notNeeded('local test runs only: the seeded session also needs QA_TEST_ENV=true, UE_ENVIRONMENT=local and no production signal'), productionProof: 'packages/platform-auth/src/password/auth-service.test.ts', description: 'Development only: lets the Playwright suite sign in with a seeded session. Ignored on any deployed runtime.' },
    { name: 'UE_E2E_RISK_BYPASS', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; sign-in risk assessment applies', provisionedBy: notNeeded('local test runs only: ignored on any production deployment'), productionProof: 'packages/platform-auth/src/risk/assess.test.ts', description: 'Development only: skips the sign-in risk assessment for end-to-end tests.' },
    { name: 'STAGING_SEED_ORG_ID', kind: 'config', required: 'dev-only', whenMissing: 'default:the demo staging organization id of the seed script', provisionedBy: notNeeded('read only by the staging seed, which refuses every production environment'), productionProof: 'lib/__tests__/stagingSeed.test.ts', description: 'Development only: organization the staging seed populates.' },
    { name: 'STAGING_PROOFS_ENABLED', kind: 'flag', required: 'staging', whenMissing: 'fail-closed', provisionedBy: operator('set on the staging revision by the operator who runs a staging proof; no workflow does'), productionProof: 'lib/staging-proof/__tests__/deadline-engine-auth.test.ts', description: 'Staging only: opens the staging proof routes; unset, they refuse. Refused on any production identity.' },
    { name: 'STAGING_PROOF_SECRET', kind: 'secret', required: 'staging', minLength: 32, whenMissing: 'fail-closed', provisionedBy: operator('set on the staging revision by the operator who runs a staging proof; no workflow does'), productionProof: 'lib/staging-proof/__tests__/deadline-engine-auth.test.ts', description: 'Staging only: shared secret of the staging proof routes (at least 32 characters). Refused on any production identity.' },
    { name: 'UNION_EYES_RUNTIME_ID', kind: 'config', required: 'staging', whenMissing: 'fail-closed', provisionedBy: operator('set on the staging revision by the operator who runs a staging proof; no workflow does'), productionProof: 'lib/staging-proof/__tests__/deadline-engine-auth.test.ts', description: 'Staging only: runtime identifier the staging proof binds to; unset, the proof refuses.' },
    { name: 'SKIP_DB_STARTUP_CHECK', kind: 'flag', required: 'dev-only', whenMissing: 'default:unset; startup verifies the database connection', provisionedBy: notNeeded('development only: ignored on any deployed runtime'), productionProof: 'lib/runtime/__tests__/startup-checks.test.ts', description: 'Development only: skip the database check at server start. Ignored on any deployed runtime.' },
    { name: 'CI', kind: 'flag', required: 'test-only', capability: 'development', whenMissing: 'default:unset, the connection pool and timeouts are the local ones', provisionedBy: notNeeded('set by the CI provider, never by a deployment'), description: 'Set by CI providers; shrinks the connection pool and relaxes test timeouts.' },
    { name: 'VITEST', kind: 'flag', required: 'test-only', capability: 'development', whenMissing: 'default:unset, the production connection pool applies', provisionedBy: notNeeded('set by the test runner, never by a deployment'), description: 'Set by Vitest; selects the test connection pool.' },
    { name: 'PLAYWRIGHT_BASE_URL', kind: 'config', required: 'test-only', capability: 'development', whenMissing: 'default:http://localhost:3002, the local dev server', provisionedBy: notNeeded('read by the Playwright runtime configuration only'), description: 'Tests only: URL the Playwright runtime suite targets.' },
    { name: 'UE_RUNTIME_ARTIFACTS', kind: 'config', required: 'test-only', capability: 'development', whenMissing: 'default:test-results/runtime', provisionedBy: notNeeded('read by the Playwright runtime configuration only'), description: 'Tests only: output directory of the Playwright runtime suite.' },
    { name: 'UE_RUNTIME_REPORT', kind: 'config', required: 'test-only', capability: 'development', whenMissing: 'default:test-results/runtime-report.json', provisionedBy: notNeeded('read by the Playwright runtime configuration only'), description: 'Tests only: JSON report file of the Playwright runtime suite.' },
    { name: 'NODE_OPTIONS', kind: 'config', required: 'test-only', capability: 'development', whenMissing: 'default:unset, Node.js default options apply', provisionedBy: notNeeded('read only by the Playwright web-server configuration'), description: 'Node.js options; the Playwright web server adds a larger heap.' },
    { name: 'WHITEPAPER_DOCS_ROOT', kind: 'config', required: 'optional', capability: 'compliance', whenMissing: 'degraded:the whitepaper download answers that its source documents are not configured', provisionedBy: notNeeded('the whitepaper source folder of the repository checkout'), description: 'Directory of the whitepaper source documents.' },
  ]),
  ...section('build', 'build', [
    { name: 'NEXT_PHASE', kind: 'config', required: 'optional', whenMissing: 'default:unset; the server runs', provisionedBy: platform('Next.js sets it during next build'), description: 'Set by Next.js; boot checks skip the build phase.' },
    { name: 'NEXT_RUNTIME', kind: 'config', required: 'optional', whenMissing: 'default:unset, no runtime-specific module is loaded', provisionedBy: platform('Next.js sets it per runtime (nodejs or edge)'), description: 'Set by Next.js: the runtime a module executes in.' },
    { name: 'BUILD_ID', kind: 'config', required: 'optional', whenMissing: 'default:a timestamp (Next.js build id)', provisionedBy: notNeeded('a per-build identifier with a safe default'), description: 'Next.js build id.' },
    { name: 'ANALYZE', kind: 'flag', required: 'optional', whenMissing: 'default:unset; the bundle analyzer is off', provisionedBy: notNeeded('a build-time diagnostic'), description: 'true runs the bundle analyzer during the build.' },
    { name: 'BUILD_TIME', kind: 'config', required: 'optional', whenMissing: 'default:unknown (build metadata on /api/health and /api/ready)', provisionedBy: [workflow, dockerfile], description: 'Build timestamp reported in build metadata.' },
    { name: 'BUILD_TIMESTAMP', kind: 'config', required: 'optional', whenMissing: 'default:unknown; BUILD_TIME is preferred', provisionedBy: notNeeded('legacy alias of BUILD_TIME'), description: 'Legacy alias of BUILD_TIME.' },
    { name: 'RELEASE_ID', kind: 'config', required: 'optional', whenMissing: 'default:ARTIFACT_ID, then unknown (build metadata)', provisionedBy: [workflow, dockerfile], description: 'Release identifier reported in build metadata.' },
    { name: 'ARTIFACT_ID', kind: 'config', required: 'optional', whenMissing: 'default:unknown (build metadata)', provisionedBy: [workflow, dockerfile], description: 'Image artifact identifier reported in build metadata.' },
    { name: 'GITHUB_SHA', kind: 'config', required: 'optional', whenMissing: 'default:the next commit variable, then unknown (build metadata)', provisionedBy: [workflow, dockerfile], description: 'Commit the build was made from.' },
    { name: 'VERCEL_GIT_COMMIT_SHA', kind: 'config', required: 'optional', whenMissing: 'default:the next commit variable, then unknown (build metadata)', provisionedBy: notNeeded('a Vercel build variable this stack does not use; GITHUB_SHA is the source'), description: 'Commit variable of a Vercel build; build metadata only.' },
    { name: 'VERCEL_ENV', kind: 'config', required: 'optional', whenMissing: 'default:unset, it adds no production signal to the NAR local-sandbox gate', provisionedBy: notNeeded('read only as one more production signal by the NAR local-sandbox gate'), description: 'Vercel environment; read only as a production signal by the NAR local-sandbox gate.' },
    { name: 'APP_ENV', kind: 'config', required: 'optional', whenMissing: 'default:the next environment variable, then unknown (build metadata)', provisionedBy: notNeeded('a label in build metadata; UE_ENVIRONMENT is the identity'), description: 'Environment label in build metadata.' },
    { name: 'npm_package_version', kind: 'config', required: 'optional', whenMissing: 'default:unknown (NAR system version)', provisionedBy: platform('npm and pnpm set it from package.json when a script runs'), description: 'Package version npm sets; recorded as the NAR system version.' },
    { name: 'HOSTNAME', kind: 'config', required: 'optional', whenMissing: 'default:a generated worker name (deadline-worker-<run>)', provisionedBy: platform('the container runtime sets it'), description: 'Container host name; names the deadline worker instance.' },
    { name: 'PORT', kind: 'config', required: 'optional', whenMissing: 'default:3000, the port the Next.js server listens on', provisionedBy: [bicep(), workflow], externalConsumer: 'the Next.js standalone server reads it to pick its listening port', description: 'Port the server listens on; the container ingress targets 3000.', example: '3000' },
    { name: 'AZURE_CLIENT_ID', kind: 'config', required: 'optional', whenMissing: 'degraded:the Azure credential chain cannot select the user-assigned managed identity, so Key Vault and storage authentication can fail', provisionedBy: bicep(), externalConsumer: '@azure/identity (DefaultAzureCredential) selects the user-assigned managed identity with it', description: 'Client id of the user-assigned managed identity of the container app.' },
    { name: 'PGSSLMODE', kind: 'config', required: 'optional', runtime: 'django', whenMissing: 'default:prefer, the libpq default; the deploy workflow sets require for Azure PostgreSQL', provisionedBy: workflow, externalConsumer: 'libpq (psycopg2) in the Django backend reads it', description: 'PostgreSQL SSL mode of the Django backend.', example: 'require' },
    { name: 'TURBO_FILTER', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'default:the Dockerfile builds every app of the monorepo', provisionedBy: workflow, externalConsumer: 'the Dockerfile build stage passes it to turbo build', description: 'Build argument: which apps the image build compiles.' },
    { name: 'BUILD_AUTH_PLACEHOLDER', kind: 'config', required: 'optional', capability: 'build', whenMissing: 'default:a build-only placeholder AUTH_SECRET so next build can import the auth module; never written into the image environment', provisionedBy: [dockerfile, workflow], externalConsumer: 'the Dockerfile build stage sets AUTH_SECRET from it for the build command only', description: 'Build argument: placeholder secret used while compiling.' },
  ]),
  // @@ENTRIES@@
]

export const ENV_REGISTRY: readonly EnvEntry[] = ENTRIES

export const ENV_PATTERNS: readonly EnvPattern[] = [
  {
    file: 'lib/integrations/registry.ts',
    key: 'envVar',
    produces: 'every name in the requiredEnvVars of a registered integration (WORKDAY_*, BAMBOOHR_*, ADP_*, QUICKBOOKS_*, XERO_*, SUNLIFE_*, MANULIFE_*, OTPP_*, SLACK_*, MSTEAMS_*, LINKEDIN_*)',
    capability: 'integrations',
    whenMissing: 'degraded:the integration reports unavailable and lists the missing names',
    description: 'checkEnvironmentVars() looks up each declared requiredEnvVars name; the names themselves are declared (and registered here) where the integrations are registered.',
  },
  {
    file: 'lib/services/feature-flags-service.ts',
    key: "`FEATURE_${flagName.toUpperCase().replace(/-/g, '_')}`",
    produces: 'FEATURE_<FLAG_NAME>: an environment value of a feature flag, read only when the flag store fails',
    capability: 'feature-flags',
    whenMissing: 'default:false; a flag the store cannot answer is off',
    description: 'Fail-safe fallback of the feature-flag service: FEATURE_<NAME> is read only when the database flag store errors. FEATURE_CASE_INTELLIGENCE_V1_* are read directly elsewhere and registered by name.',
  },
  {
    file: 'packages/os-core/src/secrets/keyvault.ts',
    key: "name.toUpperCase().replace(/-/g, '_')",
    produces: 'the upper-snake-case name of a secret requested through getSecret() (nar-signing-secret gives NAR_SIGNING_SECRET)',
    capability: 'encryption',
    whenMissing: 'fail-closed',
    description: 'getSecret() reads a secret from Key Vault when KEY_VAULT_URI is set, and otherwise from the environment under its upper-snake-case name; every secret it is asked for is registered by that name.',
  },
  // @@PATTERNS@@
]

const BY_NAME = new Map(ENV_REGISTRY.map((entry) => [entry.name, entry]))

export function getEnvEntry(name: string): EnvEntry | undefined {
  return BY_NAME.get(name)
}

export const provisionsOf = (entry: EnvEntry): readonly Provision[] => (Array.isArray(entry.provisionedBy) ? entry.provisionedBy : [entry.provisionedBy as Provision])
