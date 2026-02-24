/**
 * Signature Recording API
 * POST /api/signatures/sign - Record signature
 * 
 * GUARDED: requireApiAuth
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from '@/lib/api-auth-guard';
import { SignatureService } from "@/lib/signature/signature-service";

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

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
export async function POST(req: NextRequest) {
  try {
    // Authentication guard
    const { userId: _userId } = await requireApiAuth();

    const body = await req.json();
    
    // Validate request body
    const validation = signatureSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const {
      signerId,
      signatureImageUrl,
      signatureType,
      geolocation,
    } = validation.data;

    // Get IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const signer = await SignatureService.recordSignature({
      signerId,
      signatureImageUrl,
      signatureType,
      ipAddress,
      userAgent,
      geolocation,
    });

    return NextResponse.json({
      success: true,
      message: "Signature recorded successfully",
      signer,
    });
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to record signature',
      error
    );
  }
}

