import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import { decisionTypeEnum, outcomeEnum, precedentValueEnum, tribunalTypeEnum } from '@/db/schema';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import {
  CITATION_TYPES,
  DECISION_TYPES,
  JURISDICTION_CODES,
  LANGUAGES,
  NO_FILTERS,
  OUTCOMES,
  OUTCOME_COLORS,
  PRECEDENT_VALUES,
  PRECEDENT_VALUE_COLORS,
  TRIBUNALS,
  activeFilterCount,
  citationTypeLabel,
  decisionTypeLabel,
  issueTypeLabel,
  jurisdictionLabel,
  languageLabel,
  listParams,
  outcomeColor,
  outcomeLabel,
  precedentValueColor,
  precedentValueLabel,
  tribunalLabel,
} from '../precedent-filters';

const LOCALES = ['en-CA', 'fr-CA'] as const;
const translator = (locale: (typeof LOCALES)[number]) =>
  createTranslator({ locale, messages: locale === 'en-CA' ? enCA : frCA, namespace: 'precedents' });

describe('the vocabulary the filters offer', () => {
  it('is the database’s own enumeration members, so the route accepts every value that is offered', () => {
    expect([...OUTCOMES].sort()).toEqual([...outcomeEnum.enumValues].sort());
    expect([...PRECEDENT_VALUES].sort()).toEqual([...precedentValueEnum.enumValues].sort());
    expect([...TRIBUNALS].sort()).toEqual([...tribunalTypeEnum.enumValues].sort());
    expect([...DECISION_TYPES].sort()).toEqual([...decisionTypeEnum.enumValues].sort());
  });

  it('has nothing left of the older precedent model’s vocabulary, which the database never stores', () => {
    for (const stale of ['upheld', 'partially_upheld']) expect(OUTCOMES).not.toContain(stale);
    for (const stale of ['binding', 'persuasive', 'informative']) expect(PRECEDENT_VALUES).not.toContain(stale);
  });

  it.each(LOCALES)('is labelled from the message catalog for every member, in %s', (locale) => {
    const t = translator(locale);
    const labelled: Array<[string, string]> = [
      ...OUTCOMES.map((value): [string, string] => [value, outcomeLabel(value, t)]),
      ...PRECEDENT_VALUES.map((value): [string, string] => [value, precedentValueLabel(value, t)]),
      ...TRIBUNALS.map((value): [string, string] => [value, tribunalLabel(value, t)]),
      ...DECISION_TYPES.map((value): [string, string] => [value, decisionTypeLabel(value, t)]),
      ...LANGUAGES.map((value): [string, string] => [value, languageLabel(value, t)]),
      ...CITATION_TYPES.map((value): [string, string] => [value, citationTypeLabel(value, t)]),
      ...JURISDICTION_CODES.map((value): [string, string] => [value, jurisdictionLabel(value, t)]),
    ];

    for (const [stored, label] of labelled) {
      expect(label, stored).not.toBe('');
      // A member the catalog lacks would come back as the key path (or as the stored token), not as words.
      expect(label, stored).not.toMatch(/^precedents\./);
      expect(label, stored).not.toMatch(/_/);
    }
  });

  it('writes the members in each language', () => {
    expect(outcomeLabel('grievance_upheld', translator('en-CA'))).toBe('Grievance upheld');
    expect(outcomeLabel('grievance_upheld', translator('fr-CA'))).toBe('Grief accueilli');
    expect(precedentValueLabel('high', translator('fr-CA'))).toBe('Élevée');
    expect(tribunalLabel('private_arbitrator', translator('fr-CA'))).toBe('Arbitre privé');
    expect(decisionTypeLabel('unfair_practice', translator('en-CA'))).toBe('Unfair practice');
    expect(languageLabel('fr', translator('fr-CA'))).toBe('Français');
    expect(citationTypeLabel('case_law', translator('fr-CA'))).toBe('Jurisprudence');
    expect(jurisdictionLabel('federal', translator('en-CA'))).toBe('Federal');
    expect(jurisdictionLabel('federal', translator('fr-CA'))).toBe('Fédéral');
    expect(jurisdictionLabel('QC', translator('fr-CA'))).toBe('Québec');
  });

  it('colors every outcome and precedent value', () => {
    for (const outcome of OUTCOMES) expect(OUTCOME_COLORS[outcome]).toMatch(/^bg-/);
    for (const value of PRECEDENT_VALUES) expect(PRECEDENT_VALUE_COLORS[value]).toMatch(/^bg-/);
    expect(outcomeColor('settled')).toContain('blue');
    expect(precedentValueColor('low')).toContain('gray');
  });

  it('shows a value it has no label for as stored, with no color, instead of hiding or guessing it', () => {
    const t = translator('fr-CA');

    expect(outcomeLabel('a_new_outcome', t)).toBe('a_new_outcome');
    expect(outcomeColor('a_new_outcome')).toBe('');
    expect(precedentValueLabel('a_new_value', t)).toBe('a_new_value');
    expect(precedentValueColor('a_new_value')).toBe('');
    expect(tribunalLabel('a_new_tribunal', t)).toBe('a_new_tribunal');
    expect(decisionTypeLabel('a_new_type', t)).toBe('a_new_type');
    expect(languageLabel('de', t)).toBe('de');
    expect(citationTypeLabel('treaty', t)).toBe('treaty');
    expect(jurisdictionLabel('XX', t)).toBe('XX');
  });

  it('does not take a property of every object for a member', () => {
    const t = translator('en-CA');

    for (const inherited of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(outcomeLabel(inherited, t)).toBe(inherited);
      expect(outcomeColor(inherited)).toBe('');
      expect(precedentValueColor(inherited)).toBe('');
      expect(tribunalLabel(inherited, t)).toBe(inherited);
    }
  });

  it('offers each jurisdiction once', () => {
    expect(new Set(JURISDICTION_CODES).size).toBe(JURISDICTION_CODES.length);
    expect(JURISDICTION_CODES).toHaveLength(14);
  });
});

