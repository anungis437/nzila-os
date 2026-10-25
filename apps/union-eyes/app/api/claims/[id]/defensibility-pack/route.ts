/**
 * Retired. This route was a generic table CRUD handler over the case record under a name that implied a workflow it never
 * had; it performed no governed operation. Case work is decided by the authority kernel through the dedicated case routes.
 */
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

export const GET = retiredHandler("the dedicated case routes under /api/cases/{caseId}")
export const PATCH = retiredHandler("the dedicated case routes under /api/cases/{caseId}")
export const DELETE = retiredHandler("the dedicated case routes under /api/cases/{caseId}")
