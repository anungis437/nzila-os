/**
 * /api/deadlines/{id}/complete — retired. This was the generic item route of claim_deadlines (read, update any column, delete) under a name that promised an operation it did
 * not perform: a DELETE here deleted the deadline, and nothing called it. This application reads claim deadlines (GET /api/deadlines, /api/deadlines/overdue and
 * /api/deadlines/upcoming); it does not complete one.
 */
import { withApiAuth } from '@/lib/api-auth-guard'
import { retiredHandler } from '@/lib/api/retired-route'

export const dynamic = 'force-dynamic'

const REPLACEMENT = 'GET /api/deadlines, /api/deadlines/overdue and /api/deadlines/upcoming to read claim deadlines; this application does not complete a claim deadline'

export const GET = withApiAuth(retiredHandler(REPLACEMENT))
export const PATCH = withApiAuth(retiredHandler(REPLACEMENT))
export const DELETE = withApiAuth(retiredHandler(REPLACEMENT))
