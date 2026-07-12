'use client'

/**
 * Platform Admin — SAGE review note list (client component)
 *
 * Renders attributed human review notes: reviewer identity, note type, and
 * timestamp. Each note is explicitly labelled as a human observation — a note is
 * never an approval or a decision.
 */
import { useTranslations } from 'next-intl'
import type { SageReviewNoteResponse } from '@/lib/sage/governance-schemas'

interface ReviewNoteListProps {
  notes: SageReviewNoteResponse[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ReviewNoteList({ notes }: ReviewNoteListProps) {
  const t = useTranslations('sageGovernance')

  if (notes.length === 0) {
    return <p className="text-sm text-gray-400">{t('noNotes')}</p>
  }

  return (
    <ul className="space-y-3" aria-label={t('notesListLabel')}>
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="rounded-full border border-gray-300 px-2 py-0.5">
              {t('humanAuthored')}
            </span>
            <span>{humanize(note.noteType)}</span>
            {note.targetType && <span>· {humanize(note.targetType)}</span>}
          </div>
          <p className="mt-1 text-sm text-gray-800">{note.note}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t('recordedBy')} {note.reviewerId} · {note.createdAt}
          </p>
        </li>
      ))}
    </ul>
  )
}
