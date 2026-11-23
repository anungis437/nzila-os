import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { casePolicyRole } from '@/lib/cases/case-permissions'
import { allowedGrievanceStatuses, grievanceTransitionContext } from '../grievance-transition-policy'

const now = new Date('2026-11-23T12:00:00Z')
const old = new Date('2026-11-14T12:00:00Z')
const source = {
  id: 'synthetic-grievance', status: 'settled' as const, unionRepId: 'synthetic-handler',
  representedMemberUserId: 'synthetic-member', priority: 'medium' as const,
  description: 'Recorded synthetic investigation and resolution documentation.',
  createdAt: old, updatedAt: now,
}
const authority = { canTransition: true, canCloseCase: true }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => vi.useRealTimers())

describe('the grievance action projection and locked write share stored facts', () => {
  it.each(['steward', 'chief_steward', 'officer', 'president', 'vice_president', 'secretary_treasurer', 'health_safety_rep', 'bargaining_committee'])(
    'offers documented mature closure to an authorized %s', role => {
      expect(allowedGrievanceStatuses(source, [], casePolicyRole(role)!, authority)).toEqual(['closed'])
    },
  )
  it('keeps the seven-day clock even after a later note or edit', () => {
    const events = [{ eventType: 'status_changed', createdAt: now }, { eventType: 'note_added', createdAt: old }]
    expect(allowedGrievanceStatuses(source, events, 'steward', authority)).toEqual([])
    const context = grievanceTransitionContext(source, events, 'steward', 'closed')
    expect(context?.statusChangedAt).toEqual(now)
    expect(grievanceTransitionContext(source, [{ eventType: 'note_added', createdAt: now }], 'steward', 'closed')?.statusChangedAt).toEqual(old)
  })
  it('cannot offer closure without documents, transition authority or primary closure authority', () => {
    expect(allowedGrievanceStatuses({ ...source, description: '' }, [], 'steward', authority)).toEqual([])
    expect(allowedGrievanceStatuses(source, [], 'steward', { ...authority, canTransition: false })).toEqual([])
    expect(allowedGrievanceStatuses(source, [], 'steward', { ...authority, canCloseCase: false })).toEqual([])
    expect(allowedGrievanceStatuses(source, [], 'unknown', authority)).toEqual([])
  })
  it('does not invent elapsed time for a recent case or accept an unknown state', () => {
    expect(allowedGrievanceStatuses({ ...source, createdAt: now }, [], 'steward', authority)).toEqual([])
    expect(grievanceTransitionContext(source, [], 'steward', 'unknown')).toBeNull()
    expect(grievanceTransitionContext(source, [], 'steward', 'withdrawn')).toBeNull()
    expect(grievanceTransitionContext(source, [], 'steward', 'denied')).toBeNull()
  })
})
