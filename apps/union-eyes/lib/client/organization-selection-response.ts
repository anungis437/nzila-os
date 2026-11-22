import { z } from 'zod'
import { CANONICAL_ORGANIZATION_AUTHORITY } from '@/lib/auth/organization-authority'

const organization = z.object({ id: z.string(), name: z.string(), slug: z.string() })

export const organizationChoicesResponse = z.object({
  organizationAuthority: z.literal(CANONICAL_ORGANIZATION_AUTHORITY),
  activeOrganizationId: z.string().nullable(),
  memberships: z.array(z.object({ organizationId: z.string() })),
  organizations: z.array(organization),
})

export const organizationSwitchResponse = z.object({
  success: z.literal(true),
  organizationAuthority: z.literal(CANONICAL_ORGANIZATION_AUTHORITY),
  activeOrganizationId: z.string(),
  organization: z.object({ id: z.string() }),
})
