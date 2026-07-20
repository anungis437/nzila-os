'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { IncidentTimelineItem } from '@/modules/incidents/types';

/**
 * CaseTimelinePanel — chronological audit trail for a CourtLens matter.
 *
 * Ported from legacy `court-lens-ready/src/components/courtlens/matter/MatterAuditTrail.jsx`.
 *
 * Adapted to the actual `IncidentTimelineItem` shape (id, incidentId, happenedAt,
 * actorId, type, description, data?). The legacy shape (action_type, action_description,
 * previous_value, new_value, ai_generated, human_approved) is a Base44 artefact that
 * does not exist in this repo — do not reintroduce it.
 *
 * Uses a native `<select>` filter (the shared `@nzila/ui` package does not
 * currently export a Select primitive).
 *
 * Client component: has interactive filter state.
 */

type TimelineType = IncidentTimelineItem['type'];

const KNOWN_TYPES: readonly TimelineType[] = [
  'created',
  'assignment_changed',
  'status_changed',
  'note_added',
  'evidence_added',
  'remediation_created',
  'due_date_changed',
  'closed',
  'courtlens_event',
  'remediation_status_changed',
];

const CRITICAL_TYPES: ReadonlySet<TimelineType> = new Set(['closed', 'courtlens_event']);

export interface CaseTimelinePanelProps {
  timeline: readonly IncidentTimelineItem[];
}

export function CaseTimelinePanel({ timeline }: CaseTimelinePanelProps): React.ReactElement {
  const t = useTranslations('courtlens.caseTimeline');
  const locale = useLocale();
  const [filter, setFilter] = useState<'all' | TimelineType>('all');

  const availableTypes = useMemo<TimelineType[]>(() => {
    const seen = new Set<TimelineType>();
    for (const item of timeline) seen.add(item.type);
    return KNOWN_TYPES.filter((k) => seen.has(k));
  }, [timeline]);

  const sorted = useMemo(() => {
    const out = [...timeline];
    out.sort((a, b) => {
      const da = Date.parse(a.happenedAt);
      const db = Date.parse(b.happenedAt);
      return db - da;
    });
    return out;
  }, [timeline]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted;
    return sorted.filter((item) => item.type === filter);
  }, [sorted, filter]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5"
      data-testid="courtlens-case-timeline"
    >
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-poppins text-base font-semibold text-navy">{t('title')}</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">{t('description')}</p>

      <div className="mb-4 max-w-xs">
        <label
          className="mb-1 block text-xs font-medium text-slate-600"
          htmlFor="courtlens-timeline-filter"
        >
          {t('filterLabel')}
        </label>
        <select
          id="courtlens-timeline-filter"
          data-testid="timeline-filter"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-navy shadow-sm focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
          value={filter}
          onChange={(event) => {
            const next = event.target.value;
            setFilter(next === 'all' ? 'all' : (next as TimelineType));
          }}
        >
          <option value="all">{t('filterAll', { count: timeline.length })}</option>
          {availableTypes.map((type) => {
            const count = timeline.filter((item) => item.type === type).length;
            return (
              <option key={type} value={type}>
                {t(`types.${type}`)} ({count})
              </option>
            );
          })}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 text-slate-500"
          data-testid="timeline-empty"
        >
          <p className="text-sm">{t('noEntries')}</p>
        </div>
      ) : (
        <ol className="relative space-y-4" data-testid="timeline-entries">
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-4 top-2 w-px bg-slate-200"
          />
          {filtered.map((item) => {
            const isCritical = CRITICAL_TYPES.has(item.type);
            const parsedDate = Date.parse(item.happenedAt);
            const dateLabel = Number.isNaN(parsedDate)
              ? item.happenedAt
              : dateFormatter.format(new Date(parsedDate));
            return (
              <li
                key={item.id}
                data-testid={`timeline-entry-${item.type}`}
                className="relative pl-12"
              >
                <span
                  aria-hidden="true"
                  className={
                    'absolute left-2.5 top-2 h-3 w-3 rounded-full ring-2 ring-white ' +
                    (isCritical ? 'bg-red-500' : 'bg-electric')
                  }
                />
                <div
                  className={
                    'rounded-lg border p-3 ' +
                    (isCritical
                      ? 'border-red-200 bg-red-50'
                      : 'border-slate-200 bg-white')
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                      {t(`types.${item.type}`)}
                    </span>
                    <time
                      dateTime={item.happenedAt}
                      className="shrink-0 whitespace-nowrap text-xs text-slate-500"
                    >
                      {dateLabel}
                    </time>
                  </div>
                  <p className="mt-2 text-sm text-navy">{item.description}</p>
                  {item.actorId && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t('actor', { id: item.actorId })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default CaseTimelinePanel;
