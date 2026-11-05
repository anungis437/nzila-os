import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { getVoiceDisclosureNotice } from '@/lib/voice/disclosure-consent';

export const dynamic = 'force-dynamic';

/** Read-only notice. No audio, personal data or consent is written by GET. */
export const GET = withRoleAuth('member', async () => {
  const notice = getVoiceDisclosureNotice();
  if (!notice) {
    return NextResponse.json(
      { error: 'Voice transcription is unavailable until an approved notice is configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    { version: notice.version, enCA: notice.enCA, frCA: notice.frCA, provider: notice.provider },
    { headers: { 'Cache-Control': 'no-store' } },
  );
});
