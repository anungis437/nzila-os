// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { PrecedentViewer } from '../PrecedentViewer';
import { toPrecedentRecord, type PrecedentRecord } from '../precedent-record';

// The record is read the way the console reads a route's answer, from a row shaped like the real route's.
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'd-1',
  caseNumber: 'ABC-2021-001',
  caseTitle: 'Union v. Employer',
  tribunal: 'private_arbitrator',
  decisionType: 'grievance',
  decisionDate: '2021-03-04T12:00:00.000Z',
  filingDate: '2020-11-02T12:00:00.000Z',
  arbitrator: 'Jane Arbitrator',
  union: 'Local 100',
  employer: 'Acme Ltd.',
  outcome: 'grievance_upheld',
  precedentValue: 'high',
  issueTypes: ['discharge', 'just_cause'],
  summary: 'The grievance was upheld.',
  jurisdiction: 'ON',
  language: 'en',
  createdAt: '2021-03-05T15:30:00.000Z',
  updatedAt: '2021-03-05T15:30:00.000Z',
  ...overrides,
});
const record = (overrides: Record<string, unknown> = {}): PrecedentRecord => toPrecedentRecord(row(overrides));

function renderViewer(precedent: PrecedentRecord, locale: 'en-CA' | 'fr-CA' = 'en-CA', timeZone = 'UTC', onCompare?: () => void) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA} timeZone={timeZone}>
      <PrecedentViewer precedent={precedent} onCompare={onCompare} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('PrecedentViewer: what it shows', () => {
  it('shows the decision under its case number and title, with its parties', () => {
    renderViewer(record());

    expect(screen.getByRole('heading', { name: 'ABC-2021-001 - Union v. Employer' })).toBeInTheDocument();
    expect(screen.getByText('Parties')).toBeInTheDocument();
    expect(screen.getByText('Local 100')).toBeInTheDocument();
    expect(screen.getByText('Acme Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Jane Arbitrator')).toBeInTheDocument();
    expect(screen.getByText('The grievance was upheld.')).toBeInTheDocument();
  });

  it('shows the issue types as words', () => {
    renderViewer(record());

    expect(screen.getByText('Discharge')).toBeInTheDocument();
    expect(screen.getByText('Just Cause')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/just_cause/);
  });

  it('shows no section for what the decision lacks, and no placeholder in its place', () => {
    renderViewer(toPrecedentRecord({ id: 'd-9', caseTitle: 'Only a title' }));

    expect(screen.getByRole('heading', { name: 'Only a title' })).toBeInTheDocument();
    for (const absent of ['Case Information', 'Parties', 'Summary', 'Reasoning', 'Key Findings', 'Legal Citations', 'Engagement']) {
      expect(screen.queryByText(absent), absent).toBeNull();
    }
    expect(document.body.textContent).not.toMatch(/unknown|undefined|NaN|Invalid/i);
  });

  it('shows no heading separator when the decision has a title and no case number', () => {
    renderViewer(record({ caseNumber: undefined }));

    expect(screen.getByRole('heading', { name: 'Union v. Employer' })).toBeInTheDocument();
  });

  it('never shows the grievor, the remedy or the full text, whatever record it is given: the public projection withholds them and the viewer never reads them', () => {
    const withGrievor = { ...record(), grievor: 'A. Worker', remedy: { monetaryAward: 5000 }, fullText: 'The full text of the award.' };
    renderViewer(withGrievor);

    expect(screen.queryByText('A. Worker')).toBeNull();
    expect(screen.queryByText(/Grievor/)).toBeNull();
    expect(screen.queryByText(/5000|The full text/)).toBeNull();
  });

  it('shows the reasoning, the key facts, the key findings and the legal citations of a decision read from the item route', () => {
    renderViewer(
      record({
        reasoning: 'The employer did not meet its onus.',
        keyFacts: 'The grievor was dismissed in May.',
        keyFindings: ['Discharge without cause was not made out', 'Reinstatement with back pay'],
        legalCitations: [{ citation: 'Canada Labour Code, s. 240', type: 'statute', relevance: 'Unjust dismissal' }],
      }),
    );

    expect(screen.getByText('The employer did not meet its onus.')).toBeInTheDocument();
    expect(screen.getByText('The grievor was dismissed in May.')).toBeInTheDocument();
    expect(screen.getByText(/Discharge without cause was not made out\s+Reinstatement with back pay/)).toBeInTheDocument();
    expect(screen.getByText('Canada Labour Code, s. 240')).toBeInTheDocument();
    expect(screen.getByText('Statute')).toBeInTheDocument();
    expect(screen.getByText('Unjust dismissal')).toBeInTheDocument();
  });
});

