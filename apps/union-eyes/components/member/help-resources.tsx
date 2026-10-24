import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

const STEPS = ['open', 'evidence', 'follow', 'message'] as const;

/**
 * Static guidance only. It informs and signposts to real features; it contains no contacts, deadlines
 * or legal conclusions, because none are backed by verified data.
 */
export async function HelpResources() {
  const t = await getTranslations('memberHelp');
  const locale = await getLocale();
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6" data-testid="member-help">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <section aria-labelledby="help-urgent" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
        <h2 id="help-urgent" className="mb-1 text-lg font-semibold">{t('urgentTitle')}</h2>
        <p className="text-sm">{t('urgentBody')}</p>
      </section>

      <section aria-labelledby="help-steps" className="rounded-lg border p-4">
        <h2 id="help-steps" className="mb-3 text-lg font-semibold">{t('stepsTitle')}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {STEPS.map((step) => <li key={step}>{t(`steps.${step}`)}</li>)}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/${locale}/dashboard/claims/new`} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">{t('openCase')}</Link>
          <Link href={`/${locale}/dashboard/messages`} className="rounded-md border px-3 py-2 text-sm font-medium">{t('messageUnion')}</Link>
        </div>
      </section>

      <section aria-labelledby="help-rights" className="rounded-lg border p-4">
        <h2 id="help-rights" className="mb-2 text-lg font-semibold">{t('rightsTitle')}</h2>
        <p className="text-sm">{t('rightsBody')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('notLegalAdvice')}</p>
      </section>

      <section aria-labelledby="help-contact" className="rounded-lg border p-4">
        <h2 id="help-contact" className="mb-2 text-lg font-semibold">{t('contactTitle')}</h2>
        <p className="text-sm">{t('contactBody')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('directoryUnavailable')}</p>
      </section>

      <section aria-labelledby="help-access" className="rounded-lg border p-4">
        <h2 id="help-access" className="mb-2 text-lg font-semibold">{t('accessTitle')}</h2>
        <p className="text-sm">{t('accessBody')}</p>
      </section>
    </div>
  );
}
