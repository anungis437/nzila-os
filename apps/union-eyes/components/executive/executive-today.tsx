import Link from 'next/link';
import { PageHeading } from '@/components/dashboard/page-heading';
import { getTodayCopy, type TodayCard, type TodayModel } from '@/lib/executive/today';

interface ExecutiveTodayProps {
  locale: string;
  model: TodayModel;
  sourceError: boolean;
}

export function ExecutiveToday({ locale, model, sourceError }: ExecutiveTodayProps) {
  const copy = getTodayCopy(locale);
  const withLocale = (href: string) => `/${locale}${href}`;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.intro} />

      <section aria-labelledby="executive-mandate-heading" className="rounded-md border p-4">
        <h2 id="executive-mandate-heading" className="text-base font-semibold">{copy.mandateTitle}</h2>
        <p role="status" className="mt-1 text-sm text-muted-foreground">{copy[model.mandateStatus]}</p>
      </section>

      {sourceError && (
        <p role="alert" className="rounded-md border border-amber-500 p-3 text-sm">{copy.sourceError}</p>
      )}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {model.cards.map((card) => (
          <TodayCardItem key={card.id} card={card} copy={copy} locale={locale} withLocale={withLocale} />
        ))}
      </ul>

      {model.provenance && (
        <footer className="text-xs text-muted-foreground">
          <p>
            {copy.provenance}: {model.provenance.sources.map((s) => `${s.table} (${s.rowCount} ${copy.rows})`).join(', ')}.{' '}
            {copy.generated} {model.provenance.generatedAt} ({model.provenance.cacheHit ? copy.cached : copy.live}).
          </p>
        </footer>
      )}
    </div>
  );
}

function TodayCardItem({
  card,
  copy,
  locale,
  withLocale,
}: {
  card: TodayCard;
  copy: ReturnType<typeof getTodayCopy>;
  locale: string;
  withLocale: (href: string) => string;
}) {
  const text = copy.cards[card.id];
  const headingId = `today-card-${card.id}`;
  return (
    <li>
      <article aria-labelledby={headingId} className="h-full rounded-md border p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 id={headingId} className="text-base font-semibold">{text.title}</h2>
          <span className="rounded border px-2 py-0.5 text-xs">{copy.states[card.state]}</span>
        </div>
        <p className="mt-2 text-2xl font-bold">
          {card.value === undefined ? <span className="text-sm font-normal">{copy.unavailableValue}</span> : card.value.toLocaleString(locale)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{text.body}</p>
        {card.href && (
          <Link className="mt-3 inline-block text-sm underline" href={withLocale(card.href)}>
            {copy.open}: {text.title}
          </Link>
        )}
      </article>
    </li>
  );
}
