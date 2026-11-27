// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/en-CA.json'
const port = vi.hoisted(() => ({ nominate: vi.fn(), back: vi.fn() }))
// UI outcome port only. Actual action/session/storage authority has separate
// canonical component proofs; this suite makes no authentication claim.
vi.mock('@/actions/rewards-actions', () => ({ nominatePeer: port.nominate }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ back: port.back }) }))
import { PeerNominationForm } from './peer-nomination-form'

const typeId = '33333333-3333-4333-8333-333333333333'
function show() {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={messages}>
      <PeerNominationForm
        awardTypes={[{ id: typeId, name: 'Team player' }]}
        candidates={[
          { userId: 'me', name: 'Myself' },
          { userId: 'colleague', name: 'Colleague' },
        ]}
        currentUserId="me"
      />
    </NextIntlClientProvider>,
  )
}
async function submit() {
  const boxes = screen.getAllByRole('combobox')
  fireEvent.change(boxes[0], { target: { value: 'colleague' } })
  fireEvent.change(boxes[1], { target: { value: typeId } })
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Thank you for helping our colleague' },
  })
  fireEvent.submit(screen.getByRole('textbox').closest('form')!)
  await waitFor(() => expect(port.nominate).toHaveBeenCalledTimes(1))
}
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
})
describe('supported peer text form', () => {
  it('shows category names without promising credits or offering self nomination', () => {
    show()
    expect(screen.getByRole('option', { name: 'Team player' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Myself' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Team player \(/)).not.toBeInTheDocument()
  })
  it('reports success only when the action returns an actual stored row', async () => {
    port.nominate.mockResolvedValue({
      success: true,
      data: { id: 'stored-nomination', status: 'pending' },
    })
    show()
    await submit()
    expect(port.nominate).toHaveBeenCalledWith({
      awardTypeId: typeId,
      recipientUserId: 'colleague',
      reason: 'Thank you for helping our colleague',
    })
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  })
  it('keeps a refusal visible and does not claim a stored nomination', async () => {
    port.nominate.mockResolvedValue({ success: false, error: 'Membership changed' })
    show()
    await submit()
    await waitFor(() => expect(screen.getByText('Membership changed')).toBeInTheDocument())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('does not claim success when an action returns no stored row', async () => {
    port.nominate.mockResolvedValue({ success: true, data: null })
    show()
    await submit()
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
