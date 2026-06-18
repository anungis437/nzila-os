import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: h.auth }));

import { GovernanceService } from '../governance-service';

const okJson = (body: unknown) => ({ ok: true, json: async () => body, statusText: 'OK' });
const notOk = (statusText = 'Bad Request') => ({ ok: false, json: async () => ({}), statusText });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.auth.mockReset();
  h.auth.mockResolvedValue({ sessionId: 'sess-123' });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('governance-service', () => {
  const svc = () => new GovernanceService();

  it('issues a golden share (string and Date issueDate)', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 'gs-1' }));
    const r1 = await svc().issueGoldenShare({ certificateNumber: 'C1', issueDate: '2026-01-01', councilMembers: [] } as never);
    expect(r1).toEqual({ id: 'gs-1' });

    const r2 = await svc().issueGoldenShare({ certificateNumber: 'C2', issueDate: new Date('2026-02-02'), councilMembers: ['a'] } as never);
    expect(r2).toEqual({ id: 'gs-1' });
  });

  it('throws when issuing a golden share fails', async () => {
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().issueGoldenShare({ certificateNumber: 'C1', issueDate: '2026-01-01', councilMembers: [] } as never)).rejects.toThrow('Failed to issue golden share');
  });

  it('omits Authorization header when there is no session', async () => {
    h.auth.mockResolvedValue(null);
    fetchMock.mockResolvedValue(okJson({ ok: true }));
    await svc().checkGoldenShareStatus();
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('checks golden share status', async () => {
    fetchMock.mockResolvedValue(okJson({ status: 'active' }));
    expect(await svc().checkGoldenShareStatus()).toEqual({ status: 'active' });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().checkGoldenShareStatus()).rejects.toThrow('Failed to check status');
  });

  it('requests a reserved matter vote', async () => {
    fetchMock.mockResolvedValue(okJson({ voteId: 'v1' }));
    expect(await svc().requestReservedMatterVote({ matterType: 'm', title: 't', description: 'd', proposedBy: 'p' })).toEqual({ voteId: 'v1' });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().requestReservedMatterVote({ matterType: 'm', title: 't', description: 'd' })).rejects.toThrow('Failed to request vote');
  });

  it('records a Class A vote', async () => {
    fetchMock.mockResolvedValue(okJson({ recorded: true }));
    expect(await svc().recordClassAVote({ voteId: 'v1', votesFor: 5, votesAgainst: 1, abstain: 0 })).toEqual({ recorded: true });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().recordClassAVote({ voteId: 'v1', votesFor: 5, votesAgainst: 1, abstain: 0 })).rejects.toThrow('Failed to record Class A vote');
  });

  it('records a Class B vote', async () => {
    fetchMock.mockResolvedValue(okJson({ recorded: true }));
    expect(await svc().recordClassBVote({ voteId: 'v1', vote: 'approve', voteRationale: 'r', councilMembersVoting: ['a'] })).toEqual({ recorded: true });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().recordClassBVote({ voteId: 'v1', vote: 'veto', voteRationale: 'r', councilMembersVoting: [] })).rejects.toThrow('Failed to record Class B vote');
  });

  it('conducts a mission audit', async () => {
    fetchMock.mockResolvedValue(okJson({ audit: 'done' }));
    const data = {
      auditYear: 2026,
      auditPeriodStart: new Date('2026-01-01'),
      auditPeriodEnd: new Date('2026-12-31'),
      auditorFirm: 'F', auditorName: 'N', auditorCertification: 'C',
      unionRevenuePercent: 90, memberSatisfactionPercent: 80, dataViolations: 0,
    };
    expect(await svc().conductMissionAudit(data)).toEqual({ audit: 'done' });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().conductMissionAudit(data)).rejects.toThrow('Failed to conduct audit');
  });

  it('triggers the sunset clause', async () => {
    fetchMock.mockResolvedValue(okJson({ triggered: true }));
    expect(await svc().triggerSunsetClause('gs-1')).toEqual({ triggered: true });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().triggerSunsetClause('gs-1')).rejects.toThrow('Failed to trigger sunset');
  });

  it('converts a golden share', async () => {
    fetchMock.mockResolvedValue(okJson({ converted: true }));
    expect(await svc().convertGoldenShare('gs-1')).toEqual({ converted: true });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().convertGoldenShare('gs-1')).rejects.toThrow('Failed to convert share');
  });

  it('gets mission compliance years', async () => {
    fetchMock.mockResolvedValue(okJson([{ year: 2026 }]));
    expect(await svc().getMissionComplianceYears()).toEqual([{ year: 2026 }]);
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().getMissionComplianceYears()).rejects.toThrow('Failed to get compliance years');
  });

  it('conducts a council election', async () => {
    fetchMock.mockResolvedValue(okJson({ elected: true }));
    const data = { electionYear: 2026, electionDate: new Date('2026-03-01'), positionsAvailable: 3, candidates: [], winners: [], totalVotes: 100, participationRate: 0.5 };
    expect(await svc().conductCouncilElection(data)).toEqual({ elected: true });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().conductCouncilElection(data)).rejects.toThrow('Failed to conduct election');
  });

  it('gets the governance dashboard', async () => {
    fetchMock.mockResolvedValue(okJson({ dashboard: {} }));
    expect(await svc().getGovernanceDashboard()).toEqual({ dashboard: {} });
    fetchMock.mockResolvedValue(notOk());
    await expect(svc().getGovernanceDashboard()).rejects.toThrow('Failed to get dashboard');
  });

  describe('isReservedMatter', () => {
    it('flags reserved matter types', () => {
      expect(svc().isReservedMatter({ type: 'mission_change' }).isReserved).toBe(true);
    });
    it('flags large financial impact', () => {
      const r = svc().isReservedMatter({ type: 'other', financialImpact: 2_000_000 });
      expect(r.isReserved).toBe(true);
      expect(r.reason).toContain('$1M');
    });
    it('flags strategic change', () => {
      expect(svc().isReservedMatter({ type: 'other', strategicChange: true }).isReserved).toBe(true);
    });
    it('returns not reserved otherwise', () => {
      expect(svc().isReservedMatter({ type: 'other', financialImpact: 10 }).isReserved).toBe(false);
    });
  });
});
