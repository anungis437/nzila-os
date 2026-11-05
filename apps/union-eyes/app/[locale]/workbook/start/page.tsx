/**
 * /workbook/start — entry point.
 *
 * Renders the start control only. Creating the workbook is a guarded POST to /api/workbook/start (rate limit, body cap, bot challenge),
 * which also issues the workbook's capability; a page render that inserted rows could do none of that. UTM params on the URL are
 * forwarded into the workbook record for attribution.
 */

import WorkbookStartClient from './WorkbookStartClient';

export const dynamic = 'force-dynamic';

export default async function WorkbookStartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const pick = (value: string | string[] | undefined) => (typeof value === 'string' ? value.slice(0, 128) : null);

  return (
    <WorkbookStartClient
      locale={locale}
      utm={{ source: pick(sp.utm_source), medium: pick(sp.utm_medium), campaign: pick(sp.utm_campaign) }}
    />
  );
}
