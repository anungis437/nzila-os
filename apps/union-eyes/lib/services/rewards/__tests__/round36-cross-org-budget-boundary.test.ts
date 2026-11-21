import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { getBudgetEnvelopeById } from '../budget-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'round36-cross-org-budget-boundary',
  (f) => getBudgetEnvelopeById('33333333-3333-4333-8333-333333333333', f.org),
  'SELECT amount_limit FROM public.reward_budget_envelopes',
  false,
)
