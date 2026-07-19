import { describe, it, expect } from 'vitest';
import { SOLUTIONS_ORDER, getCarouselNav } from '../solutions-carousel';

describe('lib/solutions-carousel', () => {
  it('exposes an ordered list of solutions', () => {
    expect(SOLUTIONS_ORDER).toHaveLength(6);
    expect(SOLUTIONS_ORDER[0].name).toBe('executive-leadership');
  });

  it('returns an empty nav for an unknown solution', () => {
    expect(getCarouselNav('does-not-exist', 'en-CA')).toEqual({});
  });

  it('omits previous for the first item', () => {
    const nav = getCarouselNav('executive-leadership', 'en-CA');
    expect(nav.previous).toBeUndefined();
    expect(nav.next).toEqual({
      name: 'governance-leadership',
      label: 'Governance Leadership',
      href: '/en-CA/solutions/governance-leadership',
    });
  });

  it('omits next for the last item', () => {
    const nav = getCarouselNav('procurement', 'fr-CA');
    expect(nav.next).toBeUndefined();
    expect(nav.previous).toEqual({
      name: 'labour-leadership',
      label: 'Policy & Labour Leadership',
      href: '/fr-CA/solutions/labour-leadership',
    });
  });

  it('provides both previous and next for a middle item', () => {
    const nav = getCarouselNav('operations-leadership', 'en-CA');
    expect(nav.previous?.name).toBe('governance-leadership');
    expect(nav.next?.name).toBe('technology-leadership');
  });
});
