/**
 * Documents API Routes - Main endpoints for document management
 * GET /api/documents - List documents with filtering and pagination
 * POST /api/documents - Upload/create a new document
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { 
  listDocuments, 
  createDocument, 
  searchDocuments,
  getDocumentStatistics 
} from "@/lib/services/document-service";
import { withRoleAuth } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

/**
 * Validation schema for creating documents
 */
const createDocumentSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  folderId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  fileUrl: z.string().url('Invalid file URL'),
  fileSize: z.number().optional().nullable(),
  fileType: z.string().min(1, 'File type is required'),
  mimeType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  category: z.string().optional().nullable(),
  contentText: z.string().optional().nullable(),
  isConfidential: z.boolean().optional().default(false),
  accessLevel: z.enum(['standard', 'restricted', 'confidential']).optional().default('standard'),
  metadata: z.record(z.any()).optional().default({}),
});

/**
 * GET /api/documents
 * List documents with filtering and pagination
 * 
 * Query params:
 * - organizationId: string (required)
 * - folderId: string
 * - category: string
 * - tags: string[] (comma-separated)
 * - fileType: string
 * - uploadedBy: string
 * - searchQuery: string
 * - page: number
 * - limit: number
 * - sortBy: string (name, uploadedAt, createdAt)
 * - sortOrder: string (asc, desc)
 * - statistics: boolean - returns statistics instead of list
 * - search: boolean - uses advanced search
 */
export const GET = withRoleAuth('member', async (request, context) => {
  const { userId, organizationId } = context as { userId: string; organizationId: string };

  try {
    const { searchParams } = new URL(request.url);
    
    const requestOrgId = searchParams.get("organizationId") ?? searchParams.get("orgId") ?? searchParams.get("organization_id") ?? searchParams.get("org_id") ?? searchParams.get("unionId") ?? searchParams.get("union_id") ?? searchParams.get("localId") ?? searchParams.get("local_id");
    
    const organizationIdParam = requestOrgId;
    if (!organizationIdParam) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), 
        userId,
        endpoint: '/api/documents',
        method: 'GET',
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
    if (organizationIdParam !== organizationId) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/documents',
        method: 'GET',
        eventType: 'auth_failed',
        severity: 'high',
        details: { dataType: 'DOCUMENTS', reason: 'Organization ID mismatch' },
      });
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'You do not have access to this organization\'s documents'
      );
    }

    // Check for special modes
    const statistics = searchParams.get("statistics") === "true";
    const search = searchParams.get("search") === "true";

    // Return statistics
    if (statistics) {
      const stats = await getDocumentStatistics(organizationIdParam);
      logApiAuditEvent({
        timestamp: new Date().toISOString(), 
        userId,
        endpoint: '/api/documents',
        method: 'GET',
        eventType: 'success',
        severity: 'low',
        details: { dataType: 'DOCUMENTS', organizationId: organizationIdParam, mode: 'statistics' },
      });
      return NextResponse.json(stats);
    }

    // Advanced search mode
    if (search) {
      const searchQuery = searchParams.get("searchQuery") || "";
      const filters: Record<string, unknown> = {};

      const category = searchParams.get("category");
      if (category) filters.category = category;

      const fileType = searchParams.get("fileType");
      if (fileType) filters.fileType = fileType;

      const uploadedBy = searchParams.get("uploadedBy");
      if (uploadedBy) filters.uploadedBy = uploadedBy;

      const tags = searchParams.get("tags");
      if (tags) filters.tags = tags.split(",");

      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");

      const results = await searchDocuments(organizationIdParam, searchQuery, filters, { page, limit });
      logApiAuditEvent({
        timestamp: new Date().toISOString(), 
        userId,
        endpoint: '/api/documents',
        method: 'GET',
        eventType: 'success',
        severity: 'low',
        details: { dataType: 'DOCUMENTS', organizationId: organizationIdParam, mode: 'search', searchQuery, resultCount: results.documents?.length || 0 },
      });
      return NextResponse.json(results);
    }

    // Build filters
    const filters: Record<string, unknown> = { organizationId: organizationIdParam };
    
    const folderId = searchParams.get("folderId");
    if (folderId) filters.folderId = folderId;

    const category = searchParams.get("category");
    if (category) filters.category = category;

    const tags = searchParams.get("tags");
    if (tags) filters.tags = tags.split(",");

    const fileType = searchParams.get("fileType");
    if (fileType) filters.fileType = fileType;

    const uploadedBy = searchParams.get("uploadedBy");
    if (uploadedBy) filters.uploadedBy = uploadedBy;

    const searchQuery = searchParams.get("searchQuery");
    if (searchQuery) filters.searchQuery = searchQuery;

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "uploadedAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

    const result = await listDocuments(filters, { page, limit, sortBy, sortOrder });
    
    logApiAuditEvent({
      timestamp: new Date().toISOString(), 
      userId,
      endpoint: '/api/documents',
      method: 'GET',
      eventType: 'success',
      severity: 'low',
      details: { dataType: 'DOCUMENTS', organizationId: organizationIdParam, filters, resultCount: result.documents?.length || 0 },
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(), 
      userId,
      endpoint: '/api/documents',
      method: 'GET',
      eventType: 'unauthorized_access',
      severity: 'high',
      details: { dataType: 'DOCUMENTS', error: error instanceof Error ? error.message : 'Unknown error' },
    });
