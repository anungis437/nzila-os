#!/usr/bin/env tsx
/**
 * check-workbook-pilot-readiness.ts
 *
 * Pilot readiness checklist for a Governance Entropy Workbook.
 *
 * Reports, per chapter, whether the underlying engine has the
 * authoritative inputs it needs to render live content or whether
 * the chapter will fall back to the Reserved for Facilitated Edition
 * note. Informational only \u2014 exits 0 in all cases.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes workbook:pilot-readiness <workbookId>
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  workbooks,
  workbookGovernanceLineageEntries,
  workbookMemoryHolders,
  workbookContinuityBreakpoints,
  workbookModernizationAlignment,
  workbookTransformationRoadmap,
} from '@/db/schema/workbook-schema';

type Readiness = 'ready' | 'partial' | 'reserved';

interface ChapterReadiness {
  readonly chapter: string;
  readonly title: string;
  readonly readiness: Readiness;
  readonly note: string;
}

async function main(): Promise<void> {
  const workbookId = process.argv[2];
  if (!workbookId) {
    console.error('Usage: workbook:pilot-readiness <workbookId>');
    process.exitCode = 0;
    return;
  }

  const [wb] = await db
    .select({ id: workbooks.id, reportTierId: workbooks.reportTierId, locale: workbooks.locale })
    .from(workbooks)
    .where(eq(workbooks.id, workbookId))
    .limit(1);

  if (!wb) {
    console.log(`Workbook ${workbookId} not found.`);
    process.exitCode = 0;
    return;
  }

  const status: 'facilitated' | 'self-guided' =
    wb.reportTierId === 'workbook_facilitated' || wb.reportTierId === 'workbook_enterprise'
      ? 'facilitated'
      : 'self-guided';

  const [holderCount, lineageCount, breakpointCount, modernizationCount, roadmapCount] =
    await Promise.all([
      countRows(workbookMemoryHolders, workbookId),
      countRows(workbookGovernanceLineageEntries, workbookId),
      countRows(workbookContinuityBreakpoints, workbookId),
      countRows(workbookModernizationAlignment, workbookId),
      countRows(workbookTransformationRoadmap, workbookId),
    ]);

  const chapters: ChapterReadiness[] = [
    {
      chapter: '01',
      title: 'Continuity landscape',
      readiness: holderCount === 0 ? 'reserved' : holderCount < 3 ? 'partial' : 'ready',
      note:
        holderCount === 0
          ? 'No memory holders recorded. Chapter will render as Reserved.'
          : holderCount < 3
            ? `${holderCount} memory holder(s) recorded. Cartography will render but density bands may be inconclusive.`
            : `${holderCount} memory holders recorded. Cartography will render with full bands.`,
    },
    {
      chapter: '02',
      title: 'Memory holders',
      readiness: holderCount === 0 ? 'reserved' : 'ready',
      note:
        holderCount === 0
          ? 'No memory holders recorded.'
          : `${holderCount} memory holder row(s) projected to the holders chapter.`,
    },
    {
      chapter: '03',
      title: 'Governance lineage',
      readiness: lineageCount === 0 ? 'reserved' : 'ready',
      note:
        lineageCount === 0
          ? 'No governance precedents recorded. Lineage chapter will render as Reserved.'
          : `${lineageCount} precedent(s) recorded. Lineage survivability reading will render.`,
    },
    {
      chapter: '04',
      title: 'Continuity breakpoints',
      readiness: 'reserved',
      note:
        breakpointCount === 0
          ? 'No breakpoint definitions recorded, and the schema does not yet carry the dependency / successor / reconstruction inputs the v2.0.0 engine requires. Reserved for the Facilitated Edition.'
          : `${breakpointCount} breakpoint row(s) present, but the v2.0.0 engine still requires structured dependency, successor, and reconstruction inputs that the current schema does not capture. Reserved for the Facilitated Edition.`,
    },
    {
      chapter: '05',
      title: 'Modernization alignment',
      readiness: 'reserved',
      note:
        modernizationCount === 0
          ? 'No modernization rows recorded, and the engine requires initiative-level survey inputs not yet in schema. Reserved for the Facilitated Edition.'
          : `${modernizationCount} modernization row(s) present, but the engine requires initiative-level inputs (velocity, integrity, governance review, traceability) not yet projectable from the current schema. Reserved.`,
    },
    {
      chapter: '06',
      title: 'Transformation roadmap',
      readiness: 'reserved',
      note:
        roadmapCount === 0
          ? 'No roadmap entries recorded, and the engine requires stabilization, redistribution, and maturity inputs not yet in schema. Reserved for the Facilitated Edition.'
          : `${roadmapCount} roadmap row(s) present, but the engine requires stabilization / redistribution / maturity inputs not yet captured in the current schema. Reserved.`,
    },
    {
      chapter: '07',
      title: 'Cross-module synthesis',
      readiness:
        status === 'self-guided'
          ? 'reserved'
          : holderCount > 0 && lineageCount > 0
            ? 'ready'
            : 'reserved',
      note:
        status === 'self-guided'
          ? 'Self-guided tier. Cross-module synthesis is reserved for facilitated and enterprise tiers.'
          : holderCount > 0 && lineageCount > 0
            ? 'Facilitated tier with landscape + lineage inputs present. Synthesis profile will render.'
            : 'Facilitated tier, but fewer than two modules produced results. Synthesis requires at least landscape + lineage. Reserved.',
    },
  ];

  printSummary({ workbookId, status, locale: wb.locale, chapters });
  process.exitCode = 0;
}

async function countRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  workbookId: string,
): Promise<number> {
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.workbookId, workbookId));
  return rows.length;
}

function printSummary(args: {
  workbookId: string;
  status: 'facilitated' | 'self-guided';
  locale: string;
  chapters: readonly ChapterReadiness[];
}): void {
  const { workbookId, status, locale, chapters } = args;

  const readyCount = chapters.filter((c) => c.readiness === 'ready').length;
  const partialCount = chapters.filter((c) => c.readiness === 'partial').length;
  const reservedCount = chapters.filter((c) => c.readiness === 'reserved').length;

  const lines: string[] = [];
  lines.push('Governance Entropy Workbook \u2014 Pilot Readiness');
  lines.push('');
  lines.push(`Workbook:  ${workbookId}`);
  lines.push(`Tier:      ${status}`);
  lines.push(`Locale:    ${locale}`);
  lines.push('');
  lines.push(`Summary:   ${readyCount} ready | ${partialCount} partial | ${reservedCount} reserved`);
  lines.push('');
  for (const c of chapters) {
    const tag =
      c.readiness === 'ready' ? '[READY]   ' : c.readiness === 'partial' ? '[PARTIAL] ' : '[RESERVED]';
    lines.push(`${tag} ${c.chapter}  ${c.title}`);
    lines.push(`           ${c.note}`);
  }
  lines.push('');
  lines.push(
    'This checklist is informational. Reserved chapters render gracefully as the Reserved for Facilitated Edition note rather than fabricating content.',
  );

  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 0;
});