describe('PrecedentViewer: engagement', () => {
  it('shows no engagement figures for a record that carries no counts, instead of zeros', () => {
    renderViewer(record({ viewCount: 0, citationCount: 0 }));

    expect(screen.queryByText('Engagement')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b0 (views|citations)\b/);
  });

  it('shows each count the record carries, labelled, and not the one it lacks', () => {
    renderViewer(record({ viewCount: 7 }));
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('7 views')).toBeInTheDocument();
    expect(screen.queryByText(/citation/)).toBeNull();

    cleanup();
    renderViewer(record({ viewCount: 1, citationCount: 2 }));
    expect(screen.getByText('1 view')).toBeInTheDocument();
    expect(screen.getByText('2 citations')).toBeInTheDocument();
  });
});

describe('PrecedentViewer: actions', () => {
  it('offers no action it cannot complete, and compare only when its caller supplied one', () => {
    renderViewer(record());
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    cleanup();
    renderViewer(record(), 'en-CA', 'UTC', () => undefined);
    expect(screen.getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Compare']);
  });
});

describe('PrecedentViewer: the database’s own members', () => {
  it('labels and colors the outcome and the precedent value, and labels the tribunal and the decision type', () => {
    renderViewer(record());

    expect(screen.getByText('Grievance upheld').className).toContain('bg-green-100');
    expect(screen.getByText('Precedent Value')).toBeInTheDocument();
    expect(screen.getByText('High').className).toContain('bg-purple-100');
    expect(screen.getByText('Private arbitrator')).toBeInTheDocument();
    expect(screen.getByText('Grievance')).toBeInTheDocument();
    expect(screen.getByText('Ontario')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/grievance_upheld|private_arbitrator|NaN|undefined/);
  });

  it('shows an outcome or value it has no label for as stored, with no color, and nothing at all when there is none', () => {
    renderViewer(record({ outcome: 'a_new_outcome', precedentValue: undefined, tribunal: 'a_new_tribunal' }));

    expect(screen.getByText('a_new_outcome').className).not.toMatch(/bg-(green|red|yellow|blue|gray)-100/);
    expect(screen.getByText('a_new_tribunal')).toBeInTheDocument();
    expect(screen.queryByText('Precedent Value')).toBeNull();
  });
});

describe('PrecedentViewer: dates', () => {
  it('writes the days a decision names, and when the record was made and changed, in the viewer’s language', () => {
    renderViewer(record({ updatedAt: '2021-03-06T18:45:00.000Z' }));

    expect(screen.getByText('March 4, 2021')).toBeInTheDocument();
    expect(screen.getByText('November 2, 2020')).toBeInTheDocument();
    // en-CA writes the time of day as "3:30 p.m."; the exact spacing and punctuation belong to the platform's locale data.
    expect(screen.getByText(/^Created Mar 5, 2021,? 3:30\s?p\.?m\.? · Updated Mar 6, 2021,? 6:45\s?p\.?m\.?$/i)).toBeInTheDocument();
  });

  it('says only when it was created when it was never changed', () => {
    renderViewer(record());

    expect(screen.getByText(/^Created Mar 5, 2021,? 3:30\s?p\.?m\.?$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it('keeps the day a decision names whatever time zone the viewer is in', () => {
    renderViewer(record({ decisionDate: '2021-03-01T00:00:00.000Z' }), 'en-CA', 'America/Toronto');

    expect(screen.getByText('March 1, 2021')).toBeInTheDocument();
    expect(screen.queryByText(/February 28/)).toBeNull();
  });

  it('shows a date it cannot read as stored, never as an invalid date', () => {
    renderViewer(record({ decisionDate: 'sometime in March' }));

    expect(screen.getByText('sometime in March')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Invalid/i);
  });
});

describe('PrecedentViewer: French', () => {
  it('has every label, member and date in French', () => {
    renderViewer(record({ viewCount: 1200, updatedAt: '2021-03-06T18:45:00.000Z' }), 'fr-CA');

    expect(screen.getByText('Renseignements sur le dossier')).toBeInTheDocument();
    expect(screen.getByText('Date de la décision')).toBeInTheDocument();
    expect(screen.getByText('4 mars 2021')).toBeInTheDocument();
    expect(screen.getByText('Grief accueilli')).toBeInTheDocument();
    expect(screen.getByText('Élevée')).toBeInTheDocument();
    expect(screen.getByText('Arbitre privé')).toBeInTheDocument();
    expect(screen.getByText('Anglais')).toBeInTheDocument();
    expect(screen.getByText('Syndicat')).toBeInTheDocument();
    expect(screen.getByText('Employeur')).toBeInTheDocument();
    expect(screen.getByText(/^1\s200 consultations$/)).toBeInTheDocument();
    expect(screen.getByText(/^Créé le .+ · Modifié le /)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Case Information|Decision Date|Created|\bviews\b/);
  });

  it('labels the compare action in French', () => {
    renderViewer(record(), 'fr-CA', 'UTC', vi.fn());

    expect(screen.getByRole('button', { name: 'Comparer' })).toBeInTheDocument();
  });
});
