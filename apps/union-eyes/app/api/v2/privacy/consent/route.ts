import { NextResponse } from 'next/server';
/**
 * GET POST DELETE /api/privacy/consent
 * Migrated to withApi() framework
 */
import { ProvincialPrivacyService, type Province } from "@/services/provincial-privacy-service";
 
 
 
 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const consentSchema = z.object({
  province: z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'], {
    errorMap: () => ({ message: 'Invalid province code' })
  }),
  consentType: z.string().min(1, 'Consent type is required'),
  consentGiven: z.boolean(),
  consentText: z.string().min(10, 'Consent text must be at least 10 characters'),
  consentLanguage: z.enum(['en', 'fr']).default('en'),
  consentMethod: z.enum(['explicit_checkbox', 'opt_in', 'opt_out', 'implicit']).default('explicit_checkbox'),
});

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Privacy'],
      summary: 'GET consent',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        if (!userId) {
          throw ApiError.unauthorized('Authentication required');
        }
        const { searchParams } = new URL(request.url);
        const province = searchParams.get("province") as Province;
        const consentType = searchParams.get("consentType");
        if (!province || !consentType) {
          throw ApiError.badRequest('Missing province or consentType');
        }
        const hasConsent = await ProvincialPrivacyService.hasValidConsent(
          userId,
          province,
          consentType
        );
        return NextResponse.json({ hasConsent });
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    body: consentSchema,
    openapi: {
      tags: ['Privacy'],
      summary: 'POST consent',
    },
  },
  async ({ request, userId, organizationId: _organizationId, user: _user, body, query: _query, params: _params }) => {

        if (!userId) {
          throw ApiError.unauthorized('Authentication required');
        }
        const { province, consentType, consentGiven, consentMethod, consentText, consentLanguage } = body;
        // Get user IP and user agent for audit trail
        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
        const userAgent = request.headers.get("user-agent") || undefined;
        const consent = await ProvincialPrivacyService.recordConsent({
          userId,
          province: province as Province,
          consentType,
          consentGiven,
          consentMethod,
          consentText,
          consentLanguage,
          ipAddress,
          userAgent,
        });
        return { consent,
          message: "Consent recorded successfully" };
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    body: consentSchema,
    openapi: {
      tags: ['Privacy'],
      summary: 'DELETE consent',
    },
  },
  async ({ request: _request, userId, organizationId: _organizationId, user: _user, body, query: _query, params: _params }) => {

        if (!userId) {
          throw ApiError.unauthorized('Unauthorized');
        }
        const { province, consentType } = body;
        if (!province || !consentType) {
          throw ApiError.badRequest('Missing required fields'
        );
        }
        await ProvincialPrivacyService.revokeConsent(
          userId,
          province as Province,
          consentType
        );
        return { message: "Consent revoked successfully" };
  },
);
