import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ withRLSContext: vi.fn(), requireLive: vi.fn(), tx: { marker: 'tx' } }))

vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }))
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLive }))
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: 403 }),
}))

import { assertFinanceViewMandate, financeViewMandateDenial } from '../finance-view-mandate'

describe('finance view mandate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.withRLSContext.mockImplementation(async (_ctx: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx))
  })

  it('asks for a live finance:view mandate in the caller\'s own tenant context', async () => {
    m.requireLive.mockResolvedValue({})
    await assertFinanceViewMandate('org-1', 'user-1')
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'user-1' }, expect.any(Function))
    expect(m.requireLive).toHaveBeenCalledWith(m.tx, { organizationId: 'org-1', userId: 'user-1', action: 'finance:view' })
  })

  it('requires resource-scoped financial authority for pension intelligence, not merely an unrelated mandate', async () => {
    m.requireLive.mockResolvedValueOnce({});
    await assertFinanceViewMandate('org-1', 'user-1', 'plan-1');
    expect(m.requireLive).toHaveBeenCalledWith(m.tx, {
      organizationId: 'org-1', userId: 'user-1', action: 'finance:view', resourceId: 'plan-1',
    });
    m.requireLive.mockRejectedValueOnce(new Error('unrelated plan mandate'));
    expect((await financeViewMandateDenial('org-1', 'user-1', 'plan-2'))?.status).toBe(403);
  });

  it('lets the mandate refusal through unchanged', async () => {
    m.requireLive.mockRejectedValue(new Error('no mandate'))
    await expect(assertFinanceViewMandate('org-1', 'user-1')).rejects.toThrow('no mandate')
  })

  it('answers null for a holder and 403 for anyone else', async () => {
    m.requireLive.mockResolvedValueOnce({})
    expect(await financeViewMandateDenial('org-1', 'user-1')).toBeNull()
    m.requireLive.mockRejectedValueOnce(new Error('no mandate'))
    expect((await financeViewMandateDenial('org-1', 'user-2'))!.status).toBe(403)
  })
})
