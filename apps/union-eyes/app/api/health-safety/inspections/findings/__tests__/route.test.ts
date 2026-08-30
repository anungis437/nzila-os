import { describe, it, expect } from 'vitest';
import { mapStatus } from '../route';

describe('health-safety/inspections/findings mapStatus', () => {
  it('maps requires_followup to pending_review', () => {
    expect(mapStatus('requires_followup')).toBe('pending_review');
  });

  it('maps followup_complete to approved', () => {
    expect(mapStatus('followup_complete')).toBe('approved');
  });

  it('maps completed and any other status to completed', () => {
    expect(mapStatus('completed')).toBe('completed');
    expect(mapStatus('scheduled')).toBe('completed');
  });
});