describe('issueTypeLabel', () => {
  it('writes a stored token as words and leaves free text as it is', () => {
    expect(issueTypeLabel('just_cause')).toBe('Just Cause');
    expect(issueTypeLabel('termination')).toBe('Termination');
    expect(issueTypeLabel('Wrongful dismissal')).toBe('Wrongful dismissal');
    expect(issueTypeLabel('congédiement')).toBe('Congédiement');
    expect(issueTypeLabel('_')).toBe('');
  });
});

describe('listParams', () => {
  it('asks for a page and nothing else when no filter is set', () => {
    expect(listParams(NO_FILTERS, 1, 20).toString()).toBe('page=1&limit=20');
  });

  it('sends each list filter as the comma-separated members the route reads', () => {
    const params = listParams({ ...NO_FILTERS, outcomes: ['grievance_upheld', 'dismissed'], precedentValues: ['high', 'medium'] }, 1, 20);

    expect(params.get('outcome')).toBe('grievance_upheld,dismissed');
    expect(params.get('precedentValue')).toBe('high,medium');
  });

  it('trims a text filter, and leaves out one that is only spaces', () => {
    const params = listParams({ ...NO_FILTERS, query: '  just cause ', sector: '   ', arbitrator: ' Jane ' }, 3, 20);

    expect(params.get('searchQuery')).toBe('just cause');
    expect(params.has('sector')).toBe(false);
    expect(params.get('arbitrator')).toBe('Jane');
    expect(params.get('page')).toBe('3');
  });

  it('includes the whole of the end day, and sends the start day as it is', () => {
    const params = listParams({ ...NO_FILTERS, fromDate: '2021-03-04', toDate: '2021-03-04' }, 1, 20);

    expect(params.get('dateFrom')).toBe('2021-03-04');
    expect(params.get('dateTo')).toBe('2021-03-04T23:59:59.999Z');
  });

  it('never sends a filter under a name the route does not read', () => {
    const everything = listParams(
      { query: 'q', outcomes: ['settled'], precedentValues: ['low'], jurisdiction: 'ON', sector: 's', arbitrator: 'a', fromDate: '2020-01-01', toDate: '2020-02-01' },
      1,
      20,
    );

    expect([...everything.keys()].sort()).toEqual(
      ['arbitrator', 'dateFrom', 'dateTo', 'jurisdiction', 'limit', 'outcome', 'page', 'precedentValue', 'searchQuery', 'sector'].sort(),
    );
  });
});

describe('activeFilterCount', () => {
  it('counts every selected member and every text or date filter that is set', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        query: 'q',
        outcomes: ['settled', 'dismissed'],
        precedentValues: ['low'],
        jurisdiction: 'ON',
        sector: '',
        arbitrator: '  ',
        fromDate: '2020-01-01',
        toDate: '',
      }),
    ).toBe(6);
  });
});
