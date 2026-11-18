/** Existing UI actions must not attest work for which no execution source exists. */
export class CfoCapabilityUnavailableError extends Error {
  readonly status = 501
  constructor(
    readonly code:
      | 'SECURITY_SCANNER_UNAVAILABLE'
      | 'RECONCILIATION_SOURCE_UNAVAILABLE'
      | 'QBO_OAUTH_SOURCE_UNAVAILABLE',
  ) {
    super(
      code === 'SECURITY_SCANNER_UNAVAILABLE'
        ? 'A configured security scanner is required'
        : code === 'QBO_OAUTH_SOURCE_UNAVAILABLE'
          ? 'A configured protected QBO authorization flow is required'
          : 'Verified reconciliation source data is required',
    )
    this.name = 'CfoCapabilityUnavailableError'
  }
}
