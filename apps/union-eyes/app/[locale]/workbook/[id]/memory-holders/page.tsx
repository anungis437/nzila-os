/**
 * /workbook/[id]/memory-holders \u2014 server shell.
 *
 * Loads the workbook + initial cartography server-side and hands off to
 * an interactive client component for inline editing.
 */

import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { workbookMemoryHolders, workbooks } from '@/db/schema/workbook-schema';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';
import { isFrench } from '@/lib/workbook/copy';
import MemoryHoldersClient from './MemoryHoldersClient';

export const dynamic = 'force-dynamic';

export default async function MemoryHoldersPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [wb] = await db
    .select({ id: workbooks.id })
    .from(workbooks)
    .where(eq(workbooks.id, id))
    .limit(1);
  if (!wb) notFound();

  const rows = await db
    .select({
      id: workbookMemoryHolders.id,
      role: workbookMemoryHolders.role,
      displayName: workbookMemoryHolders.displayName,
      responsibility: workbookMemoryHolders.responsibility,
      tenureBand: workbookMemoryHolders.tenureBand,
      criticality: workbookMemoryHolders.criticality,
      successorIdentified: workbookMemoryHolders.successorIdentified,
      notes: workbookMemoryHolders.notes,
    })
    .from(workbookMemoryHolders)
    .where(eq(workbookMemoryHolders.workbookId, id))
    .orderBy(workbookMemoryHolders.capturedAt);

  const cartography = runStewardshipCartography(
    rows.map((h) => ({
      id: h.id,
      role: h.role,
      criticality: h.criticality as
        | 'routine'
        | 'important'
        | 'load_bearing'
        | 'institution_critical'
        | null,
      tenureBand: h.tenureBand as '0_3y' | '3_7y' | '7_15y' | '15y_plus' | null,
      successorIdentified: h.successorIdentified,
    })),
  );

  return (
    <MemoryHoldersClient
      workbookId={id}
      locale={isFrench(locale) ? 'fr-CA' : 'en-CA'}
      initialHolders={rows.map((r) => ({
        ...r,
        tenureBand: r.tenureBand as '0_3y' | '3_7y' | '7_15y' | '15y_plus' | null,
        criticality: r.criticality as
          | 'routine'
          | 'important'
          | 'load_bearing'
          | 'institution_critical'
          | null,
      }))}
      initialCartography={cartography}
      hubHref={`/${locale}/workbook/${id}`}
    />
  );
}
