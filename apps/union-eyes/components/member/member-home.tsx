'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Briefcase, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { claimLabelKey } from '@/components/claims/member-case-list';
import { ApiShapeError, envelopeData, isRecord, readApiError } from '@/lib/client/api-envelope';
import { fetchAllRows } from '@/lib/client/crud-lists';
import { asRecord, optionalString, requiredCount, requiredDate, requiredString } from '@/lib/client/row-fields';
import { announceInboxChanged } from '@/lib/notifications/unread-count';

type Load<T> = { state: 'loading' } | { state: 'error'; reason: string } | { state: 'ready'; value: T };

// claims.claim_number and claims.claim_type are nullable columns: a case that has neither says so instead of showing a made-up value.
type CaseSummary = { claimId: string; claimNumber: string | null; claimType: string | null; status: string };
type NotificationSummary = { id: string; title: string; message: string; actionUrl: string | null; createdAt: Date };
type UnreadNotifications = { items: NotificationSummary[]; unreadCount: number };

// The claim_status values after which a case no longer needs the member's attention.
const INACTIVE = new Set(['resolved', 'rejected', 'closed']);
const SHOWN_NOTIFICATIONS = 5;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function refusal(response: Response): Promise<Error> {
  return new Error(await readApiError(response, `Request failed with status ${response.status}`));
}

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => {
    throw new ApiShapeError('the answer is not JSON');
  });
}

// /api/auth/me answers plain JSON: { user: { firstName, ... } } or { user: null }.
async function loadFirstName(): Promise<string | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) throw await refusal(response);
  const body = await readBody(response);
  if (!isRecord(body) || !('user' in body)) throw new ApiShapeError('no user');
  if (body.user === null) return null;
  return optionalString(asRecord(body.user, 'user'), 'firstName');
}

// /api/claims lists the caller's own claims, newest first, one page at a time: every page is read, so an active case is never cut off.
async function loadCases(): Promise<CaseSummary[]> {
  const rows = await fetchAllRows<unknown>('/api/claims');
  return rows.map((row) => {
    const claim = asRecord(row, 'claim');
    return {
      claimId: requiredString(claim, 'claimId'),
      claimNumber: optionalString(claim, 'claimNumber'),
      claimType: optionalString(claim, 'claimType'),
      status: requiredString(claim, 'status'),
    };
  });
}

// /api/notifications answers { success, data: { notifications, unreadCount, pagination } }.
async function loadNotifications(): Promise<UnreadNotifications> {
  const response = await fetch(`/api/notifications?unreadOnly=true&limit=${SHOWN_NOTIFICATIONS}`);
  if (!response.ok) throw await refusal(response);
  const payload = envelopeData(await readBody(response));
  if (!Array.isArray(payload.notifications)) throw new ApiShapeError('no notifications');
  const items = payload.notifications.map((row: unknown): NotificationSummary => {
    const notification = asRecord(row, 'notification');
    return {
      id: requiredString(notification, 'id'),
      title: requiredString(notification, 'title'),
      message: requiredString(notification, 'message'),
      actionUrl: optionalString(notification, 'actionUrl'),
      createdAt: requiredDate(notification, 'createdAt'),
    };
  });
  return { items, unreadCount: requiredCount(payload, 'unreadCount') };
}

function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void] {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' });
  const load = useCallback(() => {
    fetcher().then(
      (value) => setResult({ state: 'ready', value }),
      (error: unknown) => setResult({ state: 'error', reason: reasonOf(error) }),
    );
  }, [fetcher]);
  useEffect(() => {
    load();
  }, [load]);
  const retry = useCallback(() => {
    setResult({ state: 'loading' });
    load();
  }, [load]);
  return [result, retry];
}

