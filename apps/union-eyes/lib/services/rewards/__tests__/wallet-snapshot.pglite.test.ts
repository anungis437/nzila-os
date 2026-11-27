import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { getWalletSnapshot } from '../wallet-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'wallet-snapshot.pglite',
  (f) => getWalletSnapshot(f.org, f.actor),
  'SELECT balance_after FROM public.reward_wallet_ledger',
  false,
)
