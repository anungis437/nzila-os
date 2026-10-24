import { withApiAuth } from '@/lib/api-auth-guard'
import { emergencyNotImplemented } from '@/lib/emergency/not-implemented'

export const dynamic = 'force-dynamic'

/** Capability UE-EMERGENCY-DECLARATION is not implemented; see lib/emergency/not-implemented.ts. */
export const POST = withApiAuth(async () => emergencyNotImplemented())
