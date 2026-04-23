'use client';

import { useEffect, useState } from 'react';

interface AuthPolicy {
  organizationId?: string | null;
  allowLocalAuth: boolean;
  allowMagicLink: boolean;
  allowSso: boolean;
  requireSso: boolean;
  requireInvite: boolean;
  passwordResetAllowed: boolean;
  allowedEmailDomains: string[] | null;
  mfaRequiredForRoles?: string[];
}

const ROLES = ['member', 'steward', 'chief_steward', 'admin', 'coo', 'app_owner', 'platform_admin'] as const;

export function AuthPolicyForm() {
  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/policy', { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not load auth policy');
        return;
      }
      const data = (await res.json()) as AuthPolicy;
      setPolicy({
        ...data,
        mfaRequiredForRoles: data.mfaRequiredForRoles ?? [],
        allowedEmailDomains: data.allowedEmailDomains ?? [],
      });
      setDomainInput((data.allowedEmailDomains ?? []).join(', '));
    } catch {
      setError('Could not load auth policy');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!policy) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const domains = domainInput
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch('/api/auth/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowLocalAuth: policy.allowLocalAuth,
          allowMagicLink: policy.allowMagicLink,
          allowSso: policy.allowSso,
          requireInvite: policy.requireInvite,
          requireSso: policy.requireSso,
          passwordResetAllowed: policy.passwordResetAllowed,
          allowedEmailDomains: domains.length > 0 ? domains : [],
          mfaRequiredForRoles: policy.mfaRequiredForRoles ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save policy');
        return;
      }
      setPolicy({
        ...data,
        mfaRequiredForRoles: data.mfaRequiredForRoles ?? [],
        allowedEmailDomains: data.allowedEmailDomains ?? [],
      });
      setSuccess('Policy updated.');
    } catch {
      setError('Could not save policy');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !policy) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const toggleMfaRole = (role: string) => {
    const roles = new Set(policy.mfaRequiredForRoles ?? []);
    if (roles.has(role)) roles.delete(role);
    else roles.add(role);
    setPolicy({ ...policy, mfaRequiredForRoles: Array.from(roles) });
  };

  return (
    <form onSubmit={save} className="space-y-8 border border-gray-200 rounded-xl p-6 bg-white">
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
          {success}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Allowed sign-in methods</h2>
        {([
          ['allowLocalAuth', 'Email + password'],
          ['allowMagicLink', 'Magic link (passwordless email)'],
          ['allowSso', 'Microsoft single sign-on'],
          ['passwordResetAllowed', 'Allow self-service password reset'],
          ['requireInvite', 'Require an invite to join (disable open signup)'],
        ] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy[k]}
              onChange={(e) => setPolicy({ ...policy, [k]: e.target.checked })}
            />
            <span className="text-sm text-gray-800">{label}</span>
          </label>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">SSO enforcement</h2>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={policy.requireSso}
            onChange={(e) => setPolicy({ ...policy, requireSso: e.target.checked })}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-800">
            Require single sign-on. When enabled, password + magic link are disabled automatically.
          </span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Email domain allowlist</h2>
        <p className="text-sm text-gray-600">
          Comma-separated list of domains allowed to sign up / accept invites. Leave empty to allow any domain.
        </p>
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="example.com, example.org"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Require two-factor authentication for roles</h2>
        <p className="text-sm text-gray-600">
          Selected roles will be forced through MFA on every sign-in. Members who have not yet enrolled will be told to contact an administrator.
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const active = (policy.mfaRequiredForRoles ?? []).includes(role);
            return (
              <button
                type="button"
                key={role}
                onClick={() => toggleMfaRole(role)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-electric text-white border-electric'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>
      </section>

      <div className="pt-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving}
          className="bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save policy'}
        </button>
      </div>
    </form>
  );
}
