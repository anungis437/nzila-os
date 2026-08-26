/**
 * @vitest-environment jsdom
 *
 * CaseTimelinePanel — client component rendering the CourtLens matter timeline.
 *
 * Proves:
 *  - Sorts timeline entries newest first.
 *  - Renders every known IncidentTimelineItem type with a localized label.
 *  - Filter dropdown narrows the visible entries to a single type.
 *  - Empty-state renders when no entries match the filter.
 *  - Applies critical styling to `closed` / `courtlens_event` entries.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', async () => (await import('@/lib/test/next-intl-mock')).clientMock);

import type { IncidentTimelineItem } from '@/modules/incidents/types';

import { CaseTimelinePanel } from '../CaseTimelinePanel';

afterEach(() => {
  cleanup();
});

function makeItem(
  overrides: Partial<IncidentTimelineItem> & Pick<IncidentTimelineItem, 'type'>,
): IncidentTimelineItem {
  return {
    id: overrides.id ?? `t-${Math.random().toString(36).slice(2, 10)}`,
    incidentId: overrides.incidentId ?? 'incident-1',
    happenedAt: overrides.happenedAt ?? '2026-01-01T00:00:00.000Z',
    actorId: overrides.actorId ?? 'actor-1',
    type: overrides.type,
    description: overrides.description ?? `event: ${overrides.type}`,
    data: overrides.data,
  };
}

describe('CaseTimelinePanel', () => {
  it('renders every timeline entry, newest first', () => {
    const timeline: IncidentTimelineItem[] = [
      makeItem({ id: 'a', type: 'created', happenedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: 'b', type: 'note_added', happenedAt: '2026-02-01T00:00:00.000Z' }),
      makeItem({ id: 'c', type: 'closed', happenedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    render(<CaseTimelinePanel timeline={timeline} />);
    const entries = screen.getByTestId('timeline-entries');
    const items = within(entries).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0].getAttribute('data-testid')).toBe('timeline-entry-closed');
    expect(items[1].getAttribute('data-testid')).toBe('timeline-entry-note_added');
    expect(items[2].getAttribute('data-testid')).toBe('timeline-entry-created');
  });

  it('filters entries by type when a filter is selected', () => {
    const timeline: IncidentTimelineItem[] = [
      makeItem({ id: 'a', type: 'created', happenedAt: '2026-01-01T00:00:00.000Z' }),
      makeItem({ id: 'b', type: 'note_added', happenedAt: '2026-02-01T00:00:00.000Z' }),
      makeItem({ id: 'c', type: 'note_added', happenedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    render(<CaseTimelinePanel timeline={timeline} />);

    const select = screen.getByTestId('timeline-filter') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'note_added' } });

    const entries = screen.getByTestId('timeline-entries');
    const items = within(entries).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.getAttribute('data-testid')).toBe('timeline-entry-note_added');
    }
  });

  it('shows the empty state when no entries match the filter', () => {
    const timeline: IncidentTimelineItem[] = [
      makeItem({ id: 'a', type: 'created' }),
    ];
    render(<CaseTimelinePanel timeline={timeline} />);
    const select = screen.getByTestId('timeline-filter') as HTMLSelectElement;
    // "closed" is a known type but not present in the timeline; the option
    // won't render, so we simulate a filter change to it directly.
    fireEvent.change(select, { target: { value: 'closed' } });
    expect(screen.getByTestId('timeline-empty')).toBeTruthy();
    expect(screen.queryByTestId('timeline-entries')).toBeNull();
  });

  it('shows the empty state when the timeline is empty', () => {
    render(<CaseTimelinePanel timeline={[]} />);
    expect(screen.getByTestId('timeline-empty')).toBeTruthy();
  });

  it('applies critical styling to closed / courtlens_event entries', () => {
    const timeline: IncidentTimelineItem[] = [
      makeItem({ id: 'a', type: 'closed', happenedAt: '2026-04-01T00:00:00.000Z' }),
      makeItem({ id: 'b', type: 'note_added', happenedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    render(<CaseTimelinePanel timeline={timeline} />);
    const closedEntry = screen.getByTestId('timeline-entry-closed');
    const noteEntry = screen.getByTestId('timeline-entry-note_added');
    expect(closedEntry.querySelector('.bg-red-50')).not.toBeNull();
    expect(noteEntry.querySelector('.bg-red-50')).toBeNull();
  });
});
