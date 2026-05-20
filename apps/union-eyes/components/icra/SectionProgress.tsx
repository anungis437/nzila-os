'use client';

import { Check } from 'lucide-react';
import { SECTIONS } from '@/lib/icra/questions';
import type { SectionId } from '@/lib/icra/types';

export interface SectionProgressProps {
  currentSection: SectionId | 'final_review';
  completedSections: Set<SectionId>;
}

const STEPS: Array<{ id: SectionId | 'final_review'; title: string; ordinal: number }> = [
  ...SECTIONS.map((s) => ({ id: s.id, title: s.title, ordinal: s.ordinal })),
  { id: 'final_review', title: 'Final Review', ordinal: SECTIONS.length + 1 },
];

export function SectionProgress({ currentSection, completedSections }: SectionProgressProps) {
  return (
    <nav aria-label="Assessment sections" className="border-b border-slate-200 bg-white">
      <ol className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 px-6 py-4 text-sm">
        {STEPS.map((step) => {
          const isCurrent = step.id === currentSection;
          const isComplete =
            step.id !== 'final_review' && completedSections.has(step.id as SectionId);
          return (
            <li
              key={step.id}
              className={[
                'flex items-center gap-2',
                isCurrent ? 'text-slate-900 font-medium' : 'text-slate-500',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs',
                  isComplete
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : isCurrent
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-500',
                ].join(' ')}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : step.ordinal}
              </span>
              <span className="whitespace-nowrap">{step.title}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
