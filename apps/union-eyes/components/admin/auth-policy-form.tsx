'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { failureDetail, failureLanguage, isRecord, readApiFailure, userFailureText, type FailureLanguage } from '@/lib/client/api-envelope';

interface AuthPolicy {
  organizationId?: string | null;
  allowLocalAuth: boolean;
  allowMagicLink: boolean;
  allowSso: boolean;
  requireSso: boolean;
  requireInvite: boolean;
  passwordResetAllowed: boolean;
  allowedEmailDomains: string[];
  mfaRequiredForRoles: string[];
}

const ROLES = ['member', 'steward', 'chief_steward', 'admin', 'coo', 'app_owner', 'platform_admin'] as const;

const copy: Record<FailureLanguage, {
  loading: string; retry: string; loadFailed: string; saved: string; saving: string; save: string;
  notSaved: string; notSavedConfirmed: string; unknown: string; checkAgain: string; checking: string; differs: string; conflict: string; ssoConflict: string;
  methods: string; sso: string; ssoLabel: string; domains: string; domainsHelp: string; mfa: string; mfaHelp: string;
  roleLabels: Record<(typeof ROLES)[number], string>;
  methodLabels: Record<'allowLocalAuth' | 'allowMagicLink' | 'allowSso' | 'passwordResetAllowed' | 'requireInvite', string>;
}> = {
  en: {
    loading: 'Loading…', retry: 'Try again', loadFailed: 'The sign-in policy could not be loaded.',
    saved: 'Policy saved. The server confirms these settings are in force.', saving: 'Saving…', save: 'Save policy',
    notSaved: 'The policy was not saved.', notSavedConfirmed: 'The policy was not saved. The server still has the previous settings.',
    unknown: 'We could not confirm whether the change was saved. Check again before relying on it.', checkAgain: 'Check again', checking: 'Checking…',
    differs: 'The policy in force differs from the one you requested. Review the settings and save again.',
    conflict: 'The policy was changed by someone else after you opened it. Review the current settings and save again.',
    ssoConflict: 'Single sign-on cannot be required while it is switched off.',
    methods: 'Allowed sign-in methods', sso: 'SSO enforcement', ssoLabel: 'Require single sign-on. Password and magic link are then switched off.',
    domains: 'Email domain allowlist', domainsHelp: 'Separate domains with commas. Leave empty to allow any domain.',
    mfa: 'Require two-factor authentication for roles', mfaHelp: 'Selected roles must use two-factor authentication at every sign-in. Anyone not yet enrolled is told to contact an administrator.',
    roleLabels: { member: 'Member', steward: 'Steward', chief_steward: 'Chief steward', admin: 'Administrator', coo: 'COO', app_owner: 'App owner', platform_admin: 'Platform administrator' },
    methodLabels: {
      allowLocalAuth: 'Email + password', allowMagicLink: 'Magic link (passwordless email)', allowSso: 'Microsoft single sign-on',
      passwordResetAllowed: 'Allow self-service password reset', requireInvite: 'Require an invite to join (disable open signup)',
    },
  },
  fr: {
    loading: 'Chargement…', retry: 'Réessayer', loadFailed: 'La politique de connexion n’a pas pu être chargée.',
    saved: 'Politique enregistrée. Le serveur confirme que ces paramètres sont en vigueur.', saving: 'Enregistrement…', save: 'Enregistrer la politique',
    notSaved: 'La politique n’a pas été enregistrée.', notSavedConfirmed: 'La politique n’a pas été enregistrée. Le serveur conserve les paramètres précédents.',
    unknown: 'Nous n’avons pas pu confirmer si la modification a été enregistrée. Vérifiez de nouveau avant de vous y fier.', checkAgain: 'Vérifier de nouveau', checking: 'Vérification…',
    differs: 'La politique en vigueur diffère de celle que vous avez demandée. Vérifiez les paramètres, puis enregistrez de nouveau.',
    conflict: 'La politique a été modifiée par une autre personne après votre ouverture de la page. Vérifiez les paramètres actuels, puis enregistrez de nouveau.',
    ssoConflict: 'L’authentification unique ne peut pas être exigée lorsqu’elle est désactivée.',
    methods: 'Méthodes de connexion autorisées', sso: 'Obligation d’authentification unique', ssoLabel: 'Exiger l’authentification unique. Le mot de passe et le lien magique sont alors désactivés.',
    domains: 'Liste des domaines de courriel autorisés', domainsHelp: 'Séparez les domaines par des virgules. Laissez vide pour autoriser tout domaine.',
    mfa: 'Exiger l’authentification à deux facteurs pour certains rôles', mfaHelp: 'Les rôles sélectionnés doivent utiliser l’authentification à deux facteurs à chaque connexion. Toute personne non inscrite est invitée à communiquer avec un administrateur.',
    roleLabels: { member: 'Membre', steward: 'Délégué', chief_steward: 'Délégué en chef', admin: 'Administrateur', coo: 'Directeur de l’exploitation', app_owner: 'Propriétaire de l’application', platform_admin: 'Administrateur de la plateforme' },
    methodLabels: {
      allowLocalAuth: 'Courriel et mot de passe', allowMagicLink: 'Lien magique (courriel sans mot de passe)', allowSso: 'Authentification unique Microsoft',
      passwordResetAllowed: 'Autoriser la réinitialisation du mot de passe en libre-service', requireInvite: 'Exiger une invitation pour s’inscrire (désactiver l’inscription ouverte)',
    },
  },
};

