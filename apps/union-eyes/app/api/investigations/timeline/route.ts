/**
 * Retired. This route only forwarded to a generic stub that has itself been retired; it performed no governed operation.
 */
import { withApiAuth } from '@/lib/api-auth-guard'
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

export const GET = withApiAuth(retiredHandler("/api/cases/{caseId}/timeline"))
export const POST = withApiAuth(retiredHandler("/api/cases/{caseId}/timeline"))
