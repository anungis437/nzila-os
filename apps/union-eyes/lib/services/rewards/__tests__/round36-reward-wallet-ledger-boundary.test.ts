import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { getBalance } from '../wallet-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'round36-reward-wallet-ledger-boundary',
  (f) => getBalance(f.org, f.actor),
  'INSERT INTO public.reward_wallet_ledger DEFAULT VALUES',
  false,
)
