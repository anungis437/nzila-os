import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id' },
  icraMaturityProfiles: { assessmentId: 'assessmentId' },
}));

function mockTx(assessmentRow: unknown, profileRows: unknown[]) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    let selectCall = 0;
    const tx = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => (assessmentRow ? [assessmentRow] : [])) })) })) };
        }
        return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => profileRows) })) })) };
      }),
    };
    return fn(tx);
  });
}

async function loadModule() {
  return import('../get-profile');
}

describe('actions/icra/get-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
  });

  it('denies with reason "missing" when no capability token is passed (assessmentId alone is never sufficient)', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }, []);
    const { getAuthorizedIcraProfile } = await loadModule();
    const result = await getAuthorizedIcraProfile('a1', null);
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('denies with reason "not_found" when the assessment does not exist', async () => {
    mockTx(null, []);
    const { getAuthorizedIcraProfile } = await loadModule();
    const result = await getAuthorizedIcraProfile('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('denies with reason "invalid" for a token issued for a different assessment', async () => {
    mockTx({ capabilityTokenHash: createHash('sha256').update('other', 'utf8').digest('hex'), capabilityTokenExpiresAt: FUTURE }, []);
    const { getAuthorizedIcraProfile } = await loadModule();
    const result = await getAuthorizedIcraProfile('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('denies with reason "no_profile" when the capability is valid but no profile exists yet', async () => {
    mockTx({ capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }, []);
    const { getAuthorizedIcraProfile } = await loadModule();
    const result = await getAuthorizedIcraProfile('a1', TOKEN);
    expect(result).toEqual({ ok: false, reason: 'no_profile' });
  });

  it('returns the profile when the capability is valid', async () => {
    mockTx(
      { capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
      [{ profilePayload: { maturityBand: 'developing' } }],
    );
    const { getAuthorizedIcraProfile } = await loadModule();
    const result = await getAuthorizedIcraProfile('a1', TOKEN);
    expect(result).toEqual({ ok: true, profile: { maturityBand: 'developing' } });
  });
});
