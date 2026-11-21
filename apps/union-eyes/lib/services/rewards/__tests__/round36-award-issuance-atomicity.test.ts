import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { issueAward } from '../award-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'round36-award-issuance-atomicity',
  (f) => issueAward({ awardId: f.historyAward, orgId: f.org, approvedByUserId: f.actor }),
  'UPDATE public.recognition_awards SET issued_at=now()',
  false,
)
