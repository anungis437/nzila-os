'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiShapeError, envelopeData, readApiError } from '@/lib/client/api-envelope';
import { asRecord, optionalString } from '@/lib/client/row-fields';

type Membership = {
  organizationName: string | null;
  status: string | null;
  membershipNumber: string | null;
  category: string | null;
  joinedAt: Date | null;
  department: string | null;
  position: string | null;
};

// Services the My Union destination is meant to host. None has a verified member-facing engine yet,
// so each is listed as unavailable and is never rendered as a link, balance or empty result.
const UNAVAILABLE_SERVICES = ['agreement', 'dues', 'benefits', 'events', 'participation', 'credential'] as const;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * /api/members/me answers { success, data: { membership } } where membership is the caller's record or null when the organization holds none.
 * An answer without a `membership` member is not "no record": it is an error.
 */
async function readMembership(response: Response): Promise<Membership | null> {
  const body: unknown = await response.json().catch(() => {
    throw new ApiShapeError('the answer is not JSON');
  });
  const payload = envelopeData(body);
  if (!('membership' in payload)) throw new ApiShapeError('no membership');
  if (payload.membership === null) return null;
  const row = asRecord(payload.membership, 'membership');
  const joinedAt = optionalString(row, 'joinedAt');
  const joined = joinedAt === null ? null : new Date(joinedAt);
  if (joined !== null && Number.isNaN(joined.getTime())) throw new ApiShapeError('joinedAt is not a date');
  return {
    organizationName: optionalString(row, 'organizationName'),
    status: optionalString(row, 'status'),
    membershipNumber: optionalString(row, 'membershipNumber'),
    category: optionalString(row, 'category'),
    joinedAt: joined,
    department: optionalString(row, 'department'),
    position: optionalString(row, 'position'),
  };
}

async function fetchMembership(): Promise<Membership | null> {
  const response = await fetch('/api/members/me');
  if (!response.ok) throw new Error(await readApiError(response, `Request failed with status ${response.status}`));
  return readMembership(response);
}

export function MyUnion() {
  const t = useTranslations('myUnion');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  // A join date is a calendar date stored at midnight UTC: shown in UTC it is the day that was recorded, in a local zone it can be the day before.
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });

  const load = useCallback(() => {
    fetchMembership().then(
      (value) => {
        setMembership(value);
        setLoadError(null);
        setLoading(false);
      },
      (error: unknown) => {
        setLoadError(reasonOf(error));
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    load();
  };

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
        {loading && <Skeleton className="h-24 w-full" role="status" aria-busy="true" />}
        {!loading && loadError !== null && (
          <div role="alert" className="text-sm text-destructive">
            {t('loadError')}
            <span className="block text-xs">{loadError}</span>
            <Button variant="link" size="sm" onClick={retry}>{t('retry')}</Button>
          </div>
        )}
        {!loading && loadError === null && !membership && (
          <div data-testid="membership-missing">
            <p className="text-sm">{t('missingTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('missingBody')}</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/${locale}/dashboard/messages`}>{t('contactUnion')}</Link>
            </Button>
          </div>
        )}
        {!loading && loadError === null && membership && (
          <>
            <dl className="grid gap-4 sm:grid-cols-2" data-testid="membership-details">
              {field(t('union'), membership.organizationName)}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('statusLabel')}</dt>
                <dd><Badge variant="secondary">{statusLabel(membership.status)}</Badge></dd>
              </div>
              {field(t('membershipNumber'), membership.membershipNumber)}
              {field(t('category'), membership.category?.replace(/[-_]+/g, ' '))}
              {field(t('memberSince'), membership.joinedAt ? dateFormat.format(membership.joinedAt) : null)}
              {field(t('department'), membership.department)}
              {field(t('position'), membership.position)}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">{t('recordNote')}</p>
          </>
        )}
      </section>

      <section aria-labelledby="union-reviews" className="rounded-lg border p-4">
        <h2 id="union-reviews" className="mb-1 text-lg font-semibold">{t('reviewsTitle')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('reviewsBody')}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/dashboard/union/reviews`}>{t('reviewsLink')}</Link>
        </Button>
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
