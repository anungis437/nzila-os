"use client";

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

interface VoiceNotice {
  version: string;
  enCA: string;
  frCA: string;
  provider: string;
}

export function useVoiceDisclosure() {
  const locale = useLocale();
  const [notice, setNotice] = useState<VoiceNotice | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [permission, setPermission] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/voice/disclosure', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Notice unavailable');
        return response.json() as Promise<VoiceNotice>;
      })
      .then(value => {
        if (active && value.version && value.enCA && value.frCA) {
          setNotice(value);
          setUnavailable(false);
        } else if (active) {
          setUnavailable(true);
        }
      })
      .catch(() => { if (active) setUnavailable(true); });
    return () => { active = false; };
  }, []);

  const ready = Boolean(notice && acknowledged && permission && !unavailable);
  const appendDisclosure = useCallback((form: FormData): boolean => {
    if (!notice || !acknowledged || !permission || unavailable) return false;
    form.append('disclosureNoticeVersion', notice.version);
    form.append('disclosureAcknowledged', 'true');
    form.append('participantPermissionConfirmed', 'true');
    return true;
  }, [notice, acknowledged, permission, unavailable]);

  return {
    locale,
    notice,
    unavailable,
    acknowledged,
    setAcknowledged,
    permission,
    setPermission,
    ready,
    appendDisclosure,
  };
}

export function VoiceDisclosurePrompt({ disclosure }: {
  disclosure: ReturnType<typeof useVoiceDisclosure>;
}) {
  const fr = disclosure.locale.startsWith('fr');
  if (!disclosure.notice) {
    return (
      <p role="status" className="text-sm text-amber-700">
        {fr
          ? 'La transcription vocale est indisponible tant que l’avis approuvé par l’organisation n’est pas configuré.'
          : 'Voice transcription is unavailable until an institutionally approved notice is configured.'}
      </p>
    );
  }

  return (
    <fieldset className="mt-3 space-y-2 text-left text-sm">
      <legend className="font-semibold">
        {fr ? 'Consentement à la transcription externe' : 'External transcription disclosure'}
      </legend>
      <p className="whitespace-pre-wrap">
        {fr ? disclosure.notice.frCA : disclosure.notice.enCA}
      </p>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={disclosure.acknowledged}
          onChange={event => disclosure.setAcknowledged(event.target.checked)}
        />
        <span>{fr
          ? 'J’ai lu cet avis et j’accepte l’envoi de cet enregistrement au service de transcription externe.'
          : 'I have read this notice and agree to send this recording to the external transcription service.'}</span>
      </label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={disclosure.permission}
          onChange={event => disclosure.setPermission(event.target.checked)}
        />
        <span>{fr
          ? 'Je confirme avoir la permission de toutes les personnes enregistrées.'
          : 'I confirm I have permission from everyone recorded.'}</span>
      </label>
    </fieldset>
  );
}
