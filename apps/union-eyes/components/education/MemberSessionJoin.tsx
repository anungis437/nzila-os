'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type JoinDetails = { joinUrl: string; accessCode: string | null };

/**
 * Credentials are deliberately retrieved only after the member requests them.
 * The server, not this component, determines tenant, registration, approval and
 * session eligibility and records an atomic access audit before disclosure.
 */
export function MemberSessionJoin({ sessionId }: { sessionId: string | null | undefined }) {
  const [details, setDetails] = useState<JoinDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Do not retain credentials when switching registrations or tenants.
    setDetails(null);
    setError(null);
  }, [sessionId]);

  const requestJoiningDetails = async () => {
    if (!sessionId || loading) return;
    setDetails(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/education/registrations/join?sessionId=${encodeURIComponent(sessionId)}`,
        { method: 'GET', cache: 'no-store', credentials: 'same-origin' },
      );
      if (!response.ok) throw new Error('Joining access refused');
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== 'object' || !('success' in payload) ||
          payload.success !== true || !('data' in payload)) throw new Error('Invalid response');
      const data = payload.data;
      if (!data || typeof data !== 'object' || !('sessionId' in data) ||
          data.sessionId !== sessionId || !('joinUrl' in data) ||
          typeof data.joinUrl !== 'string') throw new Error('Invalid session response');
      const url = new URL(data.joinUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe joining URL');
      const accessCode = 'accessCode' in data && typeof data.accessCode === 'string'
        ? data.accessCode : null;
      setDetails({ joinUrl: url.href, accessCode });
    } catch {
      // Do not surface provider tokens, server errors or foreign-session metadata.
      setError('Joining instructions are unavailable. Confirm your registration or contact your union.');
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) return <p className="text-xs text-muted-foreground">Session joining is not available for this registration.</p>;

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={requestJoiningDetails}>
        {loading ? 'Checking access…' : 'Get virtual joining details'}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {details && (
        <div className="space-y-1 rounded-md border p-3 text-sm">
          <a href={details.joinUrl} target="_blank" rel="noopener noreferrer"
             referrerPolicy="no-referrer" className="font-medium underline">
            Join virtual session (opens in a new tab)
          </a>
          {details.accessCode && <p>Access code: <span className="font-mono">{details.accessCode}</span></p>}
          <p className="text-xs text-muted-foreground">Do not share these joining details.</p>
        </div>
      )}
    </div>
  );
}
