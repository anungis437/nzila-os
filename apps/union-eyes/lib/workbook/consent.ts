export const WORKBOOK_CONSENT_NOTICE_VERSION = 'ue-workbook-persistence-2026-11-09';
export const WORKBOOK_CONSENT_PURPOSES = ['persist', 'process', 'share', 'checkout'] as const;

export interface WorkbookConsent {
  noticeVersion: string;
  purposes: string[];
  granted: true;
  grantedAt: string;
  withdrawnAt: string | null;
}

export function activeWorkbookConsent(value: unknown): value is WorkbookConsent {
  if (!value || typeof value !== 'object') return false;
  const consent = value as Record<string, unknown>;
  const purposes = consent.purposes;
  return consent.noticeVersion === WORKBOOK_CONSENT_NOTICE_VERSION &&
    consent.granted === true && consent.withdrawnAt === null &&
    typeof consent.grantedAt === 'string' && !Number.isNaN(Date.parse(consent.grantedAt)) &&
    Array.isArray(purposes) && WORKBOOK_CONSENT_PURPOSES.every((purpose) => purposes.includes(purpose));
}

export function issueWorkbookConsent(now: Date = new Date()): WorkbookConsent {
  return {
    noticeVersion: WORKBOOK_CONSENT_NOTICE_VERSION,
    purposes: [...WORKBOOK_CONSENT_PURPOSES],
    granted: true,
    grantedAt: now.toISOString(),
    withdrawnAt: null,
  };
}
