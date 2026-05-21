/**
 * Governance Entropy Workbook \u2014 PDF render entry point.
 *
 * Node.js runtime only. Loads workbook + holders + cartography, runs the
 * deterministic narrative engine, and renders to Buffer for streaming.
 */

import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement, JSXElementConstructor } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbookMemoryHolders, workbooks } from '@/db/schema/workbook-schema';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';
import { GovernanceEntropyWorkbookTemplate, type WorkbookPdfData } from './GovernanceEntropyWorkbookTemplate';
import { buildWorkbookNarrative } from './workbookNarrativeEngine';

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

  const holderRows = await db
    .select({
      role: workbookMemoryHolders.role,
      displayName: workbookMemoryHolders.displayName,
      responsibility: workbookMemoryHolders.responsibility,
      tenureBand: workbookMemoryHolders.tenureBand,
      criticality: workbookMemoryHolders.criticality,
      successorIdentified: workbookMemoryHolders.successorIdentified,
    })
    .from(workbookMemoryHolders)
    .where(eq(workbookMemoryHolders.workbookId, input.workbookId))
    .orderBy(workbookMemoryHolders.capturedAt);

  const cartography = runStewardshipCartography(
    holderRows.map((h, idx) => ({
      id: String(idx),
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

  const narrative = buildWorkbookNarrative(cartography);

  const data: WorkbookPdfData = {
    workbookId: input.workbookId,
    locale: wb.locale === 'fr-CA' ? 'fr-CA' : 'en-CA',
    organizationName: input.organizationName ?? null,
    generatedAt: new Date(),
    cartography,
    narrative,
    holders: holderRows,
  };

  const element = React.createElement(GovernanceEntropyWorkbookTemplate, {
    data,
  }) as ReactElement<DocumentProps, string | JSXElementConstructor<unknown>>;

  return renderToBuffer(element);
}
