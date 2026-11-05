import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkVoiceDisclosure, getVoiceDisclosureNotice } from '../disclosure-consent';

const keys = [
  'UE_VOICE_DISCLOSURE_NOTICE_VERSION',
  'UE_VOICE_DISCLOSURE_NOTICE_EN_CA',
  'UE_VOICE_DISCLOSURE_NOTICE_FR_CA',
  'UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE',
] as const;
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));

beforeEach(() => {
  process.env.UE_VOICE_DISCLOSURE_NOTICE_VERSION = 'notice-2026-10';
  process.env.UE_VOICE_DISCLOSURE_NOTICE_EN_CA = 'Approved English notice';
  process.env.UE_VOICE_DISCLOSURE_NOTICE_FR_CA = 'Avis français approuvé';
  process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE = 'fixture-only';
});

afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
});

function requestFields(version = 'notice-2026-10', acknowledged = 'true', permission = 'true') {
  const form = new FormData();
  form.set('disclosureNoticeVersion', version);
  form.set('disclosureAcknowledged', acknowledged);
  form.set('participantPermissionConfirmed', permission);
  return form;
}

describe('voice disclosure authority', () => {
  it('requires a versioned bilingual notice and an institutional approval reference', () => {
    expect(getVoiceDisclosureNotice()).toMatchObject({ version: 'notice-2026-10' });
    for (const key of keys) {
      const saved = process.env[key];
      delete process.env[key];
      expect(getVoiceDisclosureNotice()).toBeNull();
      process.env[key] = saved;
    }
  });

  it('refuses stale versions, absent acknowledgment and absent permission', () => {
    expect(checkVoiceDisclosure(requestFields()).allowed).toBe(true);
    expect(checkVoiceDisclosure(requestFields('old'))).toMatchObject({ allowed: false, status: 409 });
    expect(checkVoiceDisclosure(requestFields('notice-2026-10', 'false'))).toMatchObject({ allowed: false, status: 400 });
    expect(checkVoiceDisclosure(requestFields('notice-2026-10', 'true', 'false'))).toMatchObject({ allowed: false, status: 400 });
  });

  it('treats a request that states no notice version as a bad request, not as a changed notice', () => {
    expect(checkVoiceDisclosure(new FormData())).toMatchObject({ allowed: false, status: 400 });
    const withoutVersion = requestFields();
    withoutVersion.delete('disclosureNoticeVersion');
    expect(checkVoiceDisclosure(withoutVersion)).toMatchObject({ allowed: false, status: 400 });
    expect(checkVoiceDisclosure(requestFields(''))).toMatchObject({ allowed: false, status: 400 });
    const asFile = requestFields();
    asFile.set('disclosureNoticeVersion', new File(['x'], 'version.txt'));
    expect(checkVoiceDisclosure(asFile)).toMatchObject({ allowed: false, status: 400 });
  });

  it('answers a stale version before it asks about the acknowledgment, so the client re-reads the notice first', () => {
    expect(checkVoiceDisclosure(requestFields('old', 'false', 'false'))).toMatchObject({ allowed: false, status: 409 });
  });

  it('does not treat client-supplied approval metadata as institutional authority', () => {
    delete process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE;
    const form = requestFields();
    form.set('approvalReference', 'client-forged-approval');
    expect(checkVoiceDisclosure(form)).toMatchObject({ allowed: false, status: 503 });
  });
});
