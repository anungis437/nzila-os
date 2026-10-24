import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

/**
 * Privacy information and the only request path that exists today: a secure message to the union.
 * Self-service access, correction and consent-withdrawal flows are not implemented, and this page
 * says so rather than offering controls that would not take effect.
 */
export async function MemberPrivacy() {
  const t = await getTranslations('memberPrivacy');
  const locale = await getLocale();
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-privacy">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section aria-labelledby="privacy-access" className="rounded-lg border p-4">
        <h2 id="privacy-access" className="mb-2 text-lg font-semibold">{t('accessTitle')}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{t('accessYou')}</li>
          <li>{t('accessRepresentatives')}</li>
          <li>{t('accessNotMembers')}</li>
        </ul>
      </section>

      <section aria-labelledby="privacy-yours" className="rounded-lg border p-4">
        <h2 id="privacy-yours" className="mb-2 text-lg font-semibold">{t('yoursTitle')}</h2>
        <p className="text-sm">{t('yoursBody')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/${locale}/dashboard/profile`} className="rounded-md border px-3 py-2 text-sm font-medium">{t('viewProfile')}</Link>
          <Link href={`/${locale}/dashboard/preferences`} className="rounded-md border px-3 py-2 text-sm font-medium">{t('viewPreferences')}</Link>
        </div>
      </section>

      <section aria-labelledby="privacy-requests" className="rounded-lg border p-4">
        <h2 id="privacy-requests" className="mb-2 text-lg font-semibold">{t('requestsTitle')}</h2>
        <p className="text-sm">{t('requestsBody')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('selfServiceUnavailable')}</p>
        <Link href={`/${locale}/dashboard/messages?compose=privacy`} className="mt-3 inline-block rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" data-testid="privacy-request-link">
          {t('sendRequest')}
        </Link>
      </section>
    </div>
  );
}
