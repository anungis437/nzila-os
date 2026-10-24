'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Membership = {
  organizationName: string | null;
  status: string | null;
  membershipNumber: string | null;
  category: string | null;
  joinedAt: string | null;
  department: string | null;
  position: string | null;
};

// Services the My Union destination is meant to host. None has a verified member-facing engine yet,
// so each is listed as unavailable and is never rendered as a link, balance or empty result.
const UNAVAILABLE_SERVICES = ['agreement', 'dues', 'benefits', 'events', 'participation', 'credential'] as const;

export function MyUnion() {
  const t = useTranslations('myUnion');
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [membership, setMembership] = useState<Membership | null>(null);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch('/api/members/me');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const value = body?.data?.membership ?? body?.membership ?? null;
      setMembership(value);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const statusLabel = (value: string | null) => {
    const key = `status.${String(value ?? '').toLowerCase()}`;
    return value && t.has(key) ? t(key) : value ?? t('notRecorded');
  };
  const field = (label: string, value: string | null | undefined) => (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || t('notRecorded')}</dd>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="my-union">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section aria-labelledby="union-membership" className="rounded-lg border p-4">
        <h2 id="union-membership" className="mb-3 text-lg font-semibold">{t('membershipTitle')}</h2>
        {state === 'loading' && <Skeleton className="h-24 w-full" role="status" aria-busy="true" />}
        {state === 'error' && (
          <div role="alert" className="text-sm text-destructive">
            {t('loadError')}
            <Button variant="link" size="sm" onClick={() => void load()}>{t('retry')}</Button>
          </div>
        )}
        {state === 'ready' && !membership && (
          <div data-testid="membership-missing">
            <p className="text-sm">{t('missingTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('missingBody')}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/${locale}/dashboard/messages`}>{t('contactUnion')}</Link>
            </Button>
          </div>
        )}
        {state === 'ready' && membership && (
          <>
            <dl className="grid gap-4 sm:grid-cols-2" data-testid="membership-details">
              {field(t('union'), membership.organizationName)}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('statusLabel')}</dt>
                <dd><Badge variant="secondary">{statusLabel(membership.status)}</Badge></dd>
              </div>
              {field(t('membershipNumber'), membership.membershipNumber)}
              {field(t('category'), membership.category?.replace(/[-_]+/g, ' '))}
              {field(t('memberSince'), membership.joinedAt ? dateFormat.format(new Date(membership.joinedAt)) : null)}
              {field(t('department'), membership.department)}
              {field(t('position'), membership.position)}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">{t('recordNote')}</p>
          </>
        )}
      </section>

      <section aria-labelledby="union-services" className="rounded-lg border p-4">
        <h2 id="union-services" className="mb-1 text-lg font-semibold">{t('servicesTitle')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('servicesIntro')}</p>
        <ul className="space-y-3" data-testid="union-services">
          {UNAVAILABLE_SERVICES.map((service) => (
            <li key={service} className="rounded-md border border-dashed p-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {t(`services.${service}.title`)}
                <Badge variant="outline">{t('notAvailableYet')}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">{t(`services.${service}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
