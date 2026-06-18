import { describe, expect, it } from 'vitest';

import { prioritize, type PrioritizedQuestion } from '../questionPriorityModel';

function q(id: string, section: string, order: number): PrioritizedQuestion['question'] {
  return { id, section, order };
}

describe('lib/icra/adaptation/questionPriorityModel', () => {
  it('orders by band rank first', () => {
    const items: PrioritizedQuestion[] = [
      { question: q('c', 'z', 1), band: 'contextual' },
      { question: q('a', 'a', 1), band: 'core' },
      { question: q('r', 'm', 1), band: 'recommended' },
      { question: q('q', 'b', 1), band: 'required' },
    ];
    expect(prioritize(items).map((i) => i.question.id)).toEqual(['a', 'q', 'r', 'c']);
  });

  it('breaks band ties on section alphabetically', () => {
    const items: PrioritizedQuestion[] = [
      { question: q('b', 'beta', 1), band: 'core' },
      { question: q('a', 'alpha', 1), band: 'core' },
    ];
    expect(prioritize(items).map((i) => i.question.id)).toEqual(['a', 'b']);
  });

  it('breaks section ties on order', () => {
    const items: PrioritizedQuestion[] = [
      { question: q('second', 'alpha', 2), band: 'core' },
      { question: q('first', 'alpha', 1), band: 'core' },
    ];
    expect(prioritize(items).map((i) => i.question.id)).toEqual(['first', 'second']);
  });

  it('does not mutate the input array', () => {
    const items: PrioritizedQuestion[] = [
      { question: q('b', 'b', 1), band: 'required' },
      { question: q('a', 'a', 1), band: 'core' },
    ];
    const snapshot = items.map((i) => i.question.id);
    prioritize(items);
    expect(items.map((i) => i.question.id)).toEqual(snapshot);
  });
});
