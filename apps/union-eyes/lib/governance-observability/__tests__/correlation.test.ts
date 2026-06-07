import { describe, it, expect } from 'vitest';
import { createCorrelationContext, deriveChildContext, correlationToHeaders, correlationFromHeaders } from '../correlation';

describe('createCorrelationContext', () => {
  it('generates a correlation ID with gcid_ prefix', () => {
    const ctx = createCorrelationContext();
    expect(ctx.governanceCorrelationId).toMatch(/^gcid_/);
  });

  it('generates a session ID with gsid_ prefix', () => {
    const ctx = createCorrelationContext();
    expect(ctx.governanceSessionId).toMatch(/^gsid_/);
  });

  it('generates a trace ID with gtid_ prefix', () => {
    const ctx = createCorrelationContext();
    expect(ctx.governanceTraceId).toMatch(/^gtid_/);
  });

  it('accepts optional orgId and actorId', () => {
    const ctx = createCorrelationContext({ orgId: 'org-1', actorId: 'user-1' });
    expect(ctx.orgId).toBe('org-1');
    expect(ctx.actorId).toBe('user-1');
  });

  it('uses incomingTraceId when provided', () => {
    const ctx = createCorrelationContext({ incomingTraceId: 'abc123' });
    expect(ctx.governanceTraceId).toBe('gtid_abc123');
  });

  it('sets createdAt to a valid ISO string', () => {
    const ctx = createCorrelationContext();
    expect(() => new Date(ctx.createdAt)).not.toThrow();
    expect(ctx.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('generates unique correlation IDs on each call', () => {
    const ctx1 = createCorrelationContext();
    const ctx2 = createCorrelationContext();
    expect(ctx1.governanceCorrelationId).not.toBe(ctx2.governanceCorrelationId);
  });
});

describe('deriveChildContext', () => {
  it('inherits session and trace IDs from parent', () => {
    const parent = createCorrelationContext({ orgId: 'org-1' });
    const child = deriveChildContext(parent);
    expect(child.governanceSessionId).toBe(parent.governanceSessionId);
    expect(child.governanceTraceId).toBe(parent.governanceTraceId);
  });

  it('generates a new correlation ID for the child', () => {
    const parent = createCorrelationContext();
    const child = deriveChildContext(parent);
    expect(child.governanceCorrelationId).not.toBe(parent.governanceCorrelationId);
    expect(child.governanceCorrelationId).toMatch(/^gcid_/);
  });

  it('inherits orgId from parent when not overridden', () => {
    const parent = createCorrelationContext({ orgId: 'org-parent' });
    const child = deriveChildContext(parent);
    expect(child.orgId).toBe('org-parent');
  });

  it('allows overriding orgId in the child', () => {
    const parent = createCorrelationContext({ orgId: 'org-parent' });
    const child = deriveChildContext(parent, { orgId: 'org-child' });
    expect(child.orgId).toBe('org-child');
  });
});

describe('correlationToHeaders', () => {
  it('always includes X-Governance-Correlation', () => {
    const ctx = createCorrelationContext();
    const headers = correlationToHeaders(ctx);
    expect(headers['X-Governance-Correlation']).toBe(ctx.governanceCorrelationId);
  });

  it('includes X-Governance-Trace when traceId is present', () => {
    const ctx = createCorrelationContext({ incomingTraceId: 'trace-123' });
    const headers = correlationToHeaders(ctx);
    expect(headers['X-Governance-Trace']).toBe(ctx.governanceTraceId);
  });
});

describe('correlationFromHeaders', () => {
  it('returns null when no governance headers present', () => {
    const result = correlationFromHeaders({});
    expect(result).toBeNull();
  });

  it('parses correlation ID from headers', () => {
    const result = correlationFromHeaders({
      'x-governance-correlation': 'gcid_abc123',
    });
    expect(result).not.toBeNull();
    expect(result!.governanceCorrelationId).toBe('gcid_abc123');
  });

  it('includes traceId when present', () => {
    const result = correlationFromHeaders({
      'x-governance-correlation': 'gcid_abc',
      'x-governance-trace': 'gtid_xyz',
    });
    expect(result!.governanceTraceId).toBe('gtid_xyz');
  });
});
