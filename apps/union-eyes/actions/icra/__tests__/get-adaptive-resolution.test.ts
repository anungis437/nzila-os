import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  eq: vi.fn(),
  resolveAdaptiveContext: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id', organizationContext: 'organizationContext' },
}));
vi.mock('@/lib/icra/adaptation', () => ({ resolveAdaptiveContext: m.resolveAdaptiveContext }));
vi.mock('@/lib/icra/questions', () => ({ ALL_QUESTIONS: [], QUESTION_BANK_VERSION: 'v1' }));

function mockTx(assessmentRow: unknown) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => (assessmentRow ? [assessmentRow] : [])) })),
        })),
      })),
    };
    return fn(tx);
  });
}

async function loadModule() {
  return import('../get-adaptive-resolution');
}

describe('actions/icra/get-adaptive-resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
  });

  it('denies with reason "missing" when no capability token is passed (assessmentId alone is never sufficient)', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE, organizationContext: {} });
    const { getIcraAdaptiveResolution } = await loadModule();
    const result = await getIcraAdaptiveResolution('a1', null);
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('denies with reason "not_found" when the assessment does not exist', async () => {
    mockTx(null);
    const { getIcraAdaptiveResolution } = await loadModule();
    const result = await getIcraAdaptiveResolution('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('denies with reason "invalid" for a token issued for a different assessment', async () => {
    mockTx({
      capabilityTokenHash: createHash('sha256').update('other', 'utf8').digest('hex'),
      capabilityTokenExpiresAt: FUTURE,
      organizationContext: {},
    });
    const { getIcraAdaptiveResolution } = await loadModule();
    const result = await getIcraAdaptiveResolution('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('denies with reason "expired" for an expired capability', async () => {
    mockTx({
      capabilityTokenHash: TOKEN_HASH,
      capabilityTokenExpiresAt: new Date(Date.now() - 60_000),
      organizationContext: {},
    });
    const { getIcraAdaptiveResolution } = await loadModule();
    const result = await getIcraAdaptiveResolution('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('resolves the adaptive context when the capability is valid', async () => {
    mockTx({
      capabilityTokenHash: TOKEN_HASH,
      capabilityTokenExpiresAt: FUTURE,
      organizationContext: { size: 'large' },
    });
    m.resolveAdaptiveContext.mockReturnValue({ kind: 'persisted' });
    const { getIcraAdaptiveResolution } = await loadModule();
    const result = await getIcraAdaptiveResolution('a1', TOKEN);
    expect(result).toEqual({ ok: true, resolution: { kind: 'persisted' } });
    expect(m.resolveAdaptiveContext).toHaveBeenCalled();
  });
});
