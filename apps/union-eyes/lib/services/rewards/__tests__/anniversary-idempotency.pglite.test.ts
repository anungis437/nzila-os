import { vi } from 'vitest'
vi.mock('@/db', () => ({ db: {} }))
import { processAnniversaryAwards } from '../automation-service'
import { currentCreditDenial } from './support/current-credit-denial'
currentCreditDenial(
  'anniversary-idempotency.pglite',
  (f) => processAnniversaryAwards(f.org),
  'INSERT INTO public.automation_rules DEFAULT VALUES',
  true,
)
