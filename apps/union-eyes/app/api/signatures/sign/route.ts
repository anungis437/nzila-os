/**
 * Signature Recording API
 * POST /api/signatures/sign - Record signature
 * 
 * GUARDED: requireApiAuth
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from '@/lib/api-auth-guard';
import { SignatureService, SignatureAuthorityError } from "@/lib/signature/signature-service";
import { signerNetworkAddress } from "@/lib/signature/signer-network-address";

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const signatureSchema = z.object({
  signerId: z.guid('Invalid signerId'),
  // The signature is an image the signer drew on this page, carried inline and bounded. A link to an image elsewhere could change after
  // the signature was recorded, so it is not accepted as the signature.
  signatureImageUrl: z.string().max(262_144).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, 'The signature must be an inline PNG or JPEG image'),
  signatureType: z.enum(['electronic', 'digital', 'wet'], { 
    error: 'Invalid signature type' 
  }),
  // Accepted for compatibility and not stored: a position the signer's own browser reports is a claim, not evidence.
  geolocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});
export async function POST(req: NextRequest) {
  try {
    // Authentication guard
    const { userId } = await requireApiAuth();
    if (!userId) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Unauthorized'
      );
    }

    const body = await req.json();
    
    // Validate request body
    const validation = signatureSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const {
      signerId,
      signatureImageUrl,
      signatureType,
    } = validation.data;

    // The signer's address is read from the proxy chain only as far as the deployment trusts it (the first value of X-Forwarded-For is
    // whatever the client sent), and how it was obtained is recorded with it.
    const network = signerNetworkAddress(req.headers);
    const ipAddress = network.address ?? undefined;
    const userAgent = (req.headers.get("user-agent") ?? undefined)?.slice(0, 512);

    const signer = await SignatureService.recordSignature({
      signerId,
      actorUserId: userId,
      signatureImageUrl,
      signatureType,
      ipAddress,
      ipProvenance: network.provenance,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Signature recorded successfully",
      signer,
    });
  } catch (error) {
    if (error instanceof SignatureAuthorityError) {
      return standardErrorResponse(
        error.code === "FORBIDDEN" ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR,
        error.message,
      );
    }
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to record signature',
      error
    );
  }
}

