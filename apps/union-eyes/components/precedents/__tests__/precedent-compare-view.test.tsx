// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { PrecedentCompareView } from '../PrecedentCompareView';
import { toPrecedentRecord, type PrecedentRecord } from '../precedent-record';

beforeEach(() => {
  // The scroll areas measure their content, which jsdom cannot.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Read the way the console reads a route's answer, from a row shaped like the real route's.
const precedent = (overrides: Record<string, unknown> = {}): PrecedentRecord =>
  toPrecedentRecord({
    id: 'd-1',
    caseNumber: 'ABC-2021-001',
    caseTitle: 'Union v. Employer',
    decisionDate: '2021-03-04T12:00:00.000Z',
    issueTypes: ['discharge'],
    outcome: 'grievance_upheld',
    precedentValue: 'high',
    union: 'Local 100',
    employer: 'Acme Ltd.',
    ...overrides,
  });

const pair = (second: Record<string, unknown> = {}) => [precedent(), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007', caseTitle: 'Union v. Other Employer', ...second })];

function renderCompare(
  precedents: PrecedentRecord[],
  props: Partial<ComponentProps<typeof PrecedentCompareView>> = {},
  locale: 'en-CA' | 'fr-CA' = 'en-CA',
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA} timeZone="UTC">
      <PrecedentCompareView precedents={precedents} onRemovePrecedent={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

const table = () => screen.getByRole('table');

describe('PrecedentCompareView: what it shows', () => {
  it('shows the decisions side by side, with no analysis nobody computed', () => {
    renderCompare(pair({ outcome: 'dismissed' }));

    expect(screen.getByText('Precedent Comparison')).toBeInTheDocument();
    expect(screen.getByText('Comparing 2 precedents')).toBeInTheDocument();
    expect(screen.getAllByText('ABC-2021-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('XYZ-2022-007').length).toBeGreaterThan(0);
    expect(screen.queryByText('Analysis Summary')).toBeNull();
    expect(screen.queryByText('Organization')).toBeNull();
  });

  it('shows a decision’s parties and its stored columns, and each summary once under its own name', () => {
    renderCompare(pair({ summary: 'The grievance was dismissed.', keyFindings: ['No just cause shown'], reasoning: 'The onus was met.' }));

    expect(screen.getAllByText('Local 100')).toHaveLength(4); // a card and a table cell for each of the two decisions
    expect(screen.getAllByText('Acme Ltd.').length).toBeGreaterThan(0);
    expect(screen.getByText('The grievance was dismissed.')).toBeInTheDocument();
    expect(screen.getByText('No just cause shown')).toBeInTheDocument();
    expect(screen.getByText('The onus was met.')).toBeInTheDocument();
    expect(screen.queryByText('Issue Summary')).toBeNull();
    expect(screen.queryByText('Decision Summary')).toBeNull();
  });

  it('writes the issue types as words', () => {
    renderCompare([precedent({ issueTypes: ['just_cause', 'termination'] }), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007' })]);

    expect(within(table()).getByText('Just Cause, Termination')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/just_cause/);
  });

  it('leaves out a row no decision has a value for, and shows a value one of them lacks as unavailable, not as a made-up one', () => {
    renderCompare([precedent({ sector: 'education' }), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007' })]);

    expect(within(table()).getByText('Sector')).toBeInTheDocument();
    expect(within(table()).getByText('education')).toBeInTheDocument();
    expect(within(table()).getAllByText('Not available').length).toBeGreaterThan(0);
    // Nothing was recorded for either decision, so there is no row to compare.
    for (const row of ['Views', 'Citations', 'Tribunal', 'Arbitrator']) expect(within(table()).queryByText(row), row).toBeNull();
  });

  it('shows the counts the decisions carry, and the unavailable ones as such', () => {
    renderCompare([precedent({ viewCount: 12 }), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007', citationCount: 3 })]);

    const views = within(table()).getByText('Views').closest('tr')!;
    expect(within(views).getByText('12')).toBeInTheDocument();
    expect(within(views).getByText('Not available')).toBeInTheDocument();
    const citations = within(table()).getByText('Citations').closest('tr')!;
    expect(within(citations).getByText('3')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/- views|- citations|NaN|undefined/);
  });
});

describe('PrecedentCompareView: the database’s own members', () => {
  it('labels and colors each decision’s outcome, and shows the precedent value as a label', () => {
    renderCompare(pair({ outcome: 'partial_success', precedentValue: 'low' }));

    expect(screen.getAllByText('Grievance upheld')[0].className).toContain('bg-green-100');
    expect(screen.getAllByText('Partial success')[0].className).toContain('bg-yellow-100');
    expect(within(table()).getByText('High')).toBeInTheDocument();
    expect(within(table()).getByText('Low')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/grievance_upheld|partial_success/);
  });

  it('shows an outcome it has no label for as stored, with no color, instead of hiding it', () => {
    renderCompare([precedent({ outcome: 'a_new_outcome' }), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007' })]);

    expect(screen.getAllByText('a_new_outcome')[0].className).not.toMatch(/bg-(green|red|yellow|blue|gray)-100/);
  });
});

describe('PrecedentCompareView: acting on it', () => {
  it('names each remove control by the decision it removes, and reports which one is removed', () => {
    const onRemovePrecedent = vi.fn();
    renderCompare(pair(), { onRemovePrecedent });

    fireEvent.click(screen.getByRole('button', { name: 'Remove XYZ-2022-007 from the comparison' }));

    expect(onRemovePrecedent).toHaveBeenCalledWith('d-2');
  });

  it('offers the export only when its caller supplied one, and the notes only likewise', () => {
    const { unmount } = renderCompare(pair());
    expect(screen.queryByRole('button', { name: 'Export as JSON' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Comparison Notes' })).toBeNull();
    unmount();

    const onExport = vi.fn();
    const onNotesChange = vi.fn();
    renderCompare(pair(), { onExport, onNotesChange, comparisonNotes: 'First note' });
    fireEvent.click(screen.getByRole('button', { name: 'Export as JSON' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const notes = screen.getByRole('textbox', { name: 'Comparison Notes' });
    expect(notes).toHaveValue('First note');
    fireEvent.change(notes, { target: { value: 'Second note' } });
    expect(onNotesChange).toHaveBeenCalledWith('Second note');
  });
});

describe('PrecedentCompareView: more than two decisions', () => {
  const three = () => [precedent(), precedent({ id: 'd-2', caseNumber: 'XYZ-2022-007' }), precedent({ id: 'd-3', caseNumber: 'QRS-2023-011' })];
  const card = (name: string) => screen.queryByRole('button', { name: `Remove ${name} from the comparison` });

  it('shows two at a time and steps through the rest', () => {
    renderCompare(three());

    expect(screen.getByText('Showing 1-2 of 3')).toBeInTheDocument();
    expect(card('QRS-2023-011')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 2-3 of 3')).toBeInTheDocument();
    expect(card('ABC-2021-001')).toBeNull();
    expect(card('QRS-2023-011')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('leaves no decision out of reach when the last one is removed from the last step', () => {
    const { rerender } = renderCompare(three());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(card('ABC-2021-001')).toBeNull();

    rerender(
      <NextIntlClientProvider locale="en-CA" messages={enCA} timeZone="UTC">
        <PrecedentCompareView precedents={three().slice(0, 2)} onRemovePrecedent={vi.fn()} />
      </NextIntlClientProvider>,
    );

    // The window was on the second step; with two decisions left both are shown.
    expect(card('ABC-2021-001')).not.toBeNull();
    expect(card('XYZ-2022-007')).not.toBeNull();
  });
});

describe('PrecedentCompareView: French', () => {
  it('has every label, member and date in French', () => {
    renderCompare(pair({ outcome: 'dismissed', tribunal: 'fpslreb', jurisdiction: 'QC', viewCount: 1200 }), {}, 'fr-CA');

    expect(screen.getByText('Comparaison de précédents')).toBeInTheDocument();
    expect(screen.getByText('Comparaison de 2 précédents')).toBeInTheDocument();
    expect(screen.getAllByText('4 mars 2021').length).toBeGreaterThan(0);
    expect(within(table()).getByText('Résultat')).toBeInTheDocument();
    expect(within(table()).getByText('Date de la décision')).toBeInTheDocument();
    expect(within(table()).getByText('Syndicat')).toBeInTheDocument();
    expect(screen.getAllByText('Rejeté').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Québec').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Retirer ABC-2021-001 de la comparaison' })).toBeInTheDocument();
    expect(within(table()).getAllByText('Non disponible').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Comparison|Decision Date|Not available|Dismissed/);
  });
});
