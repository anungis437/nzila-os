// @vitest-environment jsdom
/**
 * The rewards forms submit through the real server actions (rewards-actions) with only the request boundary and the services replaced:
 * the signed-in member, the membership lookup, the transaction and the rewards services (the store is a service too). What is proved is what
 * the person sees when the action stores a row, refuses, or fails, and what the action is given.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/messages/en-CA.json'

const ORG = '11111111-1111-4111-8111-111111111111'
const PROGRAM = '22222222-2222-4222-8222-222222222222'
const PEER_TYPE = '33333333-3333-4333-8333-333333333333'
const AWARD = '44444444-4444-4444-8444-444444444444'
const REDEMPTION = '55555555-5555-4555-8555-555555555555'

const h = vi.hoisted(() => ({
  nav: { refresh: vi.fn(), back: vi.fn(), push: vi.fn() },
  signedInRole: 'member',
  recipientIsActiveMember: true,
  svc: {
    createPeerNomination: vi.fn(),
    createAwardRequest: vi.fn(),
    approveAward: vi.fn(),
    issueAward: vi.fn(),
    rejectAward: vi.fn(),
    getProgramById: vi.fn(),
    initiateRedemption: vi.fn(),
    cancelRedemption: vi.fn(),
    updateRedemptionCheckout: vi.fn(),
  },
  store: { createDiscountCode: vi.fn(), createCheckoutSession: vi.fn(), isStoreCheckoutUrl: vi.fn() },
  loggerError: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => h.nav }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: 'me' }) }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: async () => ORG }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, work: (tx: unknown) => Promise<unknown>) =>
    work({
      query: {
        organizationMembers: {
          // The role check passes a where callback; the recipient check a column list and a condition.
          findFirst: (options?: { columns?: unknown }) =>
            options?.columns ? (h.recipientIsActiveMember ? { id: 'member-row' } : undefined) : { organizationId: ORG, role: h.signedInRole },
        },
      },
    }),
}))
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}))
vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', organizationId: 'organizationId', userId: 'userId', status: 'status', deletedAt: 'deletedAt' },
}))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError } }))
vi.mock('@/lib/services/rewards', () => h.svc)
vi.mock('@/lib/services/rewards/audit', () => ({ auditRewards: vi.fn() }))
vi.mock('@/lib/services/rewards/shopify-service', () => h.store)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { PeerNominationForm } from './peer-nomination-form'
import { RedemptionForm } from './redemption-form'
import { AwardsQueue, type QueuedAward } from './admin/awards-queue'
import { CreateAwardDialog } from './admin/create-award-dialog'
import { UserFacingError } from '@/lib/errors/user-facing-error'

function renderWithMessages(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  h.signedInRole = 'member'
  h.recipientIsActiveMember = true
  h.svc.createPeerNomination.mockResolvedValue({ id: AWARD, status: 'pending' })
  h.svc.createAwardRequest.mockResolvedValue({ id: AWARD, status: 'pending' })
  h.svc.approveAward.mockResolvedValue({ id: AWARD })
  h.svc.issueAward.mockResolvedValue({ id: AWARD })
  h.svc.rejectAward.mockResolvedValue({ id: AWARD })
  h.svc.getProgramById.mockResolvedValue({ id: PROGRAM, orgId: ORG })
  h.svc.initiateRedemption.mockResolvedValue({ id: REDEMPTION })
  h.svc.cancelRedemption.mockResolvedValue({ id: REDEMPTION })
  h.svc.updateRedemptionCheckout.mockResolvedValue({ id: REDEMPTION })
  h.store.createDiscountCode.mockResolvedValue({ code: 'DISC' })
  h.store.createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://shop.example/cart?discount=DISC' })
  h.store.isStoreCheckoutUrl.mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('the peer nomination form', () => {
  const awardTypes = [{ id: PEER_TYPE, name: 'Team player', defaultCreditAmount: 25 }]
  const candidates = [
    { userId: 'me', name: 'Me Myself' },
    { userId: 'bob', name: 'Bob Tremblay' },
    { userId: 'ann', name: 'Ann Roy' },
  ]

  async function fillIn(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText('Colleague'), 'Bob Tremblay')
    await user.selectOptions(screen.getByLabelText('Award'), 'Team player (25)')
    await user.type(screen.getByLabelText('Why do they deserve it?'), 'Covered my shift twice')
  }

  it('offers colleagues by name only, never the person themselves and never an e-mail address', () => {
    const { container } = renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)

    const options = within(screen.getByLabelText('Colleague')).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Select a colleague', 'Bob Tremblay', 'Ann Roy'])
    expect(container.textContent).not.toContain('@')
  })

  it('sends the nomination through the real action, as the signed-in member in their organization, and says it was submitted only once a row was stored', async () => {
    const user = userEvent.setup()
    renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)
    await fillIn(user)

    expect(screen.queryByText(/submitted for review/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByText(/Your nomination was submitted for review/)).toBeInTheDocument()
    expect(h.svc.createPeerNomination).toHaveBeenCalledWith({
      orgId: ORG,
      nominatorUserId: 'me',
      awardTypeId: PEER_TYPE,
      recipientUserId: 'bob',
      reason: 'Covered my shift twice',
    })
    expect(screen.getByLabelText('Why do they deserve it?')).toHaveValue('')
  })

  it('shows the reason the server gives for refusing, and no success', async () => {
    h.svc.createPeerNomination.mockRejectedValue(new UserFacingError('You have already nominated this colleague for this award; it is waiting for review'))
    const user = userEvent.setup()
    renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)
    await fillIn(user)

    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByText(/already nominated this colleague/)).toBeInTheDocument()
    expect(screen.queryByText(/submitted for review/)).not.toBeInTheDocument()
  })

  it('does not show what the database said when an unexpected failure happens', async () => {
    h.svc.createPeerNomination.mockRejectedValue(new Error('insert into "recognition_awards" violates row-level security policy'))
    const user = userEvent.setup()
    const { container } = renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)
    await fillIn(user)

    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByText(/Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/recognition_awards|row-level security/)
    expect(screen.queryByText(/submitted for review/)).not.toBeInTheDocument()
  })

  it('is not a success when the service stored no row', async () => {
    h.svc.createPeerNomination.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)
    await fillIn(user)

    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/submitted for review/)).not.toBeInTheDocument()
  })

  it('tells a colleague who is no longer a member that they cannot be nominated, and stores nothing', async () => {
    h.recipientIsActiveMember = false
    const user = userEvent.setup()
    renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)
    await fillIn(user)

    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByText('Recipient is not an active member of this organization')).toBeInTheDocument()
    expect(h.svc.createPeerNomination).not.toHaveBeenCalled()
  })

  it('asks for the missing fields before it calls the action at all', async () => {
    const user = userEvent.setup()
    renderWithMessages(<PeerNominationForm awardTypes={awardTypes} candidates={candidates} currentUserId="me" />)

    await user.click(screen.getByRole('button', { name: 'Submit nomination' }))

    expect(await screen.findByText(/Choose a colleague and an award, and say why/)).toBeInTheDocument()
    expect(h.svc.createPeerNomination).not.toHaveBeenCalled()
  })

  it('says there is nothing to nominate for when the program has no peer award', () => {
    renderWithMessages(<PeerNominationForm awardTypes={[]} candidates={candidates} currentUserId="me" />)

    expect(screen.getByText('No peer awards are open for nominations yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit nomination' })).not.toBeInTheDocument()
  })
})

describe('the redemption form', () => {
  async function redeem(user: ReturnType<typeof userEvent.setup>, credits: string, notes?: string) {
    await user.type(screen.getByLabelText('Credits to Redeem'), credits)
    if (notes) await user.type(screen.getByLabelText('Notes (Optional)'), notes)
    await user.click(screen.getByRole('button', { name: /Submit Redemption Request|Continue to Shop Moi Ça/ }))
  }

  it('sends exactly what the action accepts, as the signed-in member, and reports the request only once a row was recorded', async () => {
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="manual" programId={PROGRAM} />)

    await redeem(user, '25', 'size M')

    expect(await screen.findByText(/Your redemption request was recorded and 25 credits were deducted/)).toBeInTheDocument()
    expect(h.svc.getProgramById).toHaveBeenCalledWith(PROGRAM, ORG)
    expect(h.svc.initiateRedemption).toHaveBeenCalledWith({
      orgId: ORG,
      userId: 'me',
      programId: PROGRAM,
      creditsToSpend: 25,
      providerDetails: { requestNotes: 'size M' },
      provider: 'shopify',
    })
    expect(h.nav.refresh).toHaveBeenCalled()
  })

  it('sends no notes when there are none', async () => {
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="manual" programId={PROGRAM} />)

    await redeem(user, '10')

    await screen.findByText(/were deducted/)
    expect(h.svc.initiateRedemption).toHaveBeenCalledWith(expect.not.objectContaining({ providerDetails: expect.anything() }))
  })

  it.each([
    ['more credits than the balance', '101', 'You do not have enough credits'],
    ['no credits', '0', 'Please enter a valid amount'],
    ['a part of a credit', '2.5', 'Please enter a valid amount'],
  ])('does not call the action for %s', async (_what, credits, message) => {
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="manual" programId={PROGRAM} />)

    await redeem(user, credits)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(h.svc.initiateRedemption).not.toHaveBeenCalled()
  })

  it('shows the reason the server gives for refusing, and no confirmation', async () => {
    h.svc.initiateRedemption.mockRejectedValue(new UserFacingError('Insufficient balance: 100 credits, 500 requested'))
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="manual" programId={PROGRAM} />)

    await redeem(user, '50')

    expect(await screen.findByText(/Insufficient balance/)).toBeInTheDocument()
    expect(screen.queryByText(/were deducted/)).not.toBeInTheDocument()
    expect(h.nav.refresh).not.toHaveBeenCalled()
  })

  it('sends the member to the checkout of the store, once the credits were spent and the checkout recorded', async () => {
    vi.stubEnv('SHOPIFY_ENABLED', 'true')
    const navigate = vi.fn()
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="shopify" programId={PROGRAM} navigate={navigate} />)

    await redeem(user, '20')

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://shop.example/cart?discount=DISC'))
    expect(h.svc.updateRedemptionCheckout).toHaveBeenCalledWith(REDEMPTION, ORG, 'DISC', 'https://shop.example/cart?discount=DISC', 'me')
  })

  it('gives the credits back and shows nothing was redeemed when the store cannot be reached', async () => {
    vi.stubEnv('SHOPIFY_ENABLED', 'true')
    h.store.createDiscountCode.mockRejectedValue(new Error('shopify down'))
    const navigate = vi.fn()
    const user = userEvent.setup()
    renderWithMessages(<RedemptionForm balance={100} mode="shopify" programId={PROGRAM} navigate={navigate} />)

    await redeem(user, '20')

    expect(await screen.findByText(/nothing was redeemed and your credits were not spent/)).toBeInTheDocument()
    expect(h.svc.cancelRedemption).toHaveBeenCalledWith(REDEMPTION, ORG, 'The store could not create the checkout', { userId: 'me', mustOwn: true })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('cannot be submitted with no credits to redeem', () => {
    renderWithMessages(<RedemptionForm balance={0} mode="manual" programId={PROGRAM} />)

    expect(screen.getByRole('button', { name: 'Submit Redemption Request' })).toBeDisabled()
    expect(screen.getByText('You need credits to redeem')).toBeInTheDocument()
  })
})

describe('the awards queue', () => {
  const award = (overrides: Partial<QueuedAward> = {}): QueuedAward => ({
    id: AWARD,
    recipientUserId: 'bob',
    issuerUserId: 'ann',
    reason: 'Covered my shift twice',
    createdAt: '2026-03-01T12:00:00.000Z',
    awardTypeId: PEER_TYPE,
    awardType: { name: 'Team player', defaultCreditAmount: 25 },
    ...overrides,
  })
  const names = { bob: 'Bob Tremblay', ann: 'Ann Roy' }

  it('shows who was nominated, by whom and why, by name, so an administrator can judge it', () => {
    renderWithMessages(<AwardsQueue awards={[award()]} status="pending_approval" names={names} />)

    expect(screen.getByText('Bob Tremblay')).toBeInTheDocument()
    expect(screen.getByText('Ann Roy')).toBeInTheDocument()
    expect(screen.getByText('Covered my shift twice')).toBeInTheDocument()
    expect(screen.getByText('Team player')).toBeInTheDocument()
  })

  it('shows the id of a person who is not a member any more rather than nobody', () => {
    renderWithMessages(<AwardsQueue awards={[award({ recipientUserId: 'gone-user' })]} status="pending_approval" names={names} />)

    expect(screen.getByText('gone-user')).toBeInTheDocument()
  })

  it('approves through the real action as the signed-in administrator, and refreshes the queue', async () => {
    h.signedInRole = 'admin'
    const user = userEvent.setup()
    renderWithMessages(<AwardsQueue awards={[award()]} status="pending_approval" names={names} />)

    await user.click(screen.getByRole('button', { name: /Approve/ }))

    await waitFor(() => expect(h.nav.refresh).toHaveBeenCalled())
    expect(h.svc.approveAward).toHaveBeenCalledWith({ awardId: AWARD, orgId: ORG, approvedByUserId: 'me' })
  })

  it('issues an approved award', async () => {
    h.signedInRole = 'admin'
    const user = userEvent.setup()
    renderWithMessages(<AwardsQueue awards={[award()]} status="approved" names={names} />)

    await user.click(screen.getByRole('button', { name: /Issue/ }))

    await waitFor(() => expect(h.nav.refresh).toHaveBeenCalled())
    expect(h.svc.issueAward).toHaveBeenCalledWith({ awardId: AWARD, orgId: ORG, approvedByUserId: 'me' })
  })

  it('asks for a reason before it rejects, then rejects with it', async () => {
    h.signedInRole = 'admin'
    const user = userEvent.setup()
    renderWithMessages(<AwardsQueue awards={[award()]} status="pending_approval" names={names} />)

    await user.click(screen.getByRole('button', { name: /Reject/ }))
    expect(h.svc.rejectAward).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirm rejection' })).toBeDisabled()

    await user.type(screen.getByLabelText('Reason for rejecting'), 'Not in the policy')
    await user.click(screen.getByRole('button', { name: 'Confirm rejection' }))

    await waitFor(() => expect(h.nav.refresh).toHaveBeenCalled())
    expect(h.svc.rejectAward).toHaveBeenCalledWith(AWARD, ORG, 'me', 'Not in the policy')
  })

  it('shows the refusal of the action, and does not refresh as if it had worked, when the signed-in person is no administrator', async () => {
    const user = userEvent.setup()
    renderWithMessages(<AwardsQueue awards={[award()]} status="pending_approval" names={names} />)

    await user.click(screen.getByRole('button', { name: /Approve/ }))

    expect(await screen.findByText('Insufficient permissions')).toBeInTheDocument()
    expect(h.svc.approveAward).not.toHaveBeenCalled()
    expect(h.nav.refresh).not.toHaveBeenCalled()
  })

  it('offers no decision on an award that was issued', () => {
    renderWithMessages(<AwardsQueue awards={[award()]} status="issued" names={names} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('the create award dialog', () => {
  const awardTypes = [{ id: PEER_TYPE, name: 'Team player', defaultCreditAmount: 25 }]
  const members = [{ userId: 'bob', name: 'Bob Tremblay', email: 'bob@example.org' }]

  async function open(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Create Award' }))
    return screen.findByRole('dialog')
  }

  it('creates the award through the real action, in the active program, and refreshes', async () => {
    h.signedInRole = 'admin'
    const user = userEvent.setup()
    renderWithMessages(<CreateAwardDialog programId={PROGRAM} awardTypes={awardTypes} members={members} />)
    const dialog = await open(user)

    await user.selectOptions(within(dialog).getByLabelText('Member'), 'Bob Tremblay (bob@example.org)')
    await user.selectOptions(within(dialog).getByLabelText('Award'), 'Team player (25)')
    await user.type(within(dialog).getByLabelText('Reason'), 'Closed the biggest grievance')
    await user.click(within(dialog).getByRole('button', { name: 'Create award' }))

    await waitFor(() => expect(h.nav.refresh).toHaveBeenCalled())
    expect(h.svc.createAwardRequest).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: ORG, issuerUserId: 'me', awardTypeId: PEER_TYPE, recipientUserId: 'bob', reason: 'Closed the biggest grievance' }),
    )
  })

  it('shows the refusal of the action and keeps the dialog open, when the signed-in person is no administrator', async () => {
    const user = userEvent.setup()
    renderWithMessages(<CreateAwardDialog programId={PROGRAM} awardTypes={awardTypes} members={members} />)
    const dialog = await open(user)

    await user.selectOptions(within(dialog).getByLabelText('Member'), 'Bob Tremblay (bob@example.org)')
    await user.selectOptions(within(dialog).getByLabelText('Award'), 'Team player (25)')
    await user.type(within(dialog).getByLabelText('Reason'), 'x')
    await user.click(within(dialog).getByRole('button', { name: 'Create award' }))

    expect(await within(dialog).findByText('Insufficient permissions')).toBeInTheDocument()
    expect(h.svc.createAwardRequest).not.toHaveBeenCalled()
    expect(h.nav.refresh).not.toHaveBeenCalled()
  })

  it('is disabled, and says why, when the organization has no active program or no award type', () => {
    const { rerender } = renderWithMessages(<CreateAwardDialog programId={null} awardTypes={awardTypes} members={members} />)
    expect(screen.getByRole('button', { name: 'Create Award' })).toBeDisabled()

    rerender(
      <NextIntlClientProvider locale="en-CA" messages={messages}>
        <CreateAwardDialog programId={PROGRAM} awardTypes={[]} members={members} />
      </NextIntlClientProvider>,
    )
    expect(screen.getByRole('button', { name: 'Create Award' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create Award' })).toHaveAttribute('title', 'Activate a program and add an award type first.')
  })
})
