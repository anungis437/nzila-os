/**
 * /workbook/start \u2014 entry point.
 *
 * Server component: creates a pseudonymous workbook via the start API and
 * server-side redirects to the workbook hub. UTM params on the URL are
 * forwarded into the workbook record for attribution.
 */

import { redirect } from 'next/navigation';
import { db } from '@/db';
import { workbooks, workbookModules, WORKBOOK_MODULE_IDS } from '@/db/schema/workbook-schema';

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
  const utmSource = typeof sp.utm_source === 'string' ? sp.utm_source : null;
  const utmMedium = typeof sp.utm_medium === 'string' ? sp.utm_medium : null;
  const utmCampaign = typeof sp.utm_campaign === 'string' ? sp.utm_campaign : null;

  const [wb] = await db
    .insert(workbooks)
    .values({
      locale,
      utmSource,
      utmMedium,
      utmCampaign,
    })
    .returning({ id: workbooks.id });

  if (!wb) {
    throw new Error('Failed to create workbook');
  }

  await db
    .insert(workbookModules)
    .values(
      WORKBOOK_MODULE_IDS.map((moduleId) => ({
        workbookId: wb.id,
        moduleId,
        status: 'not_started',
      })),
    )
    .onConflictDoNothing();

  redirect(`/${locale}/workbook/${wb.id}/memory-holders`);
}
