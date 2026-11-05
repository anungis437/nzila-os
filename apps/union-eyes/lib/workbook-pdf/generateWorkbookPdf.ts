/**
 * Governance Entropy Workbook \u2014 PDF render entry point.
 *
 * Node.js runtime only. Loads the full workbook context (cartography,
 * holders, every module result the engines can produce today, and
 * cross-module synthesis), runs the deterministic narrative engine,
 * and renders to Buffer for streaming.
 *
 * AUTHORITY: this entry point and loadWorkbookContext read protected
 * workbook + child rows through the transaction they are given. It MUST be
 * the one the claimed-workbook authority boundary (withClaimedWorkbookAccess in
 * lib/workbook/access-control.ts) opened for the caller (claimant runtime or
 * bounded system), so the reads carry the established DB execution context.
 */

import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement, JSXElementConstructor } from 'react';
import { eq } from 'drizzle-orm';
import { workbooks } from '@/db/schema/workbook-schema';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { GovernanceEntropyWorkbookTemplate, type WorkbookPdfData } from './GovernanceEntropyWorkbookTemplate';
import { buildWorkbookNarrative } from './workbookNarrativeEngine';
import { loadWorkbookContext } from './loadWorkbookModules';

export interface GenerateWorkbookPdfInput {
  workbookId: string;
  organizationName?: string | null;
}

export async function generateWorkbookPdf(tx: RLSTx, input: GenerateWorkbookPdfInput): Promise<Buffer | null> {
  const [wb] = await tx
    .select({
      id: workbooks.id,
      locale: workbooks.locale,
      reportTierId: workbooks.reportTierId,
    })
    .from(workbooks)
    .where(eq(workbooks.id, input.workbookId))
    .limit(1);

  if (!wb) return null;

  // Facilitated tier unlocks the cross-module synthesis profile reading
  // and any future facilitator-captured module inputs.
  const status: 'facilitated' | 'self-guided' =
    wb.reportTierId === 'workbook_facilitated' || wb.reportTierId === 'workbook_enterprise'
      ? 'facilitated'
      : 'self-guided';

  const { cartography, holders, modules } = await loadWorkbookContext(tx, {
    workbookId: input.workbookId,
    status,
  });

  const narrative = buildWorkbookNarrative(cartography);

  const data: WorkbookPdfData = {
    workbookId: input.workbookId,
    locale: wb.locale === 'fr-CA' ? 'fr-CA' : 'en-CA',
    organizationName: input.organizationName ?? null,
    generatedAt: new Date(),
    cartography,
    narrative,
    holders,
    modules,
  };

  const element = React.createElement(GovernanceEntropyWorkbookTemplate, {
    data,
  }) as ReactElement<DocumentProps, string | JSXElementConstructor<any>>;

  return renderToBuffer(element);
}
