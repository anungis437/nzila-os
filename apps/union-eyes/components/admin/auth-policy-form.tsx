'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { failureLanguage, isRecord, readUserFailure, type FailureLanguage } from '@/lib/client/api-envelope';

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

const copy: Record<FailureLanguage, {
  loading: string; retry: string; loadFailed: string; saveFailed: string; saveUnconfirmed: string; saved: string; saving: string; save: string;
  methods: string; sso: string; ssoLabel: string; domains: string; domainsHelp: string; mfa: string; mfaHelp: string;
  roleLabels: Record<(typeof ROLES)[number], string>;
  methodLabels: Record<'allowLocalAuth' | 'allowMagicLink' | 'allowSso' | 'passwordResetAllowed' | 'requireInvite', string>;
}> = {
  en: {
    loading: 'Loading…', retry: 'Try again', loadFailed: 'The sign-in policy could not be loaded. Refresh and try again.',
    saveFailed: 'The policy change could not be confirmed. Reload to check what is in force before retrying.',
    saveUnconfirmed: 'The server did not confirm the requested policy change. Reload to see what is in force before relying on it.',
    saved: 'Policy saved and confirmed by the server.', saving: 'Saving…', save: 'Save policy',
    methods: 'Allowed sign-in methods', sso: 'SSO enforcement', ssoLabel: 'Require single sign-on. When enabled, password + magic link are disabled automatically.',
    domains: 'Email domain allowlist', domainsHelp: 'Comma-separated list of domains allowed to sign up / accept invites. Leave empty to allow any domain.',
    mfa: 'Require two-factor authentication for roles', mfaHelp: 'Selected roles will be forced through MFA on every sign-in. Members who have not yet enrolled will be told to contact an administrator.',
    roleLabels: { member: 'Member', steward: 'Steward', chief_steward: 'Chief steward', admin: 'Administrator', coo: 'COO', app_owner: 'App owner', platform_admin: 'Platform administrator' },
    methodLabels: {
      allowLocalAuth: 'Email + password', allowMagicLink: 'Magic link (passwordless email)', allowSso: 'Microsoft single sign-on',
      passwordResetAllowed: 'Allow self-service password reset', requireInvite: 'Require an invite to join (disable open signup)',
    },
  },
  fr: {
    loading: 'Chargement…', retry: 'Réessayer', loadFailed: 'La politique de connexion n’a pas pu être chargée. Actualisez, puis réessayez.',
    saveFailed: 'La modification de la politique n’a pas pu être confirmée. Rechargez la page pour vérifier les paramètres en vigueur avant de réessayer.',
    saveUnconfirmed: 'Le serveur n’a pas confirmé la modification demandée. Rechargez la page pour voir les paramètres en vigueur avant de vous y fier.',
    saved: 'Politique enregistrée et confirmée par le serveur.', saving: 'Enregistrement…', save: 'Enregistrer la politique',
    methods: 'Méthodes de connexion autorisées', sso: 'Obligation d’authentification unique', ssoLabel: 'Exiger l’authentification unique. Lorsque cette option est activée, le mot de passe et le lien magique sont désactivés automatiquement.',
    domains: 'Liste des domaines de courriel autorisés', domainsHelp: 'Liste de domaines séparés par des virgules autorisés à s’inscrire ou à accepter une invitation. Laissez vide pour autoriser tout domaine.',
    mfa: 'Exiger l’authentification à deux facteurs pour certains rôles', mfaHelp: 'Les rôles sélectionnés devront passer par l’authentification à deux facteurs à chaque connexion. Les membres qui ne sont pas encore inscrits seront invités à communiquer avec un administrateur.',
    roleLabels: { member: 'Membre', steward: 'Délégué', chief_steward: 'Délégué en chef', admin: 'Administrateur', coo: 'Directeur de l’exploitation', app_owner: 'Propriétaire de l’application', platform_admin: 'Administrateur de la plateforme' },
    methodLabels: {
      allowLocalAuth: 'Courriel et mot de passe', allowMagicLink: 'Lien magique (courriel sans mot de passe)', allowSso: 'Authentification unique Microsoft',
      passwordResetAllowed: 'Autoriser la réinitialisation du mot de passe en libre-service', requireInvite: 'Exiger une invitation pour s’inscrire (désactiver l’inscription ouverte)',
    },
  },
};