export function MemberHome() {
  const t = useTranslations('memberHome');
  const types = useTranslations('claimTypes');
  const statuses = useTranslations('status');
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  // The greeting is the only thing that depends on this request: without a name the page says "Welcome", it does not guess one.
  const [name] = useLoad(loadFirstName);
  const [cases, reloadCases] = useLoad(loadCases);
  const [notifications, reloadNotifications] = useLoad(loadNotifications);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const typeLabel = (value: string) => {
    const key = claimLabelKey(value);
    return types.has(key) ? types(key) : value.replace(/[-_]+/g, ' ');
  };
  // Claim statuses (under_review, pending_documentation ...) are worded under claimTypes; the shared status vocabulary comes second.
  const statusLabel = (value: string) => {
    const key = claimLabelKey(value);
    if (types.has(key)) return types(key);
    if (statuses.has(key)) return statuses(key);
    return value.replace(/[-_]+/g, ' ');
  };
  const localizedHref = (href: string) => (href.startsWith(`/${locale}/`) ? href : `/${locale}${href}`);

  const markAllRead = async () => {
    setMarking(true);
    setMarkError(null);
    try {
      const response = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (!response.ok) throw await refusal(response);
      // The route confirms with { success, data: { success: true, updated } }; anything else is not a confirmation.
      const payload = envelopeData(await readBody(response));
      if (payload.success !== true) throw new ApiShapeError('the request was not confirmed');
      announceInboxChanged();
      reloadNotifications();
    } catch (error) {
      setMarkError(reasonOf(error));
    } finally {
      setMarking(false);
    }
  };

  const firstName = name.state === 'ready' ? name.value : null;
  const activeCases = cases.state === 'ready' ? cases.value.filter((c) => !INACTIVE.has(c.status.toLowerCase())) : [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-home">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{firstName ? t('greeting', { name: firstName }) : t('greetingAnonymous')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section aria-labelledby="home-attention" className="rounded-lg border p-4">
        <h2 id="home-attention" className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Bell className="h-5 w-5" aria-hidden />
          {t('attentionTitle')}
        </h2>
        <div className="space-y-3">
          <div>
            <Link href={`/${locale}/dashboard/messages`} className="flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <MessageSquare className="h-4 w-4" aria-hidden />
              {t('openMessages')}
            </Link>
          </div>
          {notifications.state === 'loading' && <Skeleton className="h-12 w-full" role="status" aria-busy="true" />}
          {notifications.state === 'error' && (
            <div role="alert" className="text-sm text-destructive">
              {t('notificationsLoadError')}
              <span className="block text-xs">{notifications.reason}</span>
              <Button variant="link" size="sm" onClick={reloadNotifications}>{t('retry')}</Button>
            </div>
          )}
          {notifications.state === 'ready' && notifications.value.items.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="home-no-notifications">{t('noNotifications')}</p>
          )}
          {notifications.state === 'ready' && notifications.value.items.length > 0 && (
            <>
              <ul className="space-y-2" data-testid="home-notifications">
                {notifications.value.items.map((n) => (
                  <li key={n.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.message}</p>
                    <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{dateFormat.format(n.createdAt)}</span>
                      {n.actionUrl?.startsWith('/') && (
                        <Link href={localizedHref(n.actionUrl)} className="font-medium text-primary underline-offset-4 hover:underline">{t('open')}</Link>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              {notifications.value.unreadCount > notifications.value.items.length && (
                <p className="text-xs text-muted-foreground" data-testid="home-notifications-more">
                  {t('notificationsShowing', { shown: notifications.value.items.length, total: notifications.value.unreadCount })}
                </p>
              )}
              {markError !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {t('markAllReadError')}
                  <span className="block text-xs">{markError}</span>
                </p>
              )}
              <Button variant="outline" size="sm" disabled={marking} onClick={markAllRead}>{t('markAllRead')}</Button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="home-matters" className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="home-matters" className="flex items-center gap-2 text-lg font-semibold">
            <Briefcase className="h-5 w-5" aria-hidden />
            {t('mattersTitle')}
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${locale}/dashboard/claims`}>{t('viewAllCases')}</Link>
          </Button>
        </div>
        {cases.state === 'loading' && <Skeleton className="h-20 w-full" role="status" aria-busy="true" />}
        {cases.state === 'error' && (
          <div role="alert" className="text-sm text-destructive">
            {t('casesLoadError')}
            <span className="block text-xs">{cases.reason}</span>
            <Button variant="link" size="sm" onClick={reloadCases}>{t('retry')}</Button>
          </div>
        )}
        {cases.state === 'ready' && activeCases.length === 0 && (
          <div data-testid="home-no-cases">
            <p className="text-sm text-muted-foreground">{t('noActiveCases')}</p>
            <Button asChild size="sm" className="mt-3">
              <Link href={`/${locale}/dashboard/claims/new`}>{t('openCase')}</Link>
            </Button>
          </div>
        )}
        {cases.state === 'ready' && activeCases.length > 0 && (
          <ul className="space-y-2" data-testid="home-cases">
            {activeCases.slice(0, 5).map((c) => (
              <li key={c.claimId}>
                <Link href={`/${locale}/dashboard/claims/${encodeURIComponent(c.claimId)}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm hover:bg-muted/50">
                  <span>
                    <span className="font-medium">{c.claimNumber ?? '—'}</span>
                    {c.claimType !== null && <span className="text-muted-foreground"> · {typeLabel(c.claimType)}</span>}
                  </span>
                  <Badge variant="secondary">{statusLabel(c.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
