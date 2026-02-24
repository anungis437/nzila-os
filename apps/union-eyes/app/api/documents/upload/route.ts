/**
 * Document Upload API Route
 * POST /api/documents/upload - Upload document files
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { createDocument } from "@/lib/services/document-service";
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from "@/lib/rate-limiter";
import { put } from "@vercel/blob";

const ALLOWED_MIME_TYPES_LIST = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
] as const;

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * Maximum file size: 50MB
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const _documentUploadSchema = z.object({
  file: z.object({
    name: z.string().min(1, "File name is required"),
    size: z.number().max(MAX_FILE_SIZE, "File size exceeds 50MB limit"),
    type: z.enum(ALLOWED_MIME_TYPES_LIST as unknown as [string, ...string[]], {
      errorMap: () => ({ message: "Invalid file type" })
    })
  }),
  organizationId: z.string().uuid("Invalid organization ID"),
  folderId: z.string().uuid("Invalid folder ID").optional(),
  name: z.string().max(255, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  tags: z.array(z.string().max(50)).max(20, "Too many tags").optional(),
  category: z.string().max(100).optional(),
  isConfidential: z.boolean().optional(),
  accessLevel: z.enum(["public", "private", "restricted", "confidential"]).optional()
});

/**
 * POST /api/documents/upload
 * Upload a document file
 * 
 * Accepts multipart/form-data with:
 * - file: File (required)
 * - organizationId: string (required)
 * - folderId: string (optional)
 * - name: string (optional - defaults to filename)
 * - description: string (optional)
 * - tags: string[] (optional)
 * - category: string (optional)
 * - isConfidential: boolean (optional)
 * - accessLevel: string (optional)
 */
export const POST = withRoleAuth('member', async (request, context) => {
  const { userId, organizationId } = context as { userId: string; organizationId: string };

  try {
    // Rate limiting
    const rateLimitResult = await checkRateLimit(
      `doc-upload:${userId}`,
      RATE_LIMITS.DOCUMENT_UPLOAD
    );

    if (!rateLimitResult.allowed) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'unauthorized_access',
        severity: 'medium',
        details: { 
          dataType: 'DOCUMENTS',
          resetIn: rateLimitResult.resetIn 
        },
      });
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many upload requests. Please try again in ${rateLimitResult.resetIn} seconds.`,
          resetIn: rateLimitResult.resetIn 
        },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const organizationIdFromForm = formData.get("organizationId") as string;
    const folderId = formData.get("folderId") as string | null;
    const name = (formData.get("name") as string) || file?.name;
    const description = formData.get("description") as string | null;
    const tagsString = formData.get("tags") as string | null;
    const tags = tagsString ? JSON.parse(tagsString) : null;
    const category = formData.get("category") as string | null;
    const isConfidential = formData.get("isConfidential") === "true";
    const accessLevel = (formData.get("accessLevel") as string) || "standard";

    // Validation
    if (!file) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'low',
        details: { dataType: 'DOCUMENTS', reason: 'File is required' },
      });
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'File is required'
    );
    }

    if (!organizationIdFromForm) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'low',
        details: { dataType: 'DOCUMENTS', reason: 'organizationId is required' },
      });
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'organizationId is required'
    );
    }

    // Verify organization ID matches context
    if (organizationIdFromForm !== organizationId) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'unauthorized_access',
        severity: 'high',
        details: { dataType: 'DOCUMENTS', reason: 'Organization ID mismatch' },
      });
      return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'low',
        details: { 
          dataType: 'DOCUMENTS',
          reason: 'File too large',
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE 
        },
      });
      return NextResponse.json(
        { error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!(ALLOWED_MIME_TYPES_LIST as readonly string[]).includes(file.type)) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents/upload',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'low',
        details: { 
          dataType: 'DOCUMENTS',
          reason: 'Invalid file type',
          fileType: file.type 
        },
      });
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed` },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob Storage
    const blob = await put(
      `documents/${organizationId}/${Date.now()}-${file.name}`,
      file,
      {
        access: "public",
        addRandomSuffix: true,
      }
    );

    // Create document record
    const document = await createDocument({
      organizationId: organizationIdFromForm,
      folderId: folderId || null,
      name,
      fileUrl: blob.url,
      fileSize: file.size,
      fileType: file.name.split(".").pop() || "unknown",
      mimeType: file.type,
      description: description || null,
      tags: tags || null,
      category: category || null,
      contentText: null,
      isConfidential,
      accessLevel: accessLevel as "standard" | "restricted" | "confidential",
      uploadedBy: userId,
      metadata: {
        originalFileName: file.name,
        uploadedAt: new Date().toISOString(),
        blobKey: blob.pathname,
      },
    });

    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/documents/upload',
      method: 'POST',
      eventType: 'success',
      severity: 'medium',
      details: {
        dataType: 'DOCUMENTS',
        organizationId: organizationIdFromForm,
        documentId: document.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/documents/upload',
      method: 'POST',
      eventType: 'validation_failed',
      severity: 'high',
      details: { dataType: 'DOCUMENTS', error: error instanceof Error ? error.message : 'Unknown error' },
    });
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to upload document',
      error
    );
  }
});

