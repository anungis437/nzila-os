import { describe, expect, it } from 'vitest';
import { buildWorkbookNarrative } from '@/lib/workbook-pdf/workbookNarrativeEngine';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';

describe('workbookNarrativeEngine', () => {
  it('handles the empty workbook gracefully', () => {
    const n = buildWorkbookNarrative(runStewardshipCartography([]));
    expect(n.density).toMatch(/no memory holders/i);
    expect(n.posture).toBeTruthy();
    expect(n.concentration).toBeTruthy();
  });

  it('is deterministic for identical input', () => {
    const cartography = runStewardshipCartography([
      {
        id: 'h1',
        role: 'r',
        criticality: 'load_bearing',
        tenureBand: '7_15y',
        successorIdentified: false,
      },
    ]);
    expect(buildWorkbookNarrative(cartography)).toEqual(buildWorkbookNarrative(cartography));
  });

  it('mentions successor exposure when load-bearing carriers lack succession', () => {
    const cartography = runStewardshipCartography([
      {
        id: 'h1',
        role: 'r',
        criticality: 'load_bearing',
        tenureBand: '7_15y',
        successorIdentified: false,
      },
      {
        id: 'h2',
        role: 'r2',
        criticality: 'load_bearing',
        tenureBand: '7_15y',
        successorIdentified: false,
      },
    ]);
    const n = buildWorkbookNarrative(cartography);
    expect(n.concentration).toMatch(/without successor/i);
  });
});
