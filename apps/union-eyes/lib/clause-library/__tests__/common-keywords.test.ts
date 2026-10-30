import { describe, expect, it } from 'vitest';
import { commonKeywords } from '../common-keywords';

// DEF-0B4-CLAUSE-LIBRARY-COMPARE-GET-STUB-AND-EMPTY-KEYWORDS: the comparison returned an empty keyword list whatever the clauses said.
describe('commonKeywords', () => {
  it('returns the words present in every clause, most frequent first', () => {
    const words = commonKeywords([
      'The employer shall provide grievance procedure and grievance meetings within ten days.',
      'A grievance procedure applies; the employer provides meetings.',
      'Employer meetings and the grievance procedure are governed here.',
    ]);
    expect(words).toEqual(['grievance', 'employer', 'meetings', 'procedure']);
  });

  it('leaves out words that only some clauses contain, short words and stop words', () => {
    const words = commonKeywords(['seniority applies with the shift', 'seniority is not the shift rule']);
    expect(words).toEqual(['seniority', 'shift']);
    expect(words).not.toContain('with');
  });

  it('works on accented French text', () => {
    expect(commonKeywords(['La procédure de grief est écrite.', 'Toute procédure de grief doit être écrite.'])).toEqual(['écrite', 'grief', 'procédure']);
  });

  it('is empty by definition with fewer than two clauses, and for clauses with nothing in common', () => {
    expect(commonKeywords(['only one clause here'])).toEqual([]);
    expect(commonKeywords([])).toEqual([]);
    expect(commonKeywords(['alpha bravo charlie', 'delta echo foxtrot'])).toEqual([]);
    expect(commonKeywords([null, 'text here'])).toEqual([]);
  });

  it('honours the limit', () => {
    const text = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
    expect(commonKeywords([text, text], 3)).toHaveLength(3);
  });
});
