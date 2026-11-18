import { ApiError, ErrorCode } from '@/lib/api/errors'

/** Finance/dues persistence is excluded from the base release. No caller role,
 * stored financial row, provider credential or environment flag grants it. */
export class BaseFinancialCapabilityUnavailable extends ApiError {
  readonly status = 501
  constructor() {
    super(
      ErrorCode.NOT_IMPLEMENTED,
      'Finance and dues persistence are not available in this release.',
    )
    this.name = 'BaseFinancialCapabilityUnavailable'
  }
}

/** Unconditional source boundary: no database, provider or audit side effects. */
export function requireBaseFinancialAuthority(): void {
  throw new BaseFinancialCapabilityUnavailable()
}
