import { ApiError, ErrorCode } from '@/lib/api/errors'

/** Existing UE-INST-REWARDS-PROGRAM-AUTOMATION-EXPIRY-AND-EXPORT and
 * UE-INST-REWARDS-REDEMPTION-PROVIDER-AUTHORITY are deferred. A canonical
 * membership, administrator title, cron secret or verified callback is not
 * authority to mint, spend, refund or disclose a credit balance. */
export class RewardsInstitutionalAuthorityUnavailable extends ApiError {
  readonly status = 501
  constructor() {
    super(
      ErrorCode.NOT_IMPLEMENTED,
      'Reward credits, wallets, budgets, redemption and automation are unavailable pending their recorded institutional authority.',
    )
    this.name = 'RewardsInstitutionalAuthorityUnavailable'
  }
}

/** No environment switch or caller-supplied role/approval flag grants this authority. */
export function requireRewardsInstitutionalAuthority(): void {
  throw new RewardsInstitutionalAuthorityUnavailable()
}
