/**
 * Server-controlled location-consent disclosure.
 *
 * No default legal notice is invented. The institution must supply an adopted
 * version and its exact member-facing text before consent may be granted.
 * This contract is intentionally fail-closed when that decision is outstanding.
 */
export const LOCATION_CONSENT_PURPOSE = 'foreground_location_tracking';
export const LOCATION_CONSENT_DESCRIPTION =
  'Foreground-only location tracking for strike or event coordination when separately selected. Location records are retained for no more than 24 hours, and consent can be revoked.';

export interface LocationConsentNotice {
  version: string;
  purpose: string;
  purposeDescription: string;
  consentText: string;
}

export function getLocationConsentNotice(): LocationConsentNotice | null {
  const version = process.env.UE_LOCATION_CONSENT_NOTICE_VERSION?.trim();
  const consentText = process.env.UE_LOCATION_CONSENT_NOTICE_TEXT?.trim();

  // Version is persisted in a varchar(10) column; never truncate it.
  if (!version || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,9}$/.test(version)) return null;
  if (!consentText || consentText.length > 4000) return null;

  return {
    version,
    purpose: LOCATION_CONSENT_PURPOSE,
    purposeDescription: LOCATION_CONSENT_DESCRIPTION,
    consentText,
  };
}
