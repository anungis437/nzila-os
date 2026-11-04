import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { logger } from './logger';
/**
 * World-class webhook security
 * 
 * Features:
 * - HMAC signature verification
 * - Replay attack prevention
 * - IP whitelisting
 * - Request logging
 */

export interface WebhookConfig {
  secret: string;
  signatureHeader: string;
  timestampHeader?: string;
  timestampTolerance?: number; // milliseconds
  allowedIPs?: string[];
}

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * Verify HMAC signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): boolean {
  try {
    const expectedSignature = createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (error) {
    logger.error('Signature verification error', error);
    return false;
  }
}

/**
 * Check if webhook request is within time tolerance
 */
export function isWithinTimeTolerance(
  timestamp: number,
  toleranceMs: number = 300000 // 5 minutes default
): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  return diff <= toleranceMs;
}

/**
 * Check if request IP is whitelisted
 */
export function isIPWhitelisted(
  requestIP: string | null,
  allowedIPs: string[]
): boolean {
  if (!requestIP) return false;
  return allowedIPs.includes(requestIP);
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string | null {
  // Check various headers that might contain the real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'fastly-client-ip', // Fastly
    'x-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for might contain multiple IPs
      return value.split(',')[0].trim();
    }
  }

  return null;
}

/**
 * Validate webhook request
 */
export async function validateWebhook(
  request: Request,
  config: WebhookConfig
): Promise<{ valid: true; payload: string } | { valid: false; response: NextResponse }> {
  const startTime = Date.now();

  try {
    // Check IP whitelist if configured
    if (config.allowedIPs && config.allowedIPs.length > 0) {
      const clientIP = getClientIP(request);
      
      if (!isIPWhitelisted(clientIP, config.allowedIPs)) {
        logger.warn('Webhook request from unauthorized IP', {
          clientIP,
          allowedIPs: config.allowedIPs,
        });

        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Forbidden',
              code: 'IP_NOT_WHITELISTED',
            },
            { status: 403 }
          ),
        };
      }
    }

    // Get signature from header
    const signature = request.headers.get(config.signatureHeader);
    
    if (!signature) {
      logger.warn('Missing webhook signature', {
        expectedHeader: config.signatureHeader,
      });

      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Unauthorized',
            code: 'MISSING_SIGNATURE',
          },
          { status: 401 }
        ),
      };
    }

    // Get raw body
    const payload = await request.text();

    // Verify signature
    const signatureValid = verifySignature(payload, signature, config.secret);

    if (!signatureValid) {
      logger.warn('Invalid webhook signature', {
        signatureHeader: config.signatureHeader,
      });

      return {
        valid: false,
        response: NextResponse.json(
          {
            error: 'Unauthorized',
            code: 'INVALID_SIGNATURE',
          },
          { status: 401 }
        ),
      };
    }

    // Check timestamp if configured (replay attack prevention)
    if (config.timestampHeader && config.timestampTolerance) {
      const timestampHeader = request.headers.get(config.timestampHeader);
      
      if (!timestampHeader) {
        logger.warn('Missing webhook timestamp', {
          expectedHeader: config.timestampHeader,
        });

        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Bad Request',
              code: 'MISSING_TIMESTAMP',
            },
            { status: 400 }
          ),
        };
      }

      const timestamp = parseInt(timestampHeader, 10);

      if (isNaN(timestamp)) {
        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Bad Request',
              code: 'INVALID_TIMESTAMP',
            },
            { status: 400 }
          ),
        };
      }

      if (!isWithinTimeTolerance(timestamp, config.timestampTolerance)) {
        logger.warn('Webhook timestamp outside tolerance', {
          timestamp,
          tolerance: config.timestampTolerance,
        });

        return {
          valid: false,
          response: NextResponse.json(
            {
              error: 'Bad Request',
              code: 'TIMESTAMP_EXPIRED',
              message: 'Webhook request is too old or from the future',
            },
            { status: 400 }
          ),
        };
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Webhook validation successful', {
      durationMs: duration,
    });

    return { valid: true, payload };
  } catch (error) {
    logger.error('Webhook validation error', error);

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'Internal Server Error',
          code: 'VALIDATION_ERROR',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Stripe webhook configuration
 */
export const stripeWebhookConfig: WebhookConfig = {
  secret: process.env.STRIPE_WEBHOOK_SECRET || '',
  signatureHeader: 'stripe-signature',
  // Stripe includes timestamp in signature, no separate header needed
};

/**
 * Generic webhook handler wrapper
 */
export function withWebhookValidation(
  handler: (payload: string, request: Request) => Promise<Response>,
  config: WebhookConfig
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const validation = await validateWebhook(request, config);

    if (!validation.valid) {
      return validation.response;
    }

    return handler(validation.payload, request);
  };
}

