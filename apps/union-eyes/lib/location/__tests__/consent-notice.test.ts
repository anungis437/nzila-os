import { afterEach, describe, expect, it } from 'vitest';
import {
  getLocationConsentNotice,
  LOCATION_CONSENT_DESCRIPTION,
  LOCATION_CONSENT_PURPOSE,
} from '../consent-notice';

const previousVersion = process.env.UE_LOCATION_CONSENT_NOTICE_VERSION;
const previousText = process.env.UE_LOCATION_CONSENT_NOTICE_TEXT;

afterEach(() => {
  if (previousVersion === undefined) delete process.env.UE_LOCATION_CONSENT_NOTICE_VERSION;
  else process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = previousVersion;
  if (previousText === undefined) delete process.env.UE_LOCATION_CONSENT_NOTICE_TEXT;
  else process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = previousText;
});

describe('institution-owned location consent notice', () => {
  it('does not invent a notice when the institution has not supplied one', () => {
    delete process.env.UE_LOCATION_CONSENT_NOTICE_VERSION;
    delete process.env.UE_LOCATION_CONSENT_NOTICE_TEXT;
    expect(getLocationConsentNotice()).toBeNull();
  });

  it('rejects malformed or unpersistable versions and blank or oversized text', () => {
    process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = 'Exact notice';
    for (const version of ['', 'this-version-is-too-long', '../escape', 'spaces bad']) {
      process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = version;
      expect(getLocationConsentNotice()).toBeNull();
    }
    process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = 'v1';
    for (const text of ['', '  ', 'a'.repeat(4001)]) {
      process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = text;
      expect(getLocationConsentNotice()).toBeNull();
    }
  });

  it('returns only the configured exact text and a server-owned purpose', () => {
    process.env.UE_LOCATION_CONSENT_NOTICE_VERSION = 'v1';
    process.env.UE_LOCATION_CONSENT_NOTICE_TEXT = '  Exact adopted notice  ';
    expect(getLocationConsentNotice()).toEqual({
      version: 'v1',
      purpose: LOCATION_CONSENT_PURPOSE,
      purposeDescription: LOCATION_CONSENT_DESCRIPTION,
      consentText: 'Exact adopted notice',
    });
  });
});