const BOOLEAN_KEYS = ['allowLocalAuth', 'allowMagicLink', 'allowSso', 'requireSso', 'requireInvite', 'passwordResetAllowed'] as const;
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value) => b.includes(value));

/** A policy the server stated in full, or null: a body that is not one is never shown as the saved policy. */
function readPolicy(body: unknown): AuthPolicy | null {
  if (!isRecord(body) || !BOOLEAN_KEYS.every((key) => typeof body[key] === 'boolean')) return null;
  const list = (value: unknown): string[] | null => (Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null);
  const domains = list(body.allowedEmailDomains);
  const roles = list(body.mfaRequiredForRoles);
  if (!domains || !roles) return null;
  return { ...(body as unknown as AuthPolicy), allowedEmailDomains: domains, mfaRequiredForRoles: roles };
}


export function AuthPolicyForm() {
  const language = failureLanguage(useLocale());
  const t = copy[language];
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
        setError(await readUserFailure(res, t.loadFailed, language));
        return;
      }
      const loaded = readPolicy(await res.json().catch(() => null));
      if (!loaded) {
        setError(t.loadFailed);
        return;
      }
      setPolicy(loaded);
      setDomainInput((loaded.allowedEmailDomains ?? []).join(', '));
    } catch {
      setError(t.loadFailed);
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
      if (!res.ok) {
        setError(await readUserFailure(res, t.saveFailed, language));
        return;
      }
      const confirmed = readPolicy(await res.json().catch(() => null));
      const sent = {
        domains: domains.length > 0 ? domains : [],
        roles: policy.mfaRequiredForRoles ?? [],
      };
      // The server's PUT response is the persisted policy read back by updateOrgAuthPolicy.
      // All stored settings must match the write, including method toggles whose effective
      // availability may be overridden by requireSso at sign-in time.
      if (
        !confirmed ||
        !BOOLEAN_KEYS.every((key) => confirmed[key] === policy[key]) ||
        !sameSet(confirmed.allowedEmailDomains ?? [], sent.domains) ||
        !sameSet(confirmed.mfaRequiredForRoles ?? [], sent.roles)
      ) {
        setError(t.saveUnconfirmed);
        return;
      }
      setPolicy(confirmed);
      setDomainInput((confirmed.allowedEmailDomains ?? []).join(', '));
      setSuccess(t.saved);
    } catch {
      setError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500">{t.loading}</p>;
  }
  if (!policy) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error ?? t.loadFailed}</p>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-gray-300 px-4 py-2 text-sm">{t.retry}</button>
      </div>
    );
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
        <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
          {success}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t.methods}</h2>
        {(['allowLocalAuth', 'allowMagicLink', 'allowSso', 'passwordResetAllowed', 'requireInvite'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy[k]}
              onChange={(e) => setPolicy({ ...policy, [k]: e.target.checked })}
            />
            <span className="text-sm text-gray-800">{t.methodLabels[k]}</span>
          </label>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t.sso}</h2>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={policy.requireSso}
            onChange={(e) => setPolicy({ ...policy, requireSso: e.target.checked })}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-800">{t.ssoLabel}</span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t.domains}</h2>
        <p className="text-sm text-gray-600">{t.domainsHelp}</p>
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="example.com, example.org"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">{t.mfa}</h2>
        <p className="text-sm text-gray-600">{t.mfaHelp}</p>
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
                {t.roleLabels[role]}
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
          {saving ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
