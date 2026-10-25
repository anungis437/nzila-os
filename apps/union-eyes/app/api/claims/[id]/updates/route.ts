/**
 * Retired. This route was a generic table CRUD handler over the case record under a name that implied a workflow it never
 * had; it performed no governed operation. Case work is decided by the authority kernel through the dedicated case routes (/api/cases/{caseId}/notes).
 */
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

export const GET = retiredHandler("/api/cases/{caseId}/notes")
export const PATCH = retiredHandler("/api/cases/{caseId}/notes")
export const DELETE = retiredHandler("/api/cases/{caseId}/notes")
