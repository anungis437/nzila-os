/**
 * Idempotency-Key enforcement middleware for Express.
 *
 * Requires an Idempotency-Key header on all mutating requests
 * (POST, PUT, PATCH, DELETE) to /api/* endpoints.
 * Exempts webhook and health endpoints.
 */
import type { Request, Response, NextFunction } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const EXEMPT_PREFIXES = [
  '/api/payments/webhook',
  '/api/donations/webhooks',
  '/health',
  '/api/health',
];

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  // Exempt webhook and health endpoints
  const path = req.originalUrl || req.path;
  if (EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix))) {
    next();
    return;
  }

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: 'Missing Idempotency-Key header',
      message: 'All mutation requests (POST, PUT, PATCH, DELETE) must include an Idempotency-Key header.',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
    return;
  }

  next();
}
