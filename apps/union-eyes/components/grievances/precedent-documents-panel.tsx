"use client";

import { FileText, Shield } from 'lucide-react';
import type { RelatedDocumentRankResult } from '@/services/case-intelligence/types';

export function PrecedentDocumentsPanel(props: { documents: RelatedDocumentRankResult[]; loading?: boolean }) {
  if (props.loading) {
    return <div className="rounded-lg border bg-white p-4 text-xs text-gray-500">Loading precedent documents…</div>;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Precedent Documents</h3>
        <p className="text-xs text-gray-500">Authorized precedents from similar cases, agreements, and templates</p>
      </div>

      {props.documents.length === 0 ? (
        <p className="text-sm text-gray-500">No safe precedent documents available.</p>
      ) : (
        <div className="space-y-2">
          {props.documents.map((doc) => (
            <div key={doc.documentId} className="rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <a href={doc.fileUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">
                  {doc.title}
                </a>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <Shield className="mr-1 inline h-3 w-3" />
                  {doc.privacyLabel}
                </span>
                <span className="ml-auto text-[11px] text-gray-500">Final {doc.finalScore}</span>
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
