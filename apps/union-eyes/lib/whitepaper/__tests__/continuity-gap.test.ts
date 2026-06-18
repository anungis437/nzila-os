import { describe, expect, it } from 'vitest';

import {
  CONTINUITY_GAP_BLOCKS,
  CONTINUITY_GAP_BLOCKS_BY_LOCALE,
  getWhitepaperBlocks,
} from '../continuity-gap';
import { CONTINUITY_GAP_BLOCKS_FR } from '../continuity-gap-fr';

describe('lib/whitepaper/continuity-gap', () => {
  it('returns the French blocks for fr-CA', () => {
    expect(getWhitepaperBlocks('fr-CA')).toBe(CONTINUITY_GAP_BLOCKS_FR);
    expect(getWhitepaperBlocks('fr-CA')).toBe(CONTINUITY_GAP_BLOCKS_BY_LOCALE['fr-CA']);
  });

  it('returns the English blocks for en-CA', () => {
    expect(getWhitepaperBlocks('en-CA')).toBe(CONTINUITY_GAP_BLOCKS);
  });

  it('falls back to English for unknown locales', () => {
    expect(getWhitepaperBlocks('es-MX')).toBe(CONTINUITY_GAP_BLOCKS);
  });
});
