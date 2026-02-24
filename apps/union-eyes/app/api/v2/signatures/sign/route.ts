/**
 * POST /api/signatures/sign
 * Migrated to withApi() framework
 */
import { SignatureService } from "@/lib/signature/signature-service";

 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const signatureSchema = z.object({
  signerId: z.string().uuid('Invalid signerId'),
  signatureImageUrl: z.string().url('Invalid signature image URL'),
  signatureType: z.enum(['electronic', 'digital', 'wet'], { 
    errorMap: () => ({ message: 'Invalid signature type' }) 
  }),
  geolocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

export const POST = withApi(
  {
    auth: { required: true },
    body: signatureSchema,
    openapi: {
      tags: ['Signatures'],
      summary: 'POST sign',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query, params: _params }) => {

        // Get IP and user agent
        const { signerId, signatureImageUrl, signatureType, geolocation } = body;
        const ipAddress = request.headers.get("x-forwarded-for") || 
                          request.headers.get("x-real-ip") || 
                          "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        const signer = await SignatureService.recordSignature({
          signerId,
          signatureImageUrl,
          signatureType,
          ipAddress,
          userAgent,
          geolocation,
        });
        return { message: "Signature recorded successfully",
          signer, };
  },
);
