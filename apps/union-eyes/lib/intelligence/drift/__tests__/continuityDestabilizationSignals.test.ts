import { describe, expect, it } from 'vitest';

import {
  CONTINUITY_DESTABILIZATION_SIGNAL_KINDS,
  isKnownDestabilizationSignal,
} from '../continuityDestabilizationSignals';

describe('lib/intelligence/drift/continuityDestabilizationSignals', () => {
  it('recognizes every known signal kind', () => {
    for (const kind of CONTINUITY_DESTABILIZATION_SIGNAL_KINDS) {
      expect(isKnownDestabilizationSignal(kind)).toBe(true);
    }
  });

  it('rejects unknown signal kinds', () => {
    expect(isKnownDestabilizationSignal('not_a_signal')).toBe(false);
    expect(isKnownDestabilizationSignal('')).toBe(false);
  });
});
