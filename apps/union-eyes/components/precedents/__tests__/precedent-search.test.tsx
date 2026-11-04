// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { PrecedentSearch } from '../PrecedentSearch';
import { NO_FILTERS, type PrecedentFilters } from '../precedent-filters';

const intl: { locale: 'en-CA' | 'fr-CA' } = { locale: 'en-CA' };

// The console owns the filters and hands them down; this stands in for it.
function Parent({ onChange, initial = NO_FILTERS }: { onChange: (filters: PrecedentFilters) => void; initial?: PrecedentFilters }) {
  const [filters, setFilters] = useState(initial);
  return (
    <NextIntlClientProvider locale={intl.locale} messages={intl.locale === 'en-CA' ? enCA : frCA}>
      <PrecedentSearch
        filters={filters}
        onChange={(next) => {
          onChange(next);
          setFilters(next);
        }}
      />
    </NextIntlClientProvider>
  );
}

const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^(Filters|Filtres)/ }));
const settle = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  intl.locale = 'en-CA';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PrecedentSearch: the text search', () => {
  it('passes the typed text up once typing has paused, not on every keystroke', () => {
    const onChange = vi.fn();
    render(<Parent onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Search precedents' });

    fireEvent.change(box, { target: { value: 'just' } });
    fireEvent.change(box, { target: { value: 'just cause' } });
    settle(499);
    expect(onChange).not.toHaveBeenCalled();

    settle(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ ...NO_FILTERS, query: 'just cause' });
  });

  it('does not stay disabled while the list loads, so typing is never interrupted', () => {
    render(<Parent onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Search precedents' })).toBeEnabled();
  });
});

describe('PrecedentSearch: the filters', () => {
  it('offers only filters the list route can apply, with the database’s own members', () => {
    render(<Parent onChange={vi.fn()} />);
    openFilters();

    for (const heading of ['Outcome', 'Precedent value']) expect(screen.getByText(heading)).toBeInTheDocument();
    for (const label of ['Jurisdiction', 'Sector', 'Arbitrator', 'Decided on or after', 'Decided on or before']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByRole('checkbox').map((box) => box.id).sort()).toEqual(
      [
        'outcome-dismissed',
        'outcome-grievance_denied',
        'outcome-grievance_upheld',
        'outcome-partial_success',
        'outcome-settled',
        'outcome-withdrawn',
        'value-high',
        'value-low',
        'value-medium',
      ].sort(),
    );
    // What the older search screen offered and no route can apply.
    expect(document.body.textContent).not.toMatch(/Grievance Type|Sharing Level|Binding|Persuasive|Informative|Partially Upheld/);
  });

  it('adds and removes outcome members, each acting at once', () => {
    const onChange = vi.fn();
    render(<Parent onChange={onChange} />);
    openFilters();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Grievance upheld' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, outcomes: ['grievance_upheld'] });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Settled' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, outcomes: ['grievance_upheld', 'settled'] });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Grievance upheld' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, outcomes: ['settled'] });
  });

  it('sends precedent values and one jurisdiction as the route reads them', () => {
    const onChange = vi.fn();
    render(<Parent onChange={onChange} />);
    openFilters();

    fireEvent.click(screen.getByRole('checkbox', { name: 'High' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, precedentValues: ['high'] });

    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: 'ON' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, precedentValues: ['high'], jurisdiction: 'ON' });

    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_FILTERS, precedentValues: ['high'], jurisdiction: '' });
  });

  it('passes the sector and arbitrator up once typing has paused, and the dates at once', () => {
    const onChange = vi.fn();
    render(<Parent onChange={onChange} />);
    openFilters();

    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'educ' } });
    fireEvent.change(screen.getByLabelText('Arbitrator'), { target: { value: 'Jane' } });
    expect(onChange).not.toHaveBeenCalled();
    settle(500);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sector: 'educ' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ arbitrator: 'Jane' }));

    fireEvent.change(screen.getByLabelText('Decided on or after'), { target: { value: '2021-01-01' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fromDate: '2021-01-01' }));
  });

  it('counts the filters that are set on the button, and shows no count when none is', () => {
    const { unmount } = render(<Parent onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    unmount();

    render(<Parent onChange={vi.fn()} initial={{ ...NO_FILTERS, query: 'q', outcomes: ['settled', 'dismissed'] }} />);
    expect(screen.getByRole('button', { name: /^Filters\s*3$/ })).toBeInTheDocument();
  });
});

describe('PrecedentSearch: clearing', () => {
  it('clears every filter and the typed text, and does not bring the old text back when typing settles', () => {
    const onChange = vi.fn();
    render(<Parent onChange={onChange} initial={{ ...NO_FILTERS, query: 'abc', sector: 'educ', outcomes: ['settled'] }} />);
    expect(screen.getByRole('textbox', { name: 'Search precedents' })).toHaveValue('abc');
    openFilters();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(NO_FILTERS);
    expect(screen.getByLabelText('Sector')).toHaveValue('');

    settle(1000);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('offers to clear only when a filter is set', () => {
    const { unmount } = render(<Parent onChange={vi.fn()} />);
    openFilters();
    expect(screen.queryByRole('button', { name: 'Clear all filters' })).toBeNull();
    unmount();

    render(<Parent onChange={vi.fn()} initial={{ ...NO_FILTERS, jurisdiction: 'ON' }} />);
    openFilters();
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
  });
});

describe('PrecedentSearch: French', () => {
  it('is in French on a French locale, with the French member labels', () => {
    intl.locale = 'fr-CA';
    render(<Parent onChange={vi.fn()} initial={{ ...NO_FILTERS, jurisdiction: 'QC' }} />);

    expect(screen.getByRole('textbox', { name: 'Rechercher des précédents' })).toBeInTheDocument();
    openFilters();
    expect(screen.getByText('Résultat')).toBeInTheDocument();
    expect(screen.getByText('Valeur de précédent')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Grief accueilli' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Élevée' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tous les territoires' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Québec' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Effacer tous les filtres' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Outcome|Precedent value|Any jurisdiction|Clear all filters/);
  });
});
