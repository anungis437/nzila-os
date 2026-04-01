/**
 * @nzila/platform-contracts — Module / App Registry Contracts
 *
 * Canonical shape for registering Nzila OS modules (apps).
 * The shell and control-plane use this to render navigation,
 * enforce access, and manage module lifecycle.
 */
import { z } from 'zod'

// ── Module Tier ─────────────────────────────────────────────────────────────

export const moduleTierValues = [
  'PRODUCTION',
  'PILOT',
  'INCUBATING',
  'EXPERIMENTAL',
  'DEPRECATED',
] as const

export type ModuleTier = (typeof moduleTierValues)[number]

// ── Module Registration ─────────────────────────────────────────────────────

export const moduleRegistrationSchema = z.object({
  /** Unique module identifier (e.g. "union-eyes", "cfo", "flow"). */
  id: z.string().min(1).regex(/^[a-z][a-z0-9-]*$/),
  /** Human-readable module name. */
  name: z.string().min(1),
  /** Short description. */
  description: z.string().optional(),
  /** Base route path (e.g. "/union-eyes" or external URL). */
  basePath: z.string().min(1),
  /** Icon token for the shell (e.g. Lucide icon name). */
  iconToken: z.string().default('box'),
  /** Lifecycle tier. */
  tier: z.enum(moduleTierValues),
  /** Whether the module is enabled by default for new orgs. */
  enabledByDefault: z.boolean().default(false),
  /** Required platform roles to access this module (empty = any authenticated). */
  requiredRoles: z.array(z.string()).default([]),
  /** Required entitlement keys (ANDed). */
  requiredEntitlements: z.array(z.string()).default([]),
  /** Feature flag key that controls visibility (if any). */
  featureFlag: z.string().optional(),
  /** Whether to show in shell navigation. */
  showInNav: z.boolean().default(true),
  /** Sort order in navigation. */
  navOrder: z.number().int().default(100),
  /** Whether this module requires an active org scope. */
  requiresOrgScope: z.boolean().default(true),
  /** Package name in the monorepo (e.g. "@nzila/union-eyes"). */
  packageName: z.string().optional(),
  /** Port for local development. */
  devPort: z.number().int().optional(),
  /** Owning team. */
  owner: z.string().optional(),
})

export type ModuleRegistration = z.infer<typeof moduleRegistrationSchema>

// ── Module Manifest (runtime-resolved) ──────────────────────────────────────

export const moduleManifestSchema = moduleRegistrationSchema.extend({
  /** Whether the module is accessible to the current user. */
  accessible: z.boolean(),
  /** Whether the module is enabled for the current org. */
  enabledForOrg: z.boolean(),
  /** Resolved absolute URL. */
  resolvedUrl: z.string().url().optional(),
})

export type ModuleManifest = z.infer<typeof moduleManifestSchema>
