import { finished } from 'node:stream/promises'
import type { NextFunction, Request, Response } from 'express'
import { AuthOrgBindingError, withBearerOrgBinding } from '@nzila/platform-auth/org-binding'
import { logger } from '@/lib/logger'

export interface FinancialActor {
  readonly id: string
  readonly userId: string
  readonly tenantId: string
  readonly organizationId: string
  readonly role: string
  readonly isSystemAdmin: boolean
}

export interface FinancialRequest extends Request {
  user?: FinancialActor
}

export async function authenticate(
  req: FinancialRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ') || !authorization.slice(7).trim()) {
    res.status(401).json({ success: false, error: 'Bearer authentication required' })
    return
  }
  const selectedOrganization = req.headers['x-organization-id']
  if (selectedOrganization !== undefined && typeof selectedOrganization !== 'string') {
    res.status(400).json({ success: false, error: 'Invalid organization selector' })
    return
  }
  try {
    await withBearerOrgBinding(
      authorization.slice(7),
      { organizationId: selectedOrganization },
      async (binding) => {
        req.user = Object.freeze({
          id: binding.userId,
          userId: binding.userId,
          tenantId: binding.organizationId,
          organizationId: binding.organizationId,
          role: binding.role,
          isSystemAdmin: binding.isSystemAdmin === true,
        })
        // A provider bridge must remain live until asynchronous Express handlers finish.
        const responseFinished = finished(res, { cleanup: true })
        next()
        await responseFinished
      },
    )
  } catch (error) {
    if (res.headersSent) {
      logger.error('Financial authenticated request failed after response started', { error })
      next(error)
      return
    }
    if (error instanceof AuthOrgBindingError) {
      const status = ['UNAUTHENTICATED', 'SESSION_AUTHORITY_REQUIRED'].includes(error.code)
        ? 401
        : 403
      logger.warn('Financial authentication denied', { reason: error.code })
      res.status(status).json({ success: false, error: error.code })
      return
    }
    logger.error('Financial authentication authority unavailable', { error })
    res.status(503).json({ success: false, error: 'Authentication authority unavailable' })
  }
}

export function requireFinancialSystemAdministrator(
  req: FinancialRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' })
    return
  }
  if (req.user.isSystemAdmin !== true) {
    res.status(403).json({ success: false, error: 'System administrator authority required' })
    return
  }
  next()
}
