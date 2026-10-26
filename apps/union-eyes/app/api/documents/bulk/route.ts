/**
 * Retired legacy documents endpoint. It authorised by role rank behind LEGACY_DOCUMENT_API_ENABLED, answered 501 by default and
 * carried its own access rules beside the classification-aware repository. The canonical document service is
 * /api/documents/repository; no second authorization implementation is kept alive.
 */
import { withApiAuth } from '@/lib/api-auth-guard'
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

export const POST = withApiAuth(retiredHandler("/api/documents/repository"))