const BOOLEAN_KEYS = ['allowLocalAuth', 'allowMagicLink', 'allowSso', 'requireSso', 'requireInvite', 'passwordResetAllowed'] as const;
const same = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((value) => right.has(value));
};

/** A policy the server stated in full, or null: a body that is not one is never shown as the policy in force. */
function readPolicy(body: unknown): AuthPolicy | null {
  if (!isRecord(body) || !BOOLEAN_KEYS.every((key) => typeof body[key] === 'boolean')) return null;
  const list = (value: unknown): string[] | null => (Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null);
  const domains = list(body.allowedEmailDomains);
  const roles = list(body.mfaRequiredForRoles);
  if (!domains || !roles) return null;
  return { ...(body as unknown as AuthPolicy), allowedEmailDomains: domains.map((d) => d.toLowerCase()), mfaRequiredForRoles: roles };
}

/** Every persisted field of two policies: all Booleans, the domain set and the MFA role set. */
const samePolicy = (a: AuthPolicy, b: AuthPolicy) =>
  BOOLEAN_KEYS.every((key) => a[key] === b[key]) && same(a.allowedEmailDomains, b.allowedEmailDomains) && same(a.mfaRequiredForRoles, b.mfaRequiredForRoles);

const parseDomains = (input: string): string[] => [...new Set(input.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean))];

/** What the administrator has asked for: the form's settings with the domain list as it will be stored. */
const intendedPolicy = (policy: AuthPolicy, domainInput: string): AuthPolicy => ({
  ...policy,
  allowedEmailDomains: parseDomains(domainInput),
  mfaRequiredForRoles: [...new Set(policy.mfaRequiredForRoles)],
});

const settingsOf = (policy: AuthPolicy) => ({
  allowLocalAuth: policy.allowLocalAuth,
  allowMagicLink: policy.allowMagicLink,
  allowSso: policy.allowSso,
  requireSso: policy.requireSso,
  requireInvite: policy.requireInvite,
  passwordResetAllowed: policy.passwordResetAllowed,
  allowedEmailDomains: policy.allowedEmailDomains,
  mfaRequiredForRoles: policy.mfaRequiredForRoles,
});

type Notice =
  | { kind: 'saved' }
  | { kind: 'error'; text: string }
  | { kind: 'unknown'; intended: AuthPolicy; previous: AuthPolicy };

