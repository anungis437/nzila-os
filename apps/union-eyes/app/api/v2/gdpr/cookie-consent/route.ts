/**
 * GET POST /api/gdpr/cookie-consent
 * Migrated to withApi() framework
 */
import { CookieConsentManager } from "@/lib/gdpr/consent-manager";

 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const gdprCookieConsentSchema = z.object({
  consentId: z.string().uuid('Invalid consentId'),
  organizationId: z.string().uuid('Invalid organizationId'),
  essential: z.boolean().optional(),
  functional: z.boolean().optional(),
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  userAgent: z.string().optional(),
});

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Gdpr'],
      summary: 'GET cookie-consent',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

        const { searchParams } = new URL(request.url);
        const consentId = searchParams.get("consentId");
        if (!consentId) {
          throw ApiError.internal('Consent ID required'
        );
        }
        const consent = await CookieConsentManager.getCookieConsent(consentId);
        if (!consent) {
          throw ApiError.notFound('Consent not found'
        );
        }
        return consent;
  },
);

export const POST = withApi(
  {
    auth: { required: true },
    body: gdprCookieConsentSchema,
    openapi: {
      tags: ['Gdpr'],
      summary: 'POST cookie-consent',
    },
    successStatus: 201,
  },
  async ({ request, userId: _userId, organizationId, user, body, query: _query }) => {
        const { consentId, essential, functional, analytics, marketing, userAgent } = body;

        // Validate request body
        if (!consentId || !organizationId) {
          throw ApiError.badRequest('Missing required fields'
        );
        }
        // Get IP address from request
        const ipAddress = request.headers.get("x-forwarded-for") || 
                          request.headers.get("x-real-ip") || 
                          "unknown";
        const consent = await CookieConsentManager.saveCookieConsent({
          userId: user?.id,
          organizationId,
          consentId,
          essential: essential ?? true,
          functional: functional ?? false,
          analytics: analytics ?? false,
          marketing: marketing ?? false,
          ipAddress,
          userAgent,
        });
        return consent;
  },
);
