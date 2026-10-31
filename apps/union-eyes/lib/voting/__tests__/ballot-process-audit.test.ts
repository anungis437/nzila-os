import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  ballotProcessLinksChoice,
  recordBallotAcceptance,
  recordBallotEligibility,
  recordProxyAuthorization,
  recordRecount,
} from '../ballot-process-audit'

const persistAtomicAudit = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit }))

const ORG = '11111111-1111-4111-8111-111111111111'
const SESSION = '22222222-2222-4222-8222-222222222222'
const tx = {} as never

describe('secret ballot process audit', () => {
  it('refuses a record that names a person and a choice together', () => {
    expect(ballotProcessLinksChoice({ memberId: 'm', optionId: 'o' })).toBe(true)
    expect(ballotProcessLinksChoice({ voterId: 'v', choice: 'yes' })).toBe(true)
    expect(ballotProcessLinksChoice({ userId: 'u', selection: 'a' })).toBe(true)
    expect(ballotProcessLinksChoice({ proxyMemberId: 'p', preference: '1' })).toBe(true)
    expect(ballotProcessLinksChoice({ memberId: 'm' })).toBe(false)
    expect(ballotProcessLinksChoice({ optionId: 'o' })).toBe(false)
    expect(ballotProcessLinksChoice({ receiptId: 'r', choiceRecorded: false })).toBe(false)
  })

  it('audits eligibility, acceptance, proxy authorization and recount without that link', async () => {
    persistAtomicAudit.mockClear()
    await recordBallotEligibility(tx, { organizationId: ORG, sessionId: SESSION, memberId: 'member-1' })
    await recordBallotAcceptance(tx, { organizationId: ORG, sessionId: SESSION, receiptId: 'receipt-1' })
    await recordProxyAuthorization(tx, { organizationId: ORG, sessionId: SESSION, memberId: 'member-1', proxyMemberId: 'member-2' })
    await recordRecount(tx, { organizationId: ORG, sessionId: SESSION, totalBallots: 4 })

    const details = persistAtomicAudit.mock.calls.map((call) => call[1].details)
    expect(details).toEqual([
      { sessionId: SESSION, memberId: 'member-1', eligible: true },
      { sessionId: SESSION, receiptId: 'receipt-1', choiceRecorded: false },
      { sessionId: SESSION, memberId: 'member-1', proxyMemberId: 'member-2' },
      { sessionId: SESSION, totalBallots: 4, voterChoiceLinked: false },
    ])
    for (const entry of persistAtomicAudit.mock.calls.map((call) => call[1])) {
      expect(entry.userId).toBeUndefined()
      expect(ballotProcessLinksChoice(entry.details)).toBe(false)
    }
    await expect(recordRecount(tx, { organizationId: ORG, sessionId: SESSION, totalBallots: -1 })).rejects.toThrow(/non-negative/)
  })

  it('keeps the casting routes free of a choice audit and of a voter-linked evidence pack', () => {
    const api = join(__dirname, '..', '..', '..', 'app', 'api')
    for (const route of ['voting/sessions/[id]/vote/route.ts', 'governance/elections/sessions/[id]/vote/route.ts']) {
      const source = readFileSync(join(api, route), 'utf8')
      expect(source).toContain('recordBallotAcceptance')
      expect(source).not.toMatch(/persistAtomicAudit/)
      expect(source).not.toMatch(/actorId/)
      expect(source).not.toMatch(/optionId:\s*body|optionId:\s*parsed/)
    }
    const helper = readFileSync(join(__dirname, '..', 'ballot-process-audit.ts'), 'utf8')
    expect(helper).not.toMatch(/userId:/)
  })
})
