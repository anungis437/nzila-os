import { describe, expect, it } from 'vitest';
import { voiceIntentKeyHash, voiceReservationCreditsForBytes } from '../usage-reservation';

describe('voice usage reservation policy', () => {
  it('uses a conservative byte-based reservation and hashes intent keys', () => {
    expect(voiceReservationCreditsForBytes(1)).toBe(1);
    expect(voiceReservationCreditsForBytes(60_001)).toBe(2);
    expect(voiceIntentKeyHash('request-1234567890')).toMatch(/^[a-f0-9]{64}$/);
  });
});
