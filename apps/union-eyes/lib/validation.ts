import { z, ZodError, ZodSchema } from 'zod';
import { NextResponse } from 'next/server';

/**
 * World-class input validation utilities
 * 
 * Features:
 * - Type-safe validation with Zod
 * - Automatic error formatting
 * - SQL injection prevention
 * - XSS protection
 */

// Common validation schemas
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format'),
  organizationId: z.string().uuid('Invalid organization ID'),
  userId: z.string().min(1, 'User ID is required'),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  
  // Date ranges
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
  
  // Search query (XSS protected)
  searchQuery: z.string()
    .max(200, 'Search query too long')
    .regex(/^[a-zA-Z0-9\s\-_.,@]+$/, 'Invalid characters in search query')
    .optional(),
};

/**
 * API parameter validation schemas
 */
export const paramSchemas = {
  // Vote session ID
  voteSessionId: z.object({
    id: commonSchemas.uuid,
  }),
  
  // Claim ID
  claimId: z.object({
    id: commonSchemas.uuid,
  }),
  
  // Organization slug or ID
  organizationParam: z.object({
    id: z.string().min(1),
  }),
};

/**
 * Request body validation schemas
 */
export const bodySchemas = {
  // Create voting session
  createVotingSession: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
    description: z.string().max(5000, 'Description too long').optional(),
    type: z.enum(['convention', 'ratification', 'special_vote'], {
      errorMap: () => ({ message: 'Invalid type. Must be convention, ratification, or special_vote' })
    }),
    meetingType: z.enum(['convention', 'ratification', 'emergency', 'special'], {
      errorMap: () => ({ message: 'Invalid meeting type' })
    }),
    organizationId: commonSchemas.organizationId,
    startTime: z.string().datetime('Invalid start time format'),
    scheduledEndTime: z.string().datetime('Invalid end time format').optional(),
    allowAnonymous: z.boolean().default(false),
    requiresQuorum: z.boolean().default(false),
    quorumThreshold: z.number().int().min(1).max(100).optional(),
    settings: z.record(z.unknown()).optional(),
    options: z.array(z.string().min(1, 'Option text required').max(500, 'Option text too long'))
      .min(2, 'At least 2 options required')
      .max(20, 'Maximum 20 options allowed')
      .optional(),
  }).refine(
    (data) => {
      if (data.requiresQuorum && !data.quorumThreshold) {
        return false;
      }
      return true;
    },
    { message: 'Quorum threshold required when quorum is enabled', path: ['quorumThreshold'] }
  ),
  
  // Update voting session
  updateVotingSession: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    status: z.enum(['draft', 'active', 'closed']).optional(),
    endDate: z.string().datetime().optional(),
  }),
  
  // Cast vote
  castVote: z.object({
    sessionId: commonSchemas.uuid,
    optionId: commonSchemas.uuid,
  }),
  
  // Create claim
  createClaim: z.object({
    claimType: z.enum([
      'grievance_discipline',
      'grievance_schedule',
      'grievance_pay',
      'workplace_safety',
      'discrimination_age',
      'discrimination_gender',
      'discrimination_race',
      'discrimination_disability',
      'harassment_verbal',
      'harassment_physical',
      'harassment_sexual',
      'contract_dispute',
      'retaliation',
      'other',
    ], {
      errorMap: () => ({ message: 'Invalid claim type' })
    }),
    incidentDate: z.string().datetime('Invalid incident date format'),
    location: z.string().min(1, 'Location is required').max(500, 'Location too long'),
    description: z.string().min(20, 'Description must be at least 20 characters').max(10000, 'Description too long'),
    desiredOutcome: z.string().min(10, 'Desired outcome must be at least 10 characters').max(5000, 'Desired outcome too long'),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    isAnonymous: z.boolean().default(true),
    witnessesPresent: z.boolean().default(false),
    witnessDetails: z.string().max(5000, 'Witness details too long').optional().nullable(),
    previouslyReported: z.boolean().default(false),
    previousReportDetails: z.string().max(5000, 'Previous report details too long').optional().nullable(),
    attachments: z.array(z.string().url('Invalid attachment URL')).max(10, 'Maximum 10 attachments').optional(),
    voiceTranscriptions: z.array(z.object({
      text: z.string(),
      timestamp: z.string().datetime(),
      duration: z.number().positive(),
    })).max(5, 'Maximum 5 voice transcriptions').optional(),
    metadata: z.record(z.unknown()).optional(),
  }).refine(
    (data) => {
      if (data.witnessesPresent && !data.witnessDetails) {
        return false;
      }
      return true;
    },
    { message: 'Witness details required when witnesses are present', path: ['witnessDetails'] }
  ).refine(
    (data) => {
      if (data.previouslyReported && !data.previousReportDetails) {
        return false;
      }
      return true;
    },
    { message: 'Previous report details required when previously reported', path: ['previousReportDetails'] }
  ),
  
  // Assign claim
  assignClaim: z.object({
    claimId: commonSchemas.uuid,
    assignedToId: commonSchemas.userId,
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
  
  // Create organization
  createOrganization: z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters').max(200, 'Name too long'),
    slug: z.string().min(1, 'Slug required').max(100, 'Slug too long').regex(/^[a-z0-9-_]+$/, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores'),
    type: z.enum(['platform', 'congress', 'federation', 'union', 'local', 'region', 'district'], {
      errorMap: () => ({ message: 'Invalid organization type' })
    }),
    parentId: commonSchemas.uuid.optional().nullable(),
    description: z.string().max(2000, 'Description too long').optional(),
    sectors: z.array(z.enum(['healthcare', 'education', 'public_service', 'trades', 'manufacturing', 'transportation', 'retail', 'hospitality', 'technology', 'construction', 'utilities', 'telecommunications', 'financial_services', 'agriculture', 'arts_culture', 'other'])).max(10).optional(),
    jurisdiction: z.enum(['federal', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']).optional(),
    contactEmail: commonSchemas.email.optional(),
    contactPhone: z.string().max(20).optional(),
    address: z.record(z.unknown()).optional(),
    website: z.string().url('Invalid website URL').optional(),
    logo: z.string().url('Invalid logo URL').optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (use #RRGGBB)').optional(),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional(),
  }),
  
  // Add organization member
  addOrganizationMember: z.object({
    userId: commonSchemas.userId,
    role: z.enum(['member', 'steward', 'officer', 'admin'], {
      errorMap: () => ({ message: 'Invalid role. Must be member, steward, officer, or admin' })
    }),
    isPrimary: z.boolean().default(false),
    effectiveDate: z.string().datetime('Invalid effective date').optional(),
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
  
  // Update member role
  updateMemberRole: z.object({
    role: z.enum(['member', 'steward', 'officer', 'admin']),
    effectiveDate: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
  }),
  
  // Update member profile
  updateMemberProfile: z.object({
    name: z.string().min(1, 'Name required').max(200, 'Name too long').optional(),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional().nullable(),
    department: z.string().max(200, 'Department name too long').optional().nullable(),
    position: z.string().max(200, 'Position title too long').optional().nullable(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  }),
};

/**
 * Query parameter validation schemas
 */
export const querySchemas = {
  // Analytics filters
  analyticsQuery: z.object({
    organizationId: commonSchemas.organizationId,
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    timeframe: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  }),
  
  // Claims list
  claimsQuery: z.object({
    organizationId: commonSchemas.organizationId,
    status: z.enum(['pending', 'in_progress', 'resolved', 'closed']).optional(),
    assignedTo: commonSchemas.userId.optional(),
    search: commonSchemas.searchQuery,
    ...commonSchemas.pagination.shape,
  }),
  
  // Members list
  membersQuery: z.object({
    organizationId: commonSchemas.organizationId,
    role: z.enum(['member', 'steward', 'officer', 'admin']).optional(),
    search: commonSchemas.searchQuery,
    ...commonSchemas.pagination.shape,
  }),
};

/**
 * Validation error response formatter
 */
export function formatValidationError(error: ZodError): NextResponse {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return NextResponse.json(
    {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * Validate request parameters
 */
export function validateParams<T extends ZodSchema>(
  params: any,
  schema: T
): z.infer<T> | NextResponse {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      return formatValidationError(error);
    }
    throw error;
  }
}

/**
 * Validate request body
 */
export async function validateBody<T extends ZodSchema>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return formatValidationError(error);
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
        { status: 400 }
      );
    }
    throw error;
  }
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends ZodSchema>(
  request: Request,
  schema: T
): z.infer<T> | NextResponse {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    return schema.parse(query);
  } catch (error) {
    if (error instanceof ZodError) {
      return formatValidationError(error);
    }
    throw error;
  }
}

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize file uploads
 */
export const fileValidation = {
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedDocumentTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  validateImage: z.object({
    type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: z.string().regex(/^[a-zA-Z0-9_\-\.]+$/, 'Invalid filename'),
  }),
  
  validateDocument: z.object({
    type: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
    name: z.string().regex(/^[a-zA-Z0-9_\-\.]+$/, 'Invalid filename'),
  }),
};

