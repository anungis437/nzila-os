import React from 'react'

export interface TimelineCardProps {
  date: string
  category: string
  title: string
  summary?: string
  provider?: string
  facility?: string
  source: string
  flags?: string[]
}

export function TimelineCard({
  date,
  category,
  title,
  summary,
  provider,
  facility,
  source,
  flags = [],
}: TimelineCardProps) {
  return (
    <div className="timeline-card" role="article" aria-label={`Timeline event: ${title}`}>
      <div className="timeline-card__header">
        <span className="timeline-card__date">{date}</span>
        <span className="timeline-card__category">{category}</span>
        <span className="timeline-card__source-badge">{source}</span>
      </div>
      <div className="timeline-card__title">{title}</div>
      {summary && <div className="timeline-card__summary">{summary}</div>}
      {(provider ?? facility) && (
        <div className="timeline-card__meta">
          {provider && <span>{provider}</span>}
          {facility && <span> · {facility}</span>}
        </div>
      )}
      {flags.length > 0 && (
        <div className="timeline-card__flags" aria-label="Event flags">
          {flags.map((flag) => (
            <span key={flag} className="timeline-card__flag">
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