return NextResponse.json(
      { error: "Failed to list documents", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/documents
 * Create a new document
 * 
 * Body:
 * - organizationId: string (required)
 * - folderId: string (optional)
 * - name: string (required)
 * - fileUrl: string (required)
 * - fileSize: number
 * - fileType: string (required)
 * - mimeType: string
 * - description: string
 * - tags: string[]
 * - category: string
 * - isConfidential: boolean
 * - accessLevel: string
 * - metadata: object
 */
export const POST = withRoleAuth('member', async (request, context) => {
  const { userId, organizationId } = context as { userId: string; organizationId: string };

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/documents',
      method: 'POST',
      eventType: 'validation_failed',
      severity: 'low',
      details: { dataType: 'DOCUMENTS', reason: 'Invalid JSON in request body' },
    });
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON in request body');
  }

  const parsed = createDocumentSchema.safeParse(rawBody);
  if (!parsed.success) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/documents',
      method: 'POST',
      eventType: 'validation_failed',
      severity: 'low',
      details: { dataType: 'DOCUMENTS', reason: 'Validation failed', errors: parsed.error.errors },
    });
    return NextResponse.json({ 
      error: 'Invalid request body',
      details: parsed.error.errors
    }, { status: 400 });
  }

  const body = parsed.data;

  // Verify organization ID matches context
  if (body.organizationId !== organizationId) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/documents',
      method: 'POST',
      eventType: 'auth_failed',
      severity: 'high',
      details: { dataType: 'DOCUMENTS', reason: 'Organization ID mismatch' },
    });
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Forbidden');
  }

  try {
    // Create document
    const document = await createDocument({
      organizationId: body.organizationId,
      folderId: body.folderId || null,
      name: body.name,
      fileUrl: body.fileUrl,
      fileSize: body.fileSize || null,
      fileType: body.fileType,
      mimeType: body.mimeType || null,
      description: body.description || null,
      tags: body.tags || null,
      category: body.category || null,
      contentText: body.contentText || null,
      isConfidential: body.isConfidential,
      accessLevel: body.accessLevel,
      uploadedBy: userId,
      metadata: body.metadata,
    });

    logApiAuditEvent({
      timestamp: new Date().toISOString(), 
      userId,
      endpoint: '/api/documents',
      method: 'POST',
      eventType: 'success',
      severity: 'medium',
      details: { 
        dataType: 'DOCUMENTS',
        organizationId: body.organizationId, 
        documentId: document.id,
        documentName: body.name, 
        fileType: body.fileType 
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(), 
      userId,
      endpoint: '/api/documents',
      method: 'POST',
      eventType: 'unauthorized_access',
      severity: 'high',
      details: { dataType: 'DOCUMENTS', error: error instanceof Error ? error.message : 'Unknown error' },
    });
return NextResponse.json(
      { error: "Failed to create document", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});

