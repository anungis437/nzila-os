'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiErrorMessage, isRecord, ApiShapeError } from '@/lib/client/api-envelope';
import RepresentativeMatchingProfiles from './representative-matching-profiles';

interface Invitation {
  id: string; email: string; role: string; expiresAt: string;
  acceptedAt: string | null; revokedAt: string | null;
}

const copy = {
  en: {
    title: 'Organization invitations', scope: 'Manage invitations for your active organization.',
    email: 'Email', role: 'Role', create: 'Create invitation', refresh: 'Refresh',
    loading: 'Loading invitations…', empty: 'No invitations on file.',
    sent: 'Invitation email submitted. Inbox receipt has not been confirmed.',
    failed: 'Invitation created, but email submission could not be confirmed. Use Reissue to send a new link, or revoke the invitation.',
    revoked: 'Invitation revoked. Its link can no longer be accepted.',
    unavailable: 'The request could not be completed. Refresh the list before retrying.',
    loadFailed: 'Invitations could not be loaded.', pending: 'Pending acceptance', accepted: 'Accepted',
    expired: 'Expired', revokedState: 'Revoked', reissue: 'Reissue', revoke: 'Revoke',
    expiry: 'Expires', busy: 'Working…', latest: 'Latest 100 invitations. Email delivery history is not recorded in this list.',
    roles: { member: 'Member', steward: 'Steward', chief_steward: 'Chief steward', officer: 'Officer', admin: 'Organization administrator' },
  },
  fr: {
    title: 'Invitations de l’organisation', scope: 'Gérez les invitations de votre organisation active.',
    email: 'Courriel', role: 'Rôle', create: 'Créer une invitation', refresh: 'Actualiser',
    loading: 'Chargement des invitations…', empty: 'Aucune invitation enregistrée.',
    sent: 'Courriel d’invitation soumis. La réception dans la boîte de courriel n’est pas confirmée.',
    failed: 'Invitation créée, mais l’envoi du courriel n’est pas confirmé. Utilisez Réémettre pour envoyer un nouveau lien, ou révoquez l’invitation.',
    revoked: 'Invitation révoquée. Son lien ne peut plus être accepté.',
    unavailable: 'La demande n’a pas pu être traitée. Actualisez la liste avant de réessayer.',
    loadFailed: 'Impossible de charger les invitations.', pending: 'En attente d’acceptation', accepted: 'Acceptée',
    expired: 'Expirée', revokedState: 'Révoquée', reissue: 'Réémettre', revoke: 'Révoquer',
    expiry: 'Expiration', busy: 'Traitement…', latest: '100 invitations les plus récentes. Cette liste ne contient pas l’historique de livraison des courriels.',
    roles: { member: 'Membre', steward: 'Délégué', chief_steward: 'Délégué en chef', officer: 'Dirigeant', admin: 'Administrateur de l’organisation' },
  },
};

export default function OrganizationInvitations() {
  const locale = useLocale();
  const t = copy[locale.startsWith('fr') ? 'fr' : 'en'];
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/invite/manage');
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, t.loadFailed));
      if (!isRecord(data) || !Array.isArray(data.invitations)) throw new Error(t.loadFailed);
      const rows = data.invitations.map((row: unknown): Invitation => {
        if (!isRecord(row) || typeof row.id !== 'string' || typeof row.email !== 'string' || typeof row.role !== 'string' || typeof row.expiresAt !== 'string' ||
          !(row.acceptedAt === null || typeof row.acceptedAt === 'string') || !(row.revokedAt === null || typeof row.revokedAt === 'string')) throw new ApiShapeError('invitation metadata');
        return { id: row.id, email: row.email, role: row.role, expiresAt: row.expiresAt, acceptedAt: row.acceptedAt, revokedAt: row.revokedAt };
      });
      setInvitations(rows);
      setProblem(null);
    } catch {
      setProblem(t.loadFailed);
    } finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function act(action?: 'reissue' | 'revoke', inviteId?: string) {
    setBusy(true); setProblem(null); setNotice(null);
    try {
      const response = await fetch(action ? '/api/auth/invite/manage' : '/api/auth/invite/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action ? { action, inviteId } : { email: email.trim(), role }),
      });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(data, t.unavailable));
      if (!isRecord(data) || (action === 'revoke'
        ? data.success !== true
        : typeof data.inviteId !== 'string' || !['sent', 'failed'].includes(String(data.delivery)))) throw new Error(t.unavailable);
      // A 201 means a durable invitation, not that the email reached its recipient.
      setNotice(action === 'revoke' ? t.revoked : isRecord(data) && data.delivery === 'sent' ? t.sent : t.failed);
      if (!action) { setEmail(''); setRole('member'); }
      await refresh();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : t.unavailable);
    } finally { setBusy(false); }
  }

  return <><section className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-semibold">{t.title}</h1><p>{t.scope}</p></div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void act(); }}>
      <label className="min-w-0 flex-1">{t.email}<Input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>{t.role}<select className="block min-h-10 max-w-full rounded border p-2" value={role} onChange={event => setRole(event.target.value)}>
        {Object.entries(t.roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <Button type="submit" disabled={busy || loading}>{busy ? t.busy : t.create}</Button>
    </form>
    {problem && <p role="alert" className="text-destructive">{problem}</p>}
    {notice && <p role="status" className="rounded border p-3">{notice}</p>}
    <Button variant="outline" disabled={busy || loading} onClick={() => void refresh()}>{t.refresh}</Button>
    <p className="text-sm text-muted-foreground">{t.latest}</p>
    {loading ? <p>{t.loading}</p> : problem && invitations.length === 0 ? null : invitations.length === 0 ? <p>{t.empty}</p> : <ul className="space-y-3">
      {invitations.map(invite => {
        const state = invite.acceptedAt ? t.accepted : invite.revokedAt ? t.revokedState : new Date(invite.expiresAt).getTime() <= Date.now() ? t.expired : t.pending;
        const actionable = !invite.acceptedAt && !invite.revokedAt;
        return <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
          <div className="min-w-0 break-words"><p>{invite.email}</p><p>{t.roles[invite.role as keyof typeof t.roles] ?? invite.role} · {state}</p>
            <p className="text-sm">{t.expiry}: {new Date(invite.expiresAt).toLocaleString(locale)}</p></div>
          {actionable && <div className="flex gap-2">
            <Button variant="outline" disabled={busy || !!problem} onClick={() => void act('reissue', invite.id)} aria-label={`${t.reissue}: ${invite.email}`}>{t.reissue}</Button>
            <Button variant="outline" disabled={busy || !!problem} onClick={() => void act('revoke', invite.id)} aria-label={`${t.revoke}: ${invite.email}`}>{t.revoke}</Button>
          </div>}
        </li>;
      })}
    </ul>}
  </section><RepresentativeMatchingProfiles /></>;
}
