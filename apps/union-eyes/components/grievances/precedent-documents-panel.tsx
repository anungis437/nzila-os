"use client";

import { useLocale } from 'next-intl';
import { FileText, Shield } from 'lucide-react';
import { useAuthorizedDocumentOpen } from '@/lib/hooks/use-authorized-document-open';
import type { RelatedDocumentRankResult } from '@/services/case-intelligence/types';

const PRECEDENT_COPY = {
  en: {
    loading: 'Loading precedent documents…',
    title: 'Precedent documents',
    hint: 'Authorized precedents from similar cases, agreements, and templates',
    empty: 'No precedent documents are available to you.',
    score: 'Score',
  },
  fr: {
    loading: 'Chargement des documents de précédent…',
    title: 'Documents de précédent',
    hint: 'Précédents autorisés tirés de cas, de conventions et de modèles semblables',
    empty: 'Aucun document de précédent ne vous est accessible.',
    score: 'Score',
  },
} as const;

export function PrecedentDocumentsPanel(props: { documents: RelatedDocumentRankResult[]; loading?: boolean }) {
  const { open, opening, notice, copy } = useAuthorizedDocumentOpen();
  const text = PRECEDENT_COPY[useLocale().startsWith('fr') ? 'fr' : 'en'];

  if (props.loading) {
    return <div className="rounded-lg border bg-white p-4 text-xs text-gray-500">{text.loading}</div>;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{text.title}</h3>
        <p className="text-xs text-gray-500">{text.hint}</p>
      </div>

      {notice !== null && (
        <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {notice}
        </p>
      )}

      {props.documents.length === 0 ? (
        <p className="text-sm text-gray-500">{text.empty}</p>
      ) : (
        <div className="space-y-2">
          {props.documents.map((doc) => (
            <div key={doc.documentId} className="rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <button
                  type="button"
                  onClick={() => void open(doc.documentId)}
                  disabled={opening === doc.documentId}
                  aria-label={`${copy.download}: ${doc.title}`}
                  className="min-h-11 text-left text-sm font-medium text-blue-700 hover:underline disabled:opacity-50 sm:min-h-0"
                >
                  {doc.title}
                </button>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <Shield className="mr-1 inline h-3 w-3" />
                  {doc.privacyLabel}
                </span>
                <span className="ml-auto text-[11px] text-gray-500">{text.score} {doc.finalScore}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {doc.reasons.map((reason) => (
                  <span key={reason} className="rounded bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
                    {reason}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(doc.linkedEntities ?? []).map((entity) => (
                  <span key={entity} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{entity}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
