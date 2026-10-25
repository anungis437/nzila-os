/**
 * Retired legacy documents endpoint. It authorised by role rank behind LEGACY_DOCUMENT_API_ENABLED, answered 501 by default and
 * carried its own access rules beside the classification-aware repository. The canonical document service is
 * /api/documents/repository; no second authorization implementation is kept alive.
 */
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

export const GET = retiredHandler("/api/documents/repository/{id}")
export const PATCH = retiredHandler("/api/documents/repository/{id}")
export const DELETE = retiredHandler("/api/documents/repository/{id}")
