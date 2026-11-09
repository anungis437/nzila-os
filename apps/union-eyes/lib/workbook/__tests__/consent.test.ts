import { describe, expect, it } from 'vitest';
import { activeWorkbookConsent, issueWorkbookConsent, WORKBOOK_CONSENT_NOTICE_VERSION } from '../consent';

describe('workbook consent', () => {
  it('accepts only the complete current purpose grant', () => {
    expect(activeWorkbookConsent(issueWorkbookConsent(new Date('2026-11-09T00:00:00Z')))).toBe(true);
    expect(activeWorkbookConsent({ ...issueWorkbookConsent(), noticeVersion: 'old' })).toBe(false);
    expect(activeWorkbookConsent({ ...issueWorkbookConsent(), purposes: ['persist'] })).toBe(false);
    expect(activeWorkbookConsent({ ...issueWorkbookConsent(), withdrawnAt: new Date().toISOString() })).toBe(false);
    expect(WORKBOOK_CONSENT_NOTICE_VERSION).toMatch(/^ue-workbook-persistence-/);
  });
});
