import { z } from 'zod'

/**
 * Module / app registry schemas — canonical module registration contracts.
 */

export const MODULE_TIER_VALUES = [
  'PRODUCTION',
  'PILOT',
  'INCUBATING',
  'EXPERIMENTAL',
  'DEPRECATED',
] as const
export type ModuleTier = (typeof MODULE_TIER_VALUES)[number]

export const moduleRegistrationSchema = z.object({
  id: z.string().min(1).regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  basePath: z.string().min(1),
  iconToken: z.string().default('box'),
  tier: z.enum(MODULE_TIER_VALUES),
  enabledByDefault: z.boolean().default(false),
  requiredRoles: z.array(z.string()).default([]),
  requiredEntitlements: z.array(z.string()).default([]),
  featureFlag: z.string().optional(),
  showInNav: z.boolean().default(true),
  navOrder: z.number().int().default(100),
  requiresOrgScope: z.boolean().default(true),
  packageName: z.string().optional(),
  devPort: z.number().int().optional(),
  owner: z.string().optional(),
})
export type ModuleRegistration = z.infer<typeof moduleRegistrationSchema>
