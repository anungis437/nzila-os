// @vitest-environment jsdom
/**
 * The new-case form files a case with POST /api/cases/intake, whose failures answer { error: <code>, message: <sentence> } and whose success answers { success, claimId, ... } at the top
 * of the body. A refused intake is reported with the sentence, never with the code, and a success is followed by the case it created.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({ locale: 'en-CA', push: vi.fn(), toast: vi.fn(), trackCaseCreated: vi.fn(), incrementPilotCaseCount: vi.fn() }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => h.locale }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }))
vi.mock('@nzila/platform-auth/entra/client', () => ({ useUser: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }))
vi.mock('@/lib/hooks/use-pilot-tracking', () => ({ usePilotTracking: () => ({ trackCaseCreated: h.trackCaseCreated }) }))
vi.mock('@/components/pilot/pilot-feedback-widget', () => ({ incrementPilotCaseCount: h.incrementPilotCaseCount }))
vi.mock('@/components/voice-disclosure-consent', () => ({
  useVoiceDisclosure: () => ({ ready: false, notice: null, appendDisclosure: () => false }),
  VoiceDisclosurePrompt: () => null,
}))

import { NewClaimForm } from './new-claim-form'

const fetchMock = vi.fn()

const refused = (status: number, body: Record<string, unknown>) => ({ ok: false, status, json: async () => body })
const filed = (body: Record<string, unknown>) => ({ ok: true, status: 201, json: async () => body })

// The form also reads the session on mount (/api/auth/me): that request is answered on its own, whatever the intake answers.
const session = { ok: true, status: 200, json: async () => ({ user: { id: 'user-1', email: 'member@example.test' } }) }
const intakeAnswers = (answer: unknown) => fetchMock.mockImplementation(async (url: string) => (url === '/api/auth/me' ? session : answer))
const intakeCall = () => fetchMock.mock.calls.find(([url]) => url === '/api/cases/intake') as [string, { method: string; body: string }]

function fillAndSubmit(container: HTMLElement) {
  const form = within(container)
  fireEvent.change(form.getByLabelText('forms.caseTitle *'), { target: { value: 'Schedule changed without notice' } })
  fireEvent.change(form.getByLabelText('forms.category *'), { target: { value: 'Safety' } })
  fireEvent.change(form.getByLabelText('forms.detailedDescription *'), { target: { value: 'The schedule changed the night before.' } })
  fireEvent.change(form.getByLabelText('forms.whenOccurred *'), { target: { value: '2026-01-15' } })
  fireEvent.click(screen.getByRole('button', { name: /forms\.submitCase/ }))
}

beforeEach(() => {
  h.locale = 'en-CA'
  h.push.mockReset()
  h.toast.mockReset()
  h.trackCaseCreated.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewClaimForm', () => {
  it.each([17, { id: 'claim-9' }])('rejects a non-string case receipt before tracking or navigating: %j', async (claimId) => {
    intakeAnswers(filed({ success: true, claimId }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'claims.submitUnconfirmed' })))
    expect(h.trackCaseCreated).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
  })

  it('never requests the voice notice for a member, who is not offered voice, and opens submission once hydrated', async () => {
    intakeAnswers({ ok: true, status: 200, json: async () => ({}) })
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    await waitFor(() => expect(container.querySelector('form[data-hydrated="true"]')).not.toBeNull())
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/voice/disclosure')).toBe(false)
  })

  it('connects every editable intake control to its visible label', () => {
    intakeAnswers(filed({ success: true, claimId: 'claim-11' }))
    render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    for (const label of ['forms.caseTitle *', 'forms.category *', 'priority.label *', 'forms.detailedDescription *', 'forms.whenOccurred *', 'forms.location', 'forms.witnesses']) {
      expect(screen.getByLabelText(label)).toHaveAccessibleName(label)
    }
  })
  it('reports a refused intake with the sentence the route gives, not its code', async () => {
    intakeAnswers(refused(400, { error: 'VALIDATION_ERROR', message: 'Intake validation failed.' }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'Intake validation failed.' }))
    expect(h.toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'VALIDATION_ERROR' }))
    expect(h.trackCaseCreated).not.toHaveBeenCalled()
  })

  it('reports the framework\'s own failure body the same way, and falls back when the body names nothing', async () => {
    intakeAnswers(refused(403, { code: 'FORBIDDEN', message: 'Module access denied', timestamp: 'now', traceId: 't' }))
    const { container, unmount } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Module access denied' })))
    unmount()
    h.toast.mockReset()
    intakeAnswers(refused(500, {}))
    const second = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(second.container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'claims.submitFailed' })))
  })

  it('files the case for the signed-in member and follows the case id found at the top of the answer', async () => {
    intakeAnswers(filed({ success: true, claimId: 'claim-9', claimNumber: 'CASE-9', status: 'submitted', decision: 'allow' }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.trackCaseCreated).toHaveBeenCalledWith('claim-9'))
    const [url, init] = intakeCall()
    expect(url).toBe('/api/cases/intake')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({ memberId: 'user-1', title: 'Schedule changed without notice', caseType: 'safety', incidentDate: '2026-01-15' })
    // Anonymous filing is an opt-in: left unticked, the case is filed under the member's name.
    expect(JSON.parse(init.body)).toMatchObject({ isAnonymous: false })
    expect(h.incrementPilotCaseCount).toHaveBeenCalled()
  })

  it('files anonymously only when the member ticks the box, and says who will still see them', async () => {
    intakeAnswers(filed({ success: true, claimId: 'claim-10', claimNumber: 'CASE-10', status: 'submitted', decision: 'allow' }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    const box = screen.getByRole('checkbox', { name: 'forms.fileAnonymously' })
    expect(box).not.toBeChecked()
    expect(box).toHaveAccessibleDescription('forms.fileAnonymouslyHelp')
    fireEvent.click(box)
    fillAndSubmit(container)
    await waitFor(() => expect(h.trackCaseCreated).toHaveBeenCalledWith('claim-10'))
    const [, init] = intakeCall()
    expect(JSON.parse(init.body)).toMatchObject({ memberId: 'user-1', isAnonymous: true })
  })

  it('says the server did not confirm the case, instead of following nothing or claiming it failed outright', async () => {
    intakeAnswers(filed({ success: true, data: { claimId: 'claim-9' } }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'claims.submitUnconfirmed' })))
    expect(h.trackCaseCreated).not.toHaveBeenCalled()
  })
  it('words a refusal in French on a French page and never shows the route\'s English sentence', async () => {
    h.locale = 'fr-CA'
    intakeAnswers(refused(400, { code: 'VALIDATION_ERROR', message: 'Intake validation failed.' }))
    const { container } = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(container)
    await waitFor(() => expect(h.toast).toHaveBeenCalled())
    expect(h.toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'claims.submitFailedTitle', description: 'claims.submitFailed' })
    expect(JSON.stringify(h.toast.mock.calls)).not.toMatch(/Intake validation/)
  })

  it('words a refusal by its status in French, and a request that got no answer by the form\'s own message', async () => {
    h.locale = 'fr-CA'
    intakeAnswers(refused(403, { code: 'FORBIDDEN', message: 'Module access denied' }))
    const first = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(first.container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Vous n’avez pas l’autorisation d’effectuer cette action.' })))
    first.unmount()
    h.toast.mockReset()
    fetchMock.mockImplementation(async (url: string) => { if (url === '/api/auth/me') return session; throw new TypeError('Failed to fetch') })
    const second = render(<NewClaimForm canUseVoice={false} landOnSubmittedCase returnPath="/dashboard/claims" />)
    fillAndSubmit(second.container)
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'claims.submitFailed' })))
    expect(JSON.stringify(h.toast.mock.calls)).not.toMatch(/fetch/i)
  })
})
