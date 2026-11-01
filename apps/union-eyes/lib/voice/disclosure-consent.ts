/**
 * Institution-controlled disclosure for external speech transcription.
 * This is deliberately NOT derived from request fields or a client preference.
 * Missing approval, a notice in either official language, or a version disables
 * external processing until the institution supplies the approved configuration.
 */
export interface VoiceDisclosureNotice {
  version: string;
  enCA: string;
  frCA: string;
  approvalReference: string;
  provider: 'Azure OpenAI';
}

export function getVoiceDisclosureNotice(): VoiceDisclosureNotice | null {
  const version = process.env.UE_VOICE_DISCLOSURE_NOTICE_VERSION?.trim() ?? '';
  const enCA = process.env.UE_VOICE_DISCLOSURE_NOTICE_EN_CA?.trim() ?? '';
  const frCA = process.env.UE_VOICE_DISCLOSURE_NOTICE_FR_CA?.trim() ?? '';
  const approvalReference = process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE?.trim() ?? '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)
      || !enCA || !frCA || !approvalReference
      || enCA.length > 8000 || frCA.length > 8000 || approvalReference.length > 256) {
    return null;
  }
  return { version, enCA, frCA, approvalReference, provider: 'Azure OpenAI' };
}

export type VoiceDisclosureDecision =
  | { allowed: true; notice: VoiceDisclosureNotice }
  | { allowed: false; status: 400 | 409 | 503; error: string };

export function checkVoiceDisclosure(
  formData: FormData,
  notice: VoiceDisclosureNotice | null = getVoiceDisclosureNotice(),
): VoiceDisclosureDecision {
  if (!notice) {
    return { allowed: false, status: 503, error: 'Institutionally approved voice disclosure is not configured' };
  }
  // A request that states no notice version never showed the notice: that is a bad request. A different version means the notice changed.
  const statedVersion = formData.get('disclosureNoticeVersion');
  if (typeof statedVersion !== 'string' || statedVersion === '') {
    return { allowed: false, status: 400, error: 'Explicit disclosure acknowledgment and recording permission confirmation are required' };
  }
  if (statedVersion !== notice.version) {
    return { allowed: false, status: 409, error: 'Voice disclosure notice has changed; review it before submitting audio' };
  }
  if (formData.get('disclosureAcknowledged') !== 'true'
      || formData.get('participantPermissionConfirmed') !== 'true') {
    return { allowed: false, status: 400, error: 'Explicit disclosure acknowledgment and recording permission confirmation are required' };
  }
  return { allowed: true, notice };
}
