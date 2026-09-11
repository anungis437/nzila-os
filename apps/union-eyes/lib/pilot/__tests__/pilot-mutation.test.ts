import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQL } from 'drizzle-orm';

const m = vi.hoisted(() => {
  const state = { selectQueue: [] as unknown[][] };
  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const updateCalls: Array<{ setValues: Record<string, unknown> }> = [];

  const fakeTx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            for: vi.fn(() => nextSelect()),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setValues: Record<string, unknown>) => {
        updateCalls.push({ setValues });
        return { where: vi.fn(async () => []) };
      }),
    })),
  };

  return {
    state,
    updateCalls,
    fakeTx,
    hasMinRole: vi.fn(),
    authorizePilotAccess: vi.fn(),
    getPilotEffectiveOrganizationId: vi.fn(() => 'test-org'),
    withSystemContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)),
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    reset: () => {
      state.selectQueue = [];
      updateCalls.length = 0;
    },
  };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: m.hasMinRole,
}));
vi.mock('@/lib/pilot/pilot-ownership', () => ({
  authorizePilotAccess: m.authorizePilotAccess,
  getPilotEffectiveOrganizationId: m.getPilotEffectiveOrganizationId,
}));

async function loadModule() {
  return import('../pilot-mutation');
}

describe('withLockedPilotMutation (PR #752 round 25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reset();
    m.hasMinRole.mockResolvedValue(true);
    m.authorizePilotAccess.mockResolvedValue({ ok: true, reason: 'platform', actorOrganizationId: null });
    m.getPilotEffectiveOrganizationId.mockReturnValue('test-org');
  });

  it('returns 403 without touching the database when the role gate fails', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.hasMinRole.mockResolvedValueOnce(false);

    const mutate = vi.fn();
    const outcome = await withLockedPilotMutation('pilot-1', 'steward', mutate);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(403);
      await expect(outcome.response.json()).resolves.toEqual({ error: 'Forbidden' });
    }
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('returns 404 when the locked SELECT ... FOR UPDATE finds no row', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.queueSelect([]);

    const mutate = vi.fn();
    const outcome = await withLockedPilotMutation('missing-pilot', 'steward', mutate);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(404);
      await expect(outcome.response.json()).resolves.toEqual({ error: 'Pilot application not found' });
    }
    expect(mutate).not.toHaveBeenCalled();
  });

  it('re-authorizes against the LOCKED row and rejects when a concurrent rebind moved ownership (TOCTOU close)', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.queueSelect([{ id: 'pilot-1', responses: {}, verifiedOrganizationId: 'org-b' }]);
    m.authorizePilotAccess.mockResolvedValueOnce({ ok: false, status: 403, reason: 'cross-org' });

    const mutate = vi.fn();
    const outcome = await withLockedPilotMutation('pilot-1', 'steward', mutate);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(403);
      await expect(outcome.response.json()).resolves.toEqual({ error: 'Forbidden' });
    }
    // The ownership decision was evaluated against the row this call itself
    // locked — never an earlier, unlocked snapshot the caller might have had.
    expect(m.getPilotEffectiveOrganizationId).toHaveBeenCalledWith({ id: 'pilot-1', responses: {}, verifiedOrganizationId: 'org-b' });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('returns 401 when the ownership decision is unauthenticated', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.queueSelect([{ id: 'pilot-1', responses: {} }]);
    m.authorizePilotAccess.mockResolvedValueOnce({ ok: false, status: 401, reason: 'unauthenticated' });

    const outcome = await withLockedPilotMutation('pilot-1', 'steward', vi.fn());

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.response.status).toBe(401);
      await expect(outcome.response.json()).resolves.toEqual({ error: 'Unauthorized' });
    }
  });

  it('merges only the returned responsesPatch keys — never a full-column replace', async () => {
    const { withLockedPilotMutation } = await loadModule();
    const lockedRow = { id: 'pilot-1', responses: { commercialState: 'contract_signed', pilotIntelligence: { old: true } } };
    m.queueSelect([lockedRow]);

    const outcome = await withLockedPilotMutation('pilot-1', 'steward', async ({ application }) => {
      expect(application).toBe(lockedRow); // mutate receives the FRESH locked row, not a stale snapshot
      return { responsesPatch: { pilotIntelligence: { old: false, added: true } }, data: { ok: true } };
    });

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data).toEqual({ ok: true });
    }
    expect(m.fakeTx.update).toHaveBeenCalledTimes(1);
    expect(m.updateCalls).toHaveLength(1);
    // Only `responses` was set, as a merge SQL fragment — commercialState is
    // never mentioned, so a concurrent write to it cannot be reverted here.
    expect(m.updateCalls[0].setValues.responses).toBeInstanceOf(SQL);
    expect(Object.keys(m.updateCalls[0].setValues)).toEqual(['responses']);
  });

  it('skips the write entirely when mutate returns no responsesPatch (e.g. a no-op "already exists" branch)', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.queueSelect([{ id: 'pilot-1', responses: {} }]);

    const outcome = await withLockedPilotMutation('pilot-1', 'steward', async () => ({
      data: { persisted: false },
    }));

    expect(outcome.ok).toBe(true);
    expect(m.fakeTx.update).not.toHaveBeenCalled();
  });

  it('propagates a genuine (non-rejection) error thrown by mutate instead of swallowing it', async () => {
    const { withLockedPilotMutation } = await loadModule();
    m.queueSelect([{ id: 'pilot-1', responses: {} }]);

    await expect(
      withLockedPilotMutation('pilot-1', 'steward', async () => {
        throw new Error('unexpected business logic bug');
      }),
    ).rejects.toThrow('unexpected business logic bug');
  });
});
