import { UE_TEST_ORGS } from './test-orgs'

/** Synthetic finance fixtures for the QA organization (never used outside the QA database; see seed-test-env assertSafeRuntime). */
export const UE_TEST_FINANCE = {
  organizationId: UE_TEST_ORGS.primary.id,
  employerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  employerName: 'QA Employer (synthetic)',
  /** The ledger account the QA financial mandates name; duties are segregated per account. */
  accountId: 'fffffff1-ffff-4fff-8fff-fffffffffff1',
} as const
