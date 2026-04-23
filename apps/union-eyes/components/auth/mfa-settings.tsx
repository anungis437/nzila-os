'use client';

import { useEffect, useState } from 'react';

interface MfaStatus {
  enrolled: boolean;
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodeCount: number;
}

interface EnrollResponse {
  otpAuthUri: string;
  secret: string;
  recoveryCodes: string[];
}

/**
 * Self-service MFA enrollment / disable UI for Union Eyes.
 *
 * Flow:
 *   1. GET /api/auth/mfa/status → show current state
 *   2. If not enabled → POST /api/auth/mfa/enroll → show otpauth:// URI +
 *      recovery codes → user scans in authenticator app → enters first code →
 *      POST /api/auth/mfa/verify-enroll → enabled.
 *   3. If enabled → show disable button → POST /api/auth/mfa/disable.
 *
 * The QR rendering uses a free public QR service via an <img> element; the
 * otpauth:// URI itself is also shown for copy-paste so users can still set
 * up manually if the image provider is blocked.
 */
export function MfaSettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [confirmedCodes, setConfirmedCodes] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/mfa/status', { cache: 'no-store' });
      if (!res.ok) {
        setError('Could not load MFA status');
        return;
      }
      setStatus(await res.json());
    } catch {
      setError('Could not load MFA status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function startEnrollment() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/enroll', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Enrollment failed');
        return;
      }
      setEnrollment(data);
      setConfirmedCodes(false);
    } catch {
      setError('Enrollment failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/verify-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code');
        return;
      }
      setEnrollment(null);
      setVerifyCode('');
      await loadStatus();
    } catch {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    if (!confirm('Disable two-factor authentication? Your account will be less secure.')) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'user_disabled' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not disable MFA');
        return;
      }
      await loadStatus();
    } catch {
      setError('Could not disable MFA');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !status && !enrollment) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (enrollment) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(enrollment.otpAuthUri)}`;
    return (
      <div className="space-y-6 border border-gray-200 rounded-xl p-6 bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Step 1 — Scan this QR code</h2>
          <p className="text-sm text-gray-600 mt-1">
            Open your authenticator app and scan the code below. If you cannot
            scan, enter the secret manually.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="MFA setup QR code"
            width={240}
            height={240}
            className="border border-gray-200 rounded-lg"
          />
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700">
              Manual setup secret
            </label>
            <code className="block mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs break-all">
              {enrollment.secret}
            </code>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Step 2 — Save your recovery codes
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Store these somewhere safe. Each code can be used <strong>once</strong> to sign in if you lose your authenticator device.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm">
            {enrollment.recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <label className="flex items-start gap-2 mt-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmedCodes}
              onChange={(e) => setConfirmedCodes(e.target.checked)}
              className="mt-0.5"
            />
            <span>I have saved these recovery codes in a secure location.</span>
          </label>
        </div>

        <form onSubmit={verifyEnrollment} className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Step 3 — Enter the 6-digit code
          </h2>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            maxLength={6}
            required
            className="w-full max-w-xs rounded-xl border border-gray-200 px-4 py-2.5 text-sm tracking-widest"
            placeholder="123456"
          />
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !confirmedCodes}
              className="bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Activate two-factor'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnrollment(null);
                setVerifyCode('');
                setConfirmedCodes(false);
                setError(null);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white">
      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
      {status?.enabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
            <span className="font-medium text-gray-900">Two-factor is enabled</span>
          </div>
          {status.enabledAt && (
            <p className="text-sm text-gray-600">
              Activated on {new Date(status.enabledAt).toLocaleDateString()}.
            </p>
          )}
          <p className="text-sm text-gray-600">
            You have <strong>{status.recoveryCodeCount}</strong> recovery codes remaining.
          </p>
          <button
            type="button"
            onClick={disable}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Disable two-factor authentication
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-gray-300 rounded-full" />
            <span className="font-medium text-gray-900">Two-factor is not enabled</span>
          </div>
          <p className="text-sm text-gray-600">
            Adding a second factor makes it much harder for someone to sign in as you, even if your password is compromised.
          </p>
          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl disabled:opacity-50"
          >
            {loading ? 'Preparing…' : 'Enable two-factor authentication'}
          </button>
        </div>
      )}
    </div>
  );
}
