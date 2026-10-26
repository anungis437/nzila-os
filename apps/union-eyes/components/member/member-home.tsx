'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Briefcase, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { claimLabelKey } from '@/components/claims/member-case-list';

type Load<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; value: T };

type CaseSummary = { claimId: string; claimNumber: string; claimType: string; status: string; createdAt: string };
type NotificationSummary = { id: string; title: string | null; message: string | null; actionUrl: string | null; createdAt: string };

// Statuses after which a case no longer needs the member's attention.
const INACTIVE = new Set(['resolved', 'rejected', 'closed', 'withdrawn', 'settled', 'archived']);

async function getJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function useLoad<T>(fetcher: () => Promise<T>): [Load<T>, () => void] {
  const [result, setResult] = useState<Load<T>>({ state: 'loading' });
  const run = useCallback(() => {
    setResult({ state: 'loading' });
    fetcher().then((value) => setResult({ state: 'ready', value }), () => setResult({ state: 'error' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run();
  }, [run]);
  return [result, run];
}

export function MemberHome() {
  const t = useTranslations('memberHome');
  const types = useTranslations('claimTypes');
  const statuses = useTranslations('status');
  const locale = useLocale();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const [name] = useLoad<string>(async () => {
    const body = await getJson('/api/auth/me');
    return String(body?.user?.firstName ?? body?.data?.user?.firstName ?? '');
  });
  const [cases, reloadCases] = useLoad<CaseSummary[]>(async () => {
    const body = await getJson('/api/claims');
    const payload = body?.data ?? body;
    const list: unknown[] = Array.isArray(payload) ? payload : (payload?.data ?? payload?.claims ?? []);
    return (Array.isArray(list) ? list : []).map((row) => {
      const c = row as Record<string, unknown>;
      return {
        claimId: String(c.claimId ?? c.id ?? ''),
        claimNumber: String(c.claimNumber ?? c.id ?? ''),
        claimType: String(c.claimType ?? ''),
        status: String(c.status ?? ''),
        createdAt: String(c.createdAt ?? ''),
      };
    }).filter((c) => c.claimId);
  });
  const [notifications, reloadNotifications] = useLoad<NotificationSummary[]>(async () => {
    const body = await getJson('/api/notifications?unreadOnly=true&limit=5');
    const list = body?.data?.notifications ?? body?.notifications ?? [];
    return Array.isArray(list) ? list : [];
  });

  const typeLabel = (value: string) => {
    const key = claimLabelKey(value);
    return value && types.has(key) ? types(key) : value.replace(/[-_]+/g, ' ');
  };
  const statusLabel = (value: string) => {
    const key = claimLabelKey(value);
    if (statuses.has(key)) return statuses(key);
    return value.replace(/[-_]+/g, ' ');
  };
  const localizedHref = (href: string) => (href.startsWith(`/${locale}/`) ? href : `/${locale}${href}`);

  const markAllRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' }).catch(() => null);
    reloadNotifications();
  };

  const firstName = name.state === 'ready' ? name.value : '';
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
              <Button variant="link" size="sm" onClick={reloadNotifications}>{t('retry')}</Button>
            </div>
          )}
          {notifications.state === 'ready' && notifications.value.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="home-no-notifications">{t('noNotifications')}</p>
          )}
          {notifications.state === 'ready' && notifications.value.length > 0 && (
            <>
              <ul className="space-y-2" data-testid="home-notifications">
                {notifications.value.map((n) => (
                  <li key={n.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{n.title}</p>
                    {n.message && <p className="text-muted-foreground">{n.message}</p>}
                    <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{dateFormat.format(new Date(n.createdAt))}</span>
                      {n.actionUrl?.startsWith('/') && (
                        <Link href={localizedHref(n.actionUrl)} className="font-medium text-primary underline-offset-4 hover:underline">{t('open')}</Link>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={markAllRead}>{t('markAllRead')}</Button>
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
                    <span className="font-medium">{c.claimNumber}</span>
                    <span className="text-muted-foreground"> · {typeLabel(c.claimType)}</span>
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
