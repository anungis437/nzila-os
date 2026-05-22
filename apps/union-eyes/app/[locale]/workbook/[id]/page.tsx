/**
 * /workbook/[id] \u2014 module hub for an existing workbook.
 *
 * Lists the six continuity mapping modules; Memory Holders is unlocked,
 * the other five render as "Reserved for the Facilitated Edition" cards
 * (held, not paywalled).
 */

import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
import { WORKBOOK_COPY, isFrench, type Locale } from '@/lib/workbook/copy';

export const dynamic = 'force-dynamic';

export default async function WorkbookHubPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const fr = isFrench(locale);
  const l: Locale = fr ? 'fr-CA' : 'en-CA';

  const [wb] = await db
    .select({ id: workbooks.id, reportTierId: workbooks.reportTierId, status: workbooks.status })
    .from(workbooks)
    .where(eq(workbooks.id, id))
    .limit(1);

  if (!wb) notFound();

  const isPaid = wb.reportTierId === 'workbook_self_guided';

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
        <p className="text-[0.78rem] uppercase tracking-[0.32em] text-stone-500">
          {WORKBOOK_COPY.hero.eyebrow[l]}
        </p>
        <h1 className="mt-4 text-3xl font-light leading-tight text-stone-900 sm:text-4xl">
          {fr ? 'Votre cahier de cartographie' : 'Your mapping workbook'}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-stone-600">
          {fr
            ? 'Commencez par les Porteurs de m\u00e9moire institutionnelle. Les autres modules sont r\u00e9serv\u00e9s \u00e0 l\u2019\u00e9dition facilit\u00e9e.'
            : 'Begin with the Institutional Memory Holders. The other modules are reserved for the Facilitated Edition.'}
        </p>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {WORKBOOK_COPY.modules.items.map((m) => {
            const unlocked = m.unlockedInSelfGuided;
            const href = unlocked ? `/${locale}/workbook/${id}/${m.id.replace(/_/g, '-')}` : null;
            return (
              <li
                key={m.id}
                className={`rounded-lg border bg-white p-7 ${
                  unlocked ? 'border-stone-900 shadow-sm' : 'border-stone-200'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-medium text-stone-900">{m.title[l]}</h2>
                  {unlocked ? (
                    <span className="rounded bg-stone-900 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-stone-50">
                      {fr ? 'Disponible' : 'Open'}
                    </span>
                  ) : (
                    <span className="text-[0.65rem] font-medium uppercase tracking-wider text-stone-400">
                      {fr ? 'Facilit\u00e9' : 'Facilitated'}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-stone-600">{m.body[l]}</p>
                {href ? (
                  <Link
                    href={href}
                    className="mt-6 inline-flex items-center rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
                  >
                    {fr ? 'Ouvrir le module' : 'Open module'}
                  </Link>
                ) : (
                  <p className="mt-6 text-xs italic text-stone-500">
                    {fr
                      ? 'R\u00e9serv\u00e9 \u00e0 l\u2019\u00e9dition facilit\u00e9e.'
                      : 'Reserved for the Facilitated Edition.'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {isPaid ? (
          <div className="mt-16 rounded-lg border border-stone-200 bg-white p-7">
            <h3 className="text-base font-medium text-stone-900">
              {fr ? 'Exporter votre cahier' : 'Export your workbook'}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              {fr
                ? 'T\u00e9l\u00e9chargez le PDF ex\u00e9cutif avec page de titre, table des mati\u00e8res et chapitres d\u00e9verrouill\u00e9s.'
                : 'Download the executive PDF with cover, table of contents, and unlocked chapters.'}
            </p>
            <Link
              href={`/api/workbook/${id}/export`}
              className="mt-5 inline-flex items-center rounded-md border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-900 hover:bg-stone-100"
            >
              {fr ? 'T\u00e9l\u00e9charger le PDF' : 'Download PDF'}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
