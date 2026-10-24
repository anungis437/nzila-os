import { describe, expect, it } from 'vitest'
import { checkSessionDeletion, checkSessionUpdate } from '../session-lifecycle'

describe('voting session lifecycle (UE-CONV-K-009)', () => {
  it.each([
    ['draft', 'active'], ['draft', 'cancelled'], ['active', 'paused'], ['active', 'closed'], ['active', 'cancelled'],
    ['paused', 'active'], ['paused', 'closed'], ['paused', 'cancelled'],
  ])('allows %s -> %s', (from, to) => {
    expect(checkSessionUpdate(from, { status: to })).toEqual({ ok: true })
  })

  it.each([
    ['closed', 'active'], ['closed', 'draft'], ['cancelled', 'active'], ['active', 'draft'], ['draft', 'closed'], ['draft', 'paused'], ['paused', 'draft'],
  ])('refuses %s -> %s', (from, to) => {
    expect(checkSessionUpdate(from, { status: to })).toMatchObject({ ok: false, code: 'ILLEGAL_TRANSITION' })
  })

  it('refuses a status the contract does not define, and an unrecognised current status', () => {
    expect(checkSessionUpdate('active', { status: 'certified' })).toMatchObject({ ok: false, code: 'ILLEGAL_TRANSITION' })
    expect(checkSessionUpdate('active', { status: '__proto__' })).toMatchObject({ ok: false, code: 'ILLEGAL_TRANSITION' })
    expect(checkSessionUpdate('constructor', { status: 'active' })).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
    expect(checkSessionUpdate('', {})).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
  })

  it('lets a draft be edited freely, and locks every term once the session has opened', () => {
    expect(checkSessionUpdate('draft', { title: 'x', description: 'y', startTime: new Date(), endTime: new Date() })).toEqual({ ok: true })
    for (const status of ['active', 'paused', 'closed', 'cancelled']) {
      for (const field of ['title', 'description', 'startTime', 'endTime']) {
        expect(checkSessionUpdate(status, { [field]: 'changed' })).toMatchObject({ ok: false, code: 'TERMS_LOCKED' })
      }
    }
  })

  it('allows a status transition with no term change on an open session, and a no-op status', () => {
    expect(checkSessionUpdate('active', { status: 'paused' })).toEqual({ ok: true })
    expect(checkSessionUpdate('closed', { status: 'closed' })).toEqual({ ok: true })
    expect(checkSessionUpdate('active', { status: 'closed', title: 'renamed' })).toMatchObject({ ok: false, code: 'TERMS_LOCKED' })
  })

  it('deletes only a draft with no ballots', () => {
    expect(checkSessionDeletion('draft', 0)).toEqual({ ok: true })
    expect(checkSessionDeletion('draft', 1)).toMatchObject({ ok: false, code: 'HAS_BALLOTS' })
    for (const status of ['active', 'paused', 'closed', 'cancelled']) expect(checkSessionDeletion(status, 0)).toMatchObject({ ok: false, code: 'NOT_DRAFT' })
    expect(checkSessionDeletion('weird', 0)).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
  })
})
