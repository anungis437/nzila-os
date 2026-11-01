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
import { withClaimedWorkbookAccess } from '@/lib/workbook/access-control';
import { auditWorkbookRead } from '@/lib/workbook/claimed-write-audit';
import { readWorkbookCapabilityCookie } from '@/lib/workbook/workbook-capability';
import { isFrench } from '@/lib/workbook/copy';
import MemoryHoldersClient from './MemoryHoldersClient';

export const dynamic = 'force-dynamic';

export default async function MemoryHoldersPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // ROUND 50 SECURITY FIX: this server component previously queried
  // workbookMemoryHolders (including free-text `notes`) directly, bypassing
  // the ownership check already required once a workbook is claimed — see
  // lib/workbook/access-control.ts. Renders a generic not-found rather than
  // a distinguishable "forbidden" response, matching this page's existing
  // anti-surveillance posture (never reveal existence via response shape).
  // The unclaimed workbook's bearer capability (cookie) or the claimant / same-organization authority is resolved first, then the read runs
  // inside the execution context that matches it, and is recorded before the people it names are served. A refusal is a generic not-found,
  // matching this page's anti-surveillance posture (never reveal existence via response shape).
  const capability = await readWorkbookCapabilityCookie(id);
  const loaded = await withClaimedWorkbookAccess({ workbookId: id, operation: 'read', capability }, async (authority) => {
    const [wb] = await db
      .select({ id: workbooks.id })
      .from(workbooks)
      .where(eq(workbooks.id, id))
      .limit(1);
    if (!wb) return null;

    await auditWorkbookRead(authority, {
      action: 'workbook.memory_holder.read',
      resourceType: 'workbook_memory_holders',
      resourceId: id,
      details: { authority: authority.kind, surface: 'page' },
    });

    return db
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
  });
  if (!loaded.ok || !loaded.value) notFound();
  const rows = loaded.value;

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
