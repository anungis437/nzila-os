import { withApiAuth } from '@/lib/api-auth-guard'
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

/** Capability UE-EMERGENCY-DECLARATION is not implemented; see lib/emergency/not-implemented.ts. */
export const POST = withApiAuth(retiredHandler('the organization\'s own emergency procedures; this application records no emergency recovery'))
