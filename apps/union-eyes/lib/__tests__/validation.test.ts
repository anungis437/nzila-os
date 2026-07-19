/**
 * Unit Tests — lib/validation.ts
 *
 * Tests Zod validation schemas, SQL injection prevention,
 * error formatting, and utility functions for the Union-Eyes validation layer.
 */
import { describe, it, expect } from 'vitest';
import { ZodError, z } from 'zod';
import {
  commonSchemas,
  paramSchemas,
  bodySchemas,
  querySchemas,
  formatValidationError,
  validateParams,
  validateBody,
  validateQuery,
  sanitizeHtml,
  fileValidation,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// commonSchemas
// ---------------------------------------------------------------------------
describe('commonSchemas', () => {
  describe('uuid', () => {
    it('accepts valid UUIDs', () => {
      expect(() => commonSchemas.uuid.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    it('rejects non-UUID strings', () => {
      expect(() => commonSchemas.uuid.parse('not-a-uuid')).toThrow();
    });

    it('rejects empty strings', () => {
      expect(() => commonSchemas.uuid.parse('')).toThrow();
    });
  });

  describe('email', () => {
    it('accepts valid emails', () => {
      expect(() => commonSchemas.email.parse('user@example.com')).not.toThrow();
    });

    it('rejects invalid emails', () => {
      expect(() => commonSchemas.email.parse('not-an-email')).toThrow();
    });
  });

  describe('url', () => {
    it('accepts valid URLs', () => {
      expect(() => commonSchemas.url.parse('https://example.com')).not.toThrow();
    });

    it('rejects invalid URLs', () => {
      expect(() => commonSchemas.url.parse('not-a-url')).toThrow();
    });
  });

  describe('pagination', () => {
    it('provides defaults when no input given', () => {
      const result = commonSchemas.pagination.parse({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('coerces string numbers', () => {
      const result = commonSchemas.pagination.parse({ page: '2', limit: '50' });
      expect(result).toEqual({ page: 2, limit: 50 });
    });

    it('rejects page < 1', () => {
      expect(() => commonSchemas.pagination.parse({ page: 0 })).toThrow();
    });

    it('rejects limit > 100', () => {
      expect(() => commonSchemas.pagination.parse({ limit: 101 })).toThrow();
    });
  });

  describe('dateRange', () => {
    it('accepts valid date range', () => {
      const result = commonSchemas.dateRange.parse({
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.000Z',
      });
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('accepts empty date range (both optional)', () => {
      const result = commonSchemas.dateRange.parse({});
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });
  });

  describe('searchQuery', () => {
    it('accepts normal search text', () => {
      expect(commonSchemas.searchQuery.parse('union steward')).toBe('union steward');
    });

    it('rejects SQL injection patterns', () => {
      expect(() => commonSchemas.searchQuery.parse("'; DROP TABLE users;--")).toThrow();
    });

    it('rejects XSS patterns', () => {
      expect(() => commonSchemas.searchQuery.parse('<script>alert(1)</script>')).toThrow();
    });

    it('rejects strings > 200 chars', () => {
      expect(() => commonSchemas.searchQuery.parse('a'.repeat(201))).toThrow();
    });
  });

  describe('organizationId', () => {
    it('accepts valid UUID', () => {
      expect(() => commonSchemas.organizationId.parse('550e8400-e29b-41d4-a716-446655440000')).not.toThrow();
    });

    it('rejects non-UUID', () => {
      expect(() => commonSchemas.organizationId.parse('bad')).toThrow();
    });
  });

  describe('userId', () => {
    it('accepts non-empty string', () => {
      expect(() => commonSchemas.userId.parse('user_abc123')).not.toThrow();
    });

    it('rejects empty string', () => {
      expect(() => commonSchemas.userId.parse('')).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// bodySchemas
// ---------------------------------------------------------------------------
describe('bodySchemas', () => {
  describe('createClaim', () => {
    const validClaim = {
      claimType: 'grievance_discipline',
      incidentDate: '2026-01-15T10:00:00.000Z',
      location: 'Main Office',
      description: 'A detailed description of the incident that exceeds the minimum character requirement.',
      desiredOutcome: 'I would like the disciplinary action to be reversed and expunged from my record.',
      priority: 'high',
    };

    it('accepts a valid claim', () => {
      expect(() => bodySchemas.createClaim.parse(validClaim)).not.toThrow();
    });

    it('rejects claims with too-short description', () => {
      expect(() =>
        bodySchemas.createClaim.parse({ ...validClaim, description: 'short' }),
      ).toThrow();
    });

    it('rejects claims with invalid claimType', () => {
      expect(() =>
        bodySchemas.createClaim.parse({ ...validClaim, claimType: 'invalid_type' }),
      ).toThrow();
    });

    it('requires witnessDetails when witnessesPresent is true', () => {
      expect(() =>
        bodySchemas.createClaim.parse({ ...validClaim, witnessesPresent: true }),
      ).toThrow('Witness details required');
    });

    it('requires previousReportDetails when previouslyReported is true', () => {
      expect(() =>
        bodySchemas.createClaim.parse({ ...validClaim, previouslyReported: true }),
      ).toThrow('Previous report details required');
    });

    it('accepts valid attachments', () => {
      const result = bodySchemas.createClaim.parse({
        ...validClaim,
        attachments: ['https://files.example.com/doc1.pdf'],
      });
      expect(result.attachments).toHaveLength(1);
    });
  });

  describe('createVotingSession', () => {
    const validSession = {
      title: 'Annual General Meeting Vote',
      type: 'convention' as const,
      meetingType: 'convention' as const,
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      startTime: '2026-06-01T10:00:00.000Z',
    };

    it('accepts a valid voting session', () => {
      expect(() => bodySchemas.createVotingSession.parse(validSession)).not.toThrow();
    });

    it('requires quorum threshold when quorum is enabled', () => {
      expect(() =>
        bodySchemas.createVotingSession.parse({ ...validSession, requiresQuorum: true }),
      ).toThrow('Quorum threshold required');
    });

    it('accepts quorum with threshold', () => {
      const result = bodySchemas.createVotingSession.parse({
        ...validSession,
        requiresQuorum: true,
        quorumThreshold: 51,
      });
      expect(result.quorumThreshold).toBe(51);
    });

    it('rejects title shorter than 3 chars', () => {
      expect(() =>
        bodySchemas.createVotingSession.parse({ ...validSession, title: 'AB' }),
      ).toThrow();
    });

    it('validates options array bounds', () => {
      expect(() =>
        bodySchemas.createVotingSession.parse({ ...validSession, options: ['only-one'] }),
      ).toThrow();
    });
  });

  describe('castVote', () => {
    it('accepts valid vote', () => {
      const result = bodySchemas.castVote.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        optionId: '660e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.sessionId).toBeDefined();
    });

    it('rejects invalid session UUID', () => {
      expect(() =>
        bodySchemas.castVote.parse({ sessionId: 'bad', optionId: '660e8400-e29b-41d4-a716-446655440000' }),
      ).toThrow();
    });
  });

  describe('assignClaim', () => {
    it('accepts valid assignment', () => {
      const result = bodySchemas.assignClaim.parse({
        claimId: '550e8400-e29b-41d4-a716-446655440000',
        assignedToId: 'user_abc',
      });
      expect(result.claimId).toBeDefined();
    });

    it('rejects missing assignedToId', () => {
      expect(() =>
        bodySchemas.assignClaim.parse({ claimId: '550e8400-e29b-41d4-a716-446655440000' }),
      ).toThrow();
    });
  });

  describe('addOrganizationMember', () => {
    it('accepts valid member addition', () => {
      const result = bodySchemas.addOrganizationMember.parse({
        userId: 'user_abc',
        role: 'steward',
      });
      expect(result.role).toBe('steward');
    });

    it('rejects invalid role', () => {
      expect(() =>
        bodySchemas.addOrganizationMember.parse({ userId: 'user_abc', role: 'superadmin' }),
      ).toThrow();
    });
  });

  describe('createOrganization', () => {
    const validOrg = {
      name: 'CAPE-ACEP',
      slug: 'cape-acep',
      type: 'union',
    };

    it('accepts a valid organization', () => {
      expect(() => bodySchemas.createOrganization.parse(validOrg)).not.toThrow();
    });

    it('rejects invalid slug characters', () => {
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, slug: 'INVALID SLUG!' }),
      ).toThrow();
    });

    it('rejects invalid organization types', () => {
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, type: 'corporation' }),
      ).toThrow();
    });

    it('validates jurisdiction enum', () => {
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, jurisdiction: 'ON' }),
      ).not.toThrow();
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, jurisdiction: 'XX' }),
      ).toThrow();
    });

    it('validates primaryColor hex format', () => {
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, primaryColor: '#FF0000' }),
      ).not.toThrow();
      expect(() =>
        bodySchemas.createOrganization.parse({ ...validOrg, primaryColor: 'red' }),
      ).toThrow();
    });
  });

  describe('updateMemberRole', () => {
    it('accepts valid roles', () => {
      expect(() =>
        bodySchemas.updateMemberRole.parse({ role: 'steward' }),
      ).not.toThrow();
    });

    it('rejects invalid roles', () => {
      expect(() =>
        bodySchemas.updateMemberRole.parse({ role: 'superadmin' }),
      ).toThrow();
    });
  });

  describe('updateMemberProfile', () => {
    it('accepts partial updates', () => {
      expect(() =>
        bodySchemas.updateMemberProfile.parse({ name: 'Jane' }),
      ).not.toThrow();
    });

    it('rejects empty updates', () => {
      expect(() =>
        bodySchemas.updateMemberProfile.parse({}),
      ).toThrow('At least one field must be provided');
    });

    it('validates phone number format', () => {
      expect(() =>
        bodySchemas.updateMemberProfile.parse({ phone: '+14165551234' }),
      ).not.toThrow();
      expect(() =>
        bodySchemas.updateMemberProfile.parse({ phone: 'not-a-phone' }),
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// querySchemas
// ---------------------------------------------------------------------------
describe('querySchemas', () => {
  describe('claimsQuery', () => {
    it('accepts valid claims query', () => {
      const result = querySchemas.claimsQuery.parse({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'pending',
        page: 1,
        limit: 10,
      });
      expect(result.organizationId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.status).toBe('pending');
    });

    it('rejects invalid status values', () => {
      expect(() =>
        querySchemas.claimsQuery.parse({
          organizationId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'invalid_status',
        }),
      ).toThrow();
    });
  });

  describe('membersQuery', () => {
    it('accepts valid members query', () => {
      const result = querySchemas.membersQuery.parse({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        role: 'admin',
      });
      expect(result.role).toBe('admin');
    });
  });

  describe('analyticsQuery', () => {
    it('accepts valid analytics query with defaults', () => {
      const result = querySchemas.analyticsQuery.parse({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.timeframe).toBe('month');
    });

    it('accepts custom timeframe', () => {
      const result = querySchemas.analyticsQuery.parse({
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        timeframe: 'quarter',
      });
      expect(result.timeframe).toBe('quarter');
    });

    it('rejects invalid timeframe', () => {
      expect(() =>
        querySchemas.analyticsQuery.parse({
          organizationId: '550e8400-e29b-41d4-a716-446655440000',
          timeframe: 'decade',
        }),
      ).toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// paramSchemas
// ---------------------------------------------------------------------------
describe('paramSchemas', () => {
  it('accepts valid vote session ID', () => {
    const result = paramSchemas.voteSessionId.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.id).toBeDefined();
  });

  it('rejects invalid UUID in params', () => {
    expect(() => paramSchemas.claimId.parse({ id: 'bad' })).toThrow();
  });

  it('accepts valid organization param (non-uuid slug allowed)', () => {
    const result = paramSchemas.organizationParam.parse({ id: 'cape-acep' });
    expect(result.id).toBe('cape-acep');
  });
});

// ---------------------------------------------------------------------------
// formatValidationError
// ---------------------------------------------------------------------------
describe('formatValidationError', () => {
  it('formats ZodError into a structured response', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    let zodErr: ZodError | undefined;
    try {
      schema.parse({ name: 123, age: 'not-a-number' });
    } catch (e) {
      zodErr = e as ZodError;
    }

    const response = formatValidationError(zodErr!);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Validation failed');
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toBeInstanceOf(Array);
    expect(body.details.length).toBeGreaterThan(0);
    expect(body.details[0]).toHaveProperty('field');
    expect(body.details[0]).toHaveProperty('message');
    expect(body.details[0]).toHaveProperty('code');
  });
});

// ---------------------------------------------------------------------------
// validateParams
// ---------------------------------------------------------------------------
describe('validateParams', () => {
  const schema = z.object({ id: z.string().uuid() });

  it('returns parsed value for valid params', () => {
    const result = validateParams({ id: '550e8400-e29b-41d4-a716-446655440000' }, schema);
    expect(result).toEqual({ id: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('returns NextResponse for invalid params', () => {
    const result = validateParams({ id: 'bad' }, schema);
    // NextResponse has a status property
    expect(result).toHaveProperty('status', 400);
  });

  it('rethrows non-Zod errors', () => {
    const throwSchema = { parse: () => { throw new TypeError('unexpected'); } } as any as z.ZodSchema;
    expect(() => validateParams({}, throwSchema)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// validateBody
// ---------------------------------------------------------------------------
describe('validateBody', () => {
  const schema = z.object({ name: z.string().min(1) });

  it('returns parsed body for valid JSON', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await validateBody(req, schema);
    expect(result).toEqual({ name: 'Test' });
  });

  it('returns 400 NextResponse for invalid body', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await validateBody(req, schema);
    expect(result).toHaveProperty('status', 400);
  });

  it('returns INVALID_JSON for malformed JSON', async () => {
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: 'not-json{{{',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await validateBody(req, schema);
    expect(result).toHaveProperty('status', 400);
    const body = await (result as Response).json();
    expect(body.code).toBe('INVALID_JSON');
  });

  it('rethrows non-Zod non-Syntax errors', async () => {
    const throwSchema = { parse: () => { throw new TypeError('unexpected'); } } as any as z.ZodSchema;
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ name: 'x' }),
    });

    await expect(validateBody(req, throwSchema)).rejects.toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// validateQuery
// ---------------------------------------------------------------------------
describe('validateQuery', () => {
  const schema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    q: z.string().optional(),
  });

  it('parses valid query parameters', () => {
    const req = new Request('http://localhost/api?page=2&q=test');
    const result = validateQuery(req, schema);
    expect(result).toEqual({ page: 2, q: 'test' });
  });

  it('applies defaults for missing query params', () => {
    const req = new Request('http://localhost/api');
    const result = validateQuery(req, schema);
    expect(result).toEqual({ page: 1 });
  });

  it('returns 400 for invalid query params', () => {
    const strictSchema = z.object({ page: z.coerce.number().int().min(1) });
    const req = new Request('http://localhost/api?page=0');
    const result = validateQuery(req, strictSchema);
    expect(result).toHaveProperty('status', 400);
  });

  it('rethrows non-Zod errors', () => {
    const throwSchema = { parse: () => { throw new TypeError('unexpected'); } } as any as z.ZodSchema;
    const req = new Request('http://localhost/api');
    expect(() => validateQuery(req, throwSchema)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// sanitizeHtml
// ---------------------------------------------------------------------------
describe('sanitizeHtml', () => {
  it('escapes angle brackets', () => {
    expect(sanitizeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double and single quotes', () => {
    expect(sanitizeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(sanitizeHtml("it's")).toBe("it&#x27;s");
  });

  it('escapes forward slashes', () => {
    expect(sanitizeHtml('</script>')).toBe('&lt;&#x2F;script&gt;');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// fileValidation
// ---------------------------------------------------------------------------
describe('fileValidation', () => {
  it('validateImage accepts valid image file', () => {
    const result = fileValidation.validateImage.parse({
      type: 'image/png',
      size: 1024,
      name: 'photo.png',
    });
    expect(result.type).toBe('image/png');
  });

  it('validateImage rejects invalid type', () => {
    expect(() =>
      fileValidation.validateImage.parse({
        type: 'application/pdf',
        size: 1024,
        name: 'doc.pdf',
      }),
    ).toThrow();
  });

  it('validateImage rejects oversized file', () => {
    expect(() =>
      fileValidation.validateImage.parse({
        type: 'image/jpeg',
        size: 20 * 1024 * 1024,
        name: 'huge.jpg',
      }),
    ).toThrow();
  });

  it('validateDocument accepts valid PDF', () => {
    const result = fileValidation.validateDocument.parse({
      type: 'application/pdf',
      size: 5000,
      name: 'contract.pdf',
    });
    expect(result.type).toBe('application/pdf');
  });

  it('validateDocument rejects invalid filename characters', () => {
    expect(() =>
      fileValidation.validateDocument.parse({
        type: 'application/pdf',
        size: 1024,
        name: 'file with spaces.pdf',
      }),
    ).toThrow();
  });

  it('allowedImageTypes matches expected types', () => {
    expect(fileValidation.allowedImageTypes).toContain('image/jpeg');
    expect(fileValidation.allowedImageTypes).toContain('image/png');
    expect(fileValidation.allowedImageTypes).toContain('image/webp');
  });

  it('maxFileSize is 10MB', () => {
    expect(fileValidation.maxFileSize).toBe(10 * 1024 * 1024);
  });
});

// ---------------------------------------------------------------------------
// Batch 35: branch gap-fill — zod errorMap callbacks
// ---------------------------------------------------------------------------
describe('Batch 35: branch gap-fill', () => {
  it('createVotingSession rejects invalid type enum with custom errorMap message', () => {
    const result = bodySchemas.createVotingSession.safeParse({
      title: 'Valid Title',
      type: 'invalid_type',
      meetingType: 'convention',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      startTime: '2026-06-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const typeIssue = result.error.issues.find(i => i.path.includes('type'));
      expect(typeIssue?.message).toContain('Invalid type');
    }
  });

  it('createVotingSession rejects invalid meetingType enum with custom errorMap message', () => {
    const result = bodySchemas.createVotingSession.safeParse({
      title: 'Valid Title',
      type: 'convention',
      meetingType: 'invalid_meeting',
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      startTime: '2026-06-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mtIssue = result.error.issues.find(i => i.path.includes('meetingType'));
      expect(mtIssue?.message).toContain('Invalid meeting type');
    }
  });
});
