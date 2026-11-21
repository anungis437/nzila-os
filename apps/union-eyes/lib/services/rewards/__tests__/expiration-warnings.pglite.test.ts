import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { sendBatchExpirationWarnings } from '../notification-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'expiration-warnings.pglite',
  (f) => sendBatchExpirationWarnings([f.org]),
  'SELECT amount_credits FROM public.reward_wallet_ledger',
  true,
)
