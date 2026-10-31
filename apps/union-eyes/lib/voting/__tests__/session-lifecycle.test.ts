import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkSessionDeletion, checkSessionExtension, checkSessionUpdate, checkVotingInstrumentChange, type LoadedSessionExtensionGrant } from '../session-lifecycle'

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

  it('changes options, eligibility and proxies only while the session is a draft', () => {
    expect(checkVotingInstrumentChange('draft')).toEqual({ ok: true })
    for (const status of ['active', 'paused', 'closed', 'cancelled']) {
      expect(checkVotingInstrumentChange(status)).toMatchObject({ ok: false, code: 'INSTRUMENT_LOCKED' })
    }
    expect(checkVotingInstrumentChange('certified')).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
  })

  it('extends an open session only for a kernel grant naming that session', () => {
    const grant: LoadedSessionExtensionGrant = {
      loadedBy: 'authority-kernel',
      action: 'voting:extend_session',
      organizationId: 'org-1',
      sessionId: 'session-1',
      issued: true,
    }
    expect(checkSessionExtension('active', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toEqual({ ok: true })
    expect(checkSessionExtension('paused', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toEqual({ ok: true })
    expect(checkSessionExtension('active', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', null)).toMatchObject({ ok: false, code: 'EXTENSION_UNISSUED' })
    expect(checkSessionExtension('active', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', { ...grant, sessionId: 'other' })).toMatchObject({ ok: false, code: 'EXTENSION_UNISSUED' })
    expect(checkSessionExtension('active', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', { ...grant, issued: false as true })).toMatchObject({ ok: false, code: 'EXTENSION_UNISSUED' })
    expect(checkSessionExtension('active', 'org-1', 'session-1', undefined, grant)).toMatchObject({ ok: false, code: 'EXTENSION_UNISSUED' })
    expect(checkSessionExtension('draft', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toMatchObject({ ok: false, code: 'EXTENSION_NOT_OPEN' })
    expect(checkSessionExtension('closed', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toMatchObject({ ok: false, code: 'EXTENSION_TERMINAL' })
    expect(checkSessionExtension('cancelled', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toMatchObject({ ok: false, code: 'EXTENSION_TERMINAL' })
    expect(checkSessionExtension('weird', 'org-1', 'session-1', '2030-01-01T00:00:00.000Z', grant)).toMatchObject({ ok: false, code: 'UNKNOWN_STATUS' })
  })

  it('keeps the session route from treating a request field as an extension grant', () => {
    const source = readFileSync(join(__dirname, '..', '..', '..', 'app', 'api', 'voting', 'sessions', '[id]', 'route.ts'), 'utf8')
    expect(source).toContain('checkSessionUpdate')
    expect(source).not.toContain('checkSessionExtension')
  })
})
