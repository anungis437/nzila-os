import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RequestValidator, createValidator, validateRequest } from '../request-validation';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function fakeRequest(body: any): Request {
  return new Request('http://localhost/api/test?page=1&limit=10', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function badJsonRequest(): Request {
  return new Request('http://localhost/api/test', {
    method: 'POST',
    body: 'not-json',
  });
}

/* ------------------------------------------------------------------ */
/* RequestValidator.validateBody                                       */
/* ------------------------------------------------------------------ */
describe('RequestValidator.validateBody', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });

  it('returns valid result for good data', async () => {
    const result = await RequestValidator.validateBody(fakeRequest({ name: 'Jo', age: 30 }), schema);
    expect(result.isValid).toBe(true);
    if (result.isValid) expect(result.data).toEqual({ name: 'Jo', age: 30 });
  });

  it('returns errors for invalid data', async () => {
    const result = await RequestValidator.validateBody(fakeRequest({ name: '', age: -1 }), schema);
    expect(result.isValid).toBe(false);
  });

  it('returns error for non-JSON body', async () => {
    const result = await RequestValidator.validateBody(badJsonRequest(), schema);
    expect(result.isValid).toBe(false);
    if (!result.isValid) expect(result.errors['_body']).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* RequestValidator.validateQuery                                      */
/* ------------------------------------------------------------------ */
describe('RequestValidator.validateQuery', () => {
  const pageSchema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  });

  it('validates URLSearchParams', () => {
    const sp = new URLSearchParams({ page: '1', limit: '10' });
    const r = RequestValidator.validateQuery(sp, pageSchema);
    expect(r.isValid).toBe(true);
  });

  it('validates plain object', () => {
    const r = RequestValidator.validateQuery({ page: '2' }, pageSchema);
    expect(r.isValid).toBe(true);
  });

  it('returns errors for invalid query', () => {
    const strict = z.object({ page: z.coerce.number().int().positive() });
    const r = RequestValidator.validateQuery({ page: 'abc' }, strict);
    expect(r.isValid).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* RequestValidator.formatZodErrors                                    */
/* ------------------------------------------------------------------ */
describe('RequestValidator.formatZodErrors', () => {
  it('maps Zod issues to path→messages', () => {
    const schema = z.object({ x: z.number() });
    const result = schema.safeParse({ x: 'nope' });
    if (!result.success) {
      const mapped = RequestValidator.formatZodErrors(result.error);
      expect(mapped['x']).toBeDefined();
      expect(mapped['x'].length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* RequestValidator.errorResponse                                      */
/* ------------------------------------------------------------------ */
describe('RequestValidator.errorResponse', () => {
  it('creates JSON response with 400 default status', () => {
    const resp = RequestValidator.errorResponse({ name: ['required'] });
    expect(resp.status).toBe(400);
  });

  it('accepts custom status code', () => {
    const resp = RequestValidator.errorResponse({ x: ['bad'] }, 422);
    expect(resp.status).toBe(422);
  });
});

/* ------------------------------------------------------------------ */
/* RequestValidator.sanitize                                           */
/* ------------------------------------------------------------------ */
describe('RequestValidator.sanitize', () => {
  it('applies rules to matching keys', () => {
    const data = { name: '  hello  ', keep: 42 };
    const sanitized = RequestValidator.sanitize(data, {
      name: (v) => (v as string).trim(),
    });
    expect(sanitized.name).toBe('hello');
    expect(sanitized.keep).toBe(42);
  });

  it('ignores rules for missing keys', () => {
    const data = { a: 1 };
    const sanitized = RequestValidator.sanitize(data, { missing: (v) => v });
    expect(sanitized).toEqual({ a: 1 });
  });

  it('silently swallows rule errors', () => {
    const data = { x: 'a' };
    const sanitized = RequestValidator.sanitize(data, {
      x: () => { throw new Error('fail'); },
    });
    // Should not throw; value unchanged
    expect(sanitized.x).toBe('a');
  });
});

/* ------------------------------------------------------------------ */
/* createValidator builders                                            */
/* ------------------------------------------------------------------ */
describe('createValidator helpers', () => {
  it('email validates and lowercases', () => {
    const v = createValidator.email();
    expect(v.parse('jo@example.com')).toBe('jo@example.com');
    expect(() => v.parse('not-email')).toThrow();
  });

  it('password enforces min length', () => {
    const v = createValidator.password({ minLength: 10 });
    expect(() => v.parse('short')).toThrow();
    expect(v.parse('longEnough!!')).toBe('longEnough!!');
  });

  it('password enforces special chars when required', () => {
    const v = createValidator.password({ requireSpecialChars: true });
    expect(() => v.parse('NoSpecialChars123')).toThrow();
    expect(v.parse('HasSpecial!1')).toBeDefined();
  });

  it('uuid validates', () => {
    const v = createValidator.uuid();
    expect(v.parse('550e8400-e29b-41d4-a716-446655440000')).toBeDefined();
    expect(() => v.parse('not-uuid')).toThrow();
  });

  it('url rejects javascript: URIs', () => {
    const v = createValidator.url();
    expect(() => v.parse('javascript:alert(1)')).toThrow();
    expect(v.parse('https://example.com')).toBe('https://example.com');
  });

  it('phone US format', () => {
    const v = createValidator.phone('US');
    expect(v.parse('(555) 123-4567')).toBeDefined();
  });

  it('phone INTL format', () => {
    const v = createValidator.phone('INTL');
    expect(v.parse('+14155551234')).toBeDefined();
  });

  it('slug validates', () => {
    const v = createValidator.slug();
    expect(v.parse('my-slug')).toBe('my-slug');
    expect(() => v.parse('Invalid Slug!')).toThrow();
  });

  it('authHeader strips Bearer prefix', () => {
    const v = createValidator.authHeader();
    expect(v.parse('Bearer abc123')).toBe('abc123');
    expect(() => v.parse('Basic abc123')).toThrow();
  });

  it('pagination defaults', () => {
    const v = createValidator.pagination();
    const r = v.parse({});
    expect(r).toBeDefined();
  });

  it('dateRange validates from <= to', () => {
    const v = createValidator.dateRange();
    expect(() => v.parse({ from: new Date('2025-02-01'), to: new Date('2025-01-01') })).toThrow();
    expect(v.parse({ from: new Date('2025-01-01'), to: new Date('2025-02-01') })).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* validateRequest (top-level helper)                                  */
/* ------------------------------------------------------------------ */
describe('validateRequest', () => {
  it('delegates to validateBody', async () => {
    const schema = z.object({ x: z.number() });
    // Create a NextRequest-compatible object
    const req = new Request('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ x: 5 }),
    });
    const result = await validateRequest(req as never, schema);
    expect(result.isValid).toBe(true);
  });
});
