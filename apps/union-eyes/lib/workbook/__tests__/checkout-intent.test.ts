import { describe, expect, it } from 'vitest';
import {
  hashWorkbookCheckoutReference,
  issueWorkbookCheckoutReference,
  workbookCheckoutReferenceIsPlausible,
} from '../checkout-intent';

describe('workbook checkout intent', () => {
  it('issues opaque high-entropy references and stores only their digest', () => {
    const a = issueWorkbookCheckoutReference();
    const b = issueWorkbookCheckoutReference();
    expect(a.publicRef).not.toBe(b.publicRef);
    expect(a.publicRefHash).toBe(hashWorkbookCheckoutReference(a.publicRef));
    expect(a.publicRefHash).not.toContain(a.publicRef);
    expect(workbookCheckoutReferenceIsPlausible(a.publicRef)).toBe(true);
  });

  it('rejects ids and malformed references', () => {
    expect(workbookCheckoutReferenceIsPlausible('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(workbookCheckoutReferenceIsPlausible('short')).toBe(false);
  });
});
