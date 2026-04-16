"use client";

import { FileText, Link2, Shield } from "lucide-react";
import type { RelatedDocumentRankResult } from '@/services/case-intelligence/types';

export function RelatedDocumentsPanel(props: {
  documents: RelatedDocumentRankResult[];
  loading?: boolean;
}) {
  const { documents, loading = false } = props;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <div>
          <h3 className="text-sm font-semibold">Related Documents</h3>
          <p className="text-xs text-gray-500">{documents.length} authorized suggestions</p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading related documents…</p>
      ) : documents.length === 0 ? (
        <div className="rounded border border-dashed p-4 text-center">
          <p className="text-sm text-gray-600">No related documents found.</p>
          <p className="text-xs text-gray-500">Upload or link documents to improve suggestions.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.documentId} className="rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  {doc.title}
                </a>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{doc.documentType || "document"}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <Shield className="mr-1 inline h-3 w-3" />
                  {doc.privacyLabel}
                </span>
                <span className="ml-auto text-[11px] text-gray-500">Final {doc.finalScore}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {doc.reasons.map((reason) => (
                  <span key={reason} className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                    {reason}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                {(doc.linkedEntities ?? []).map((entity) => (
                  <span key={entity} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                    <Link2 className="mr-1 inline h-3 w-3" />
                    {entity}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  View
                </a>
                <a href={`/dashboard/documents`} className="text-blue-700 hover:underline">
                  Open in repository
                </a>
                <a href={`/dashboard/documents`} className="text-blue-700 hover:underline">
                  Link to case
                </a>
                <span className="ml-auto text-gray-500">Updated {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'n/a'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
