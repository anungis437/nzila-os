import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIsFeatureEnabled, mockAuditLog } = vi.hoisted(() => ({
  mockIsFeatureEnabled: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/lib/services/feature-flags', () => ({
  isFeatureEnabled: mockIsFeatureEnabled,
}));

vi.mock('@/lib/audit-logger', () => ({
  auditLog: mockAuditLog,
  AuditSeverity: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  standardErrorResponse: vi.fn(() => ({ status: 500 })),
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: any, init?: { status?: number }) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

import { guardAiFeature, auditAiInteraction, buildAiEnvelope } from '../ai-feature-guard';

describe('guardAiFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when feature is enabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(true);
    const result = await guardAiFeature('test-feature', { organizationId: 'org-1' });
    expect(result).toBeNull();
  });

  it('returns 403 response when feature is disabled', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    const result = await guardAiFeature('test-feature', { organizationId: 'org-1' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('returns error response on exception', async () => {
    mockIsFeatureEnabled.mockRejectedValue(new Error('fail'));
    const result = await guardAiFeature('test-feature', { organizationId: 'org-1' });
    expect(result).not.toBeNull();
  });
});

describe('auditAiInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('returns an audit reference string', async () => {
    const ref = await auditAiInteraction({
      featureName: 'test',
      userId: 'user-1',
      organizationId: 'org-1',
      resource: 'grievances',
      action: 'triage',
    });
    expect(ref).toMatch(/^ai-test-/);
  });

  it('calls auditLog', async () => {
    await auditAiInteraction({
      featureName: 'test',
      resource: 'claims',
      action: 'analyze',
    });
    expect(mockAuditLog).toHaveBeenCalledOnce();
  });
});

describe('buildAiEnvelope', () => {
  it('wraps data with mandatory fields', () => {
    const result = buildAiEnvelope({ foo: 'bar' }, {
      confidence: 0.85,
      explanation: 'Test explanation',
      modelVersion: '1.0.0',
      auditRef: 'ai-test-123',
    });
    expect(result.available).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
    expect(result.confidence).toBe(0.85);
    expect(result.explanation).toBe('Test explanation');
    expect(result.modelVersion).toBe('1.0.0');
    expect(result.auditRef).toBe('ai-test-123');
    expect(result.disclaimer).toBeDefined();
    expect(result.disclaimer).toContain('bounded organizational intelligence');
  });
});