export function AuthPolicyForm() {
  const language = failureLanguage(useLocale());
  const t = copy[language];
  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const [baseline, setBaseline] = useState<AuthPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'saving' | 'checking' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [domainInput, setDomainInput] = useState('');
  // Every load, save and check takes a new epoch; an answer that belongs to an older one is dropped, so a slow response never overwrites newer state.
  const epoch = useRef(0);
  const noticeRef = useRef<HTMLDivElement | null>(null);

  const show = useCallback((next: Notice | null) => setNotice(next), []);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  /** The policy the authoritative endpoint holds now: an uncached read. */
  const readAuthoritative = useCallback(async (): Promise<AuthPolicy | null> => {
    try {
      const res = await fetch('/api/auth/policy', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) return null;
      return readPolicy(await res.json().catch(() => null));
    } catch {
      return null;
    }
  }, []);

  const adopt = useCallback((authoritative: AuthPolicy, replaceForm: boolean) => {
    setBaseline(authoritative);
    if (replaceForm) {
      setPolicy(authoritative);
      setDomainInput(authoritative.allowedEmailDomains.join(', '));
    }
  }, []);

  const load = useCallback(async () => {
    const mine = ++epoch.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/auth/policy', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) {
        const text = userFailureText(await readApiFailure(res), t.loadFailed, language);
        if (mine === epoch.current) setLoadError(text === t.loadFailed ? text : `${t.loadFailed} ${text}`);
        return;
      }
      const loaded = readPolicy(await res.json().catch(() => null));
      if (mine !== epoch.current) return;
      if (!loaded) {
        setLoadError(t.loadFailed);
        return;
      }
      adopt(loaded, true);
    } catch {
      if (mine === epoch.current) setLoadError(t.loadFailed);
    } finally {
      if (mine === epoch.current) setLoading(false);
    }
  }, [adopt, language, t.loadFailed]);

  useEffect(() => {
    void load();
    return () => {
      epoch.current += 1;
    };
  }, [load]);

  /**
   * Settles what a write did by reading the policy back from the authoritative endpoint. Confirmed success needs the read-back to equal the intended
   * policy in every persisted field; an unchanged read-back proves nothing was saved; anything else is shown as it is.
   */
  const reconcile = useCallback(
    async (mine: number, intended: AuthPolicy, previous: AuthPolicy, outcome: 'accepted' | 'unknown' | 'conflict') => {
      const authoritative = await readAuthoritative();
      if (mine !== epoch.current) return;
      if (!authoritative) {
        show(outcome === 'conflict' ? { kind: 'error', text: t.conflict } : { kind: 'unknown', intended, previous });
        return;
      }
      if (samePolicy(authoritative, intended)) {
        adopt(authoritative, true);
        show({ kind: 'saved' });
        return;
      }
      adopt(authoritative, false);
      if (outcome === 'conflict') show({ kind: 'error', text: t.conflict });
      else if (outcome === 'unknown' && samePolicy(authoritative, previous)) show({ kind: 'error', text: t.notSavedConfirmed });
      else show({ kind: 'error', text: t.differs });
    },
    [adopt, readAuthoritative, show, t.conflict, t.differs, t.notSavedConfirmed],
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!policy || !baseline || busy) return;
    const intended = intendedPolicy(policy, domainInput);
    if (intended.requireSso && !intended.allowSso) {
      show({ kind: 'error', text: t.ssoConflict });
      return;
    }
    const mine = ++epoch.current;
    const previous = baseline;
    setBusy('saving');
    show(null);
    try {
      let res: Response | null = null;
      try {
        res = await fetch('/api/auth/policy', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...settingsOf(intended), expected: settingsOf(previous) }),
        });
      } catch {
        res = null;
      }
      if (mine !== epoch.current) return;
      if (res && res.ok) {
        await reconcile(mine, intended, previous, 'accepted');
        return;
      }
      if (res && res.status < 500 && res.status !== 408) {
        const failure = await readApiFailure(res);
        if (mine !== epoch.current) return;
        if (res.status === 409) {
          await reconcile(mine, intended, previous, 'conflict');
          return;
        }
        const reason = failureDetail(failure, language);
        show({ kind: 'error', text: reason ? `${t.notSaved} ${reason}` : t.notSaved });
        return;
      }
      await reconcile(mine, intended, previous, 'unknown');
    } finally {
      if (mine === epoch.current) setBusy(null);
    }
  }

  async function checkAgain(intended: AuthPolicy, previous: AuthPolicy) {
    const mine = ++epoch.current;
    setBusy('checking');
    show(null);
    try {
      await reconcile(mine, intended, previous, 'unknown');
    } finally {
      if (mine === epoch.current) setBusy(null);
    }
  }

  if (loading) {
    return <p role="status" className="text-sm text-gray-500">{t.loading}</p>;
  }
  if (!policy || !baseline) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{loadError ?? t.loadFailed}</p>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-sm">{t.retry}</button>
      </div>
    );
  }

  const toggleMfaRole = (role: string) => {
    const roles = new Set(policy.mfaRequiredForRoles);
    if (roles.has(role)) roles.delete(role);
    else roles.add(role);
    setPolicy({ ...policy, mfaRequiredForRoles: Array.from(roles) });
  };

  return (
    <form onSubmit={save} aria-busy={busy !== null} className="space-y-8 border border-gray-200 rounded-xl p-4 sm:p-6 bg-white">
      {notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          role={notice.kind === 'saved' ? 'status' : 'alert'}
          className={
            notice.kind === 'saved'
              ? 'text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-2 outline-none focus-visible:ring-2'
              : 'text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 outline-none focus-visible:ring-2'
          }
        >
          <p>{notice.kind === 'saved' ? t.saved : notice.kind === 'error' ? notice.text : t.unknown}</p>
          {notice.kind === 'unknown' && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void checkAgain(notice.intended, notice.previous)}
              className="mt-2 min-h-11 rounded-lg border border-red-300 bg-white px-3 py-1 font-medium hover:bg-red-100 disabled:opacity-50"
            >
              {busy === 'checking' ? t.checking : t.checkAgain}
            </button>
          )}
        </div>
      )}

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-gray-900">{t.methods}</legend>
        {(['allowLocalAuth', 'allowMagicLink', 'allowSso', 'passwordResetAllowed', 'requireInvite'] as const).map((k) => (
          <label key={k} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={policy[k]}
              onChange={(e) => setPolicy({ ...policy, [k]: e.target.checked })}
            />
            <span className="text-sm text-gray-800">{t.methodLabels[k]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-gray-900">{t.sso}</legend>
        <label className="flex min-h-11 items-start gap-2">
          <input
            type="checkbox"
            checked={policy.requireSso}
            onChange={(e) => setPolicy({ ...policy, requireSso: e.target.checked })}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-800">{t.ssoLabel}</span>
        </label>
      </fieldset>

      <section className="space-y-3">
        <h2 id="auth-policy-domains" className="text-lg font-semibold text-gray-900">{t.domains}</h2>
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          aria-labelledby="auth-policy-domains"
          aria-describedby="auth-policy-domains-help"
          placeholder="example.com, example.org"
          className="w-full min-h-11 rounded-xl border border-gray-200 px-4 py-2.5 text-sm"
        />
        <p id="auth-policy-domains-help" className="text-sm text-gray-600">{t.domainsHelp}</p>
      </section>

      <section className="space-y-3">
        <h2 id="auth-policy-mfa" className="text-lg font-semibold text-gray-900">{t.mfa}</h2>
        <p className="text-sm text-gray-600">{t.mfaHelp}</p>
        <div role="group" aria-labelledby="auth-policy-mfa" className="flex flex-wrap gap-2">
          {ROLES.map((role) => {
            const active = policy.mfaRequiredForRoles.includes(role);
            return (
              <button
                type="button"
                key={role}
                aria-pressed={active}
                onClick={() => toggleMfaRole(role)}
                className={`min-h-11 px-3 py-1.5 rounded-full text-sm border transition-colors ${
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
          disabled={busy !== null}
          className="min-h-11 w-full sm:w-auto bg-electric hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-xl disabled:opacity-50"
        >
          {busy === 'saving' ? t.saving : t.save}
        </button>
      </div>
    </form>
  );
}
