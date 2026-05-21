/**
 * Governance Entropy Workbook \u2014 PDF render entry point.
 *
 * Node.js runtime only. Loads the full workbook context (cartography,
 * holders, every module result the engines can produce today, and
 * cross-module synthesis), runs the deterministic narrative engine,
 * and renders to Buffer for streaming.
 */

import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement, JSXElementConstructor } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbooks } from '@/db/schema/workbook-schema';
import { GovernanceEntropyWorkbookTemplate, type WorkbookPdfData } from './GovernanceEntropyWorkbookTemplate';
import { buildWorkbookNarrative } from './workbookNarrativeEngine';
import { loadWorkbookContext } from './loadWorkbookModules';

export interface GenerateWorkbookPdfInput {
  workbookId: string;
  organizationName?: string | null;
}

export async function generateWorkbookPdf(input: GenerateWorkbookPdfInput): Promise<Buffer | null> {
  const [wb] = await db
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

  const { cartography, holders, modules } = await loadWorkbookContext({
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
  }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>;

  return renderToBuffer(element);
}
