"use client";

import { FileText, Link2, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuthorizedDocumentOpen } from '@/lib/hooks/use-authorized-document-open';
import type { RelatedDocumentRankResult } from '@/services/case-intelligence/types';

export function RelatedDocumentsPanel(props: {
  documents: RelatedDocumentRankResult[];
  loading?: boolean;
}) {
  const t = useTranslations("relatedDocuments");
  const { documents, loading = false } = props;
  const { open, opening, notice, copy } = useAuthorizedDocumentOpen();

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <div>
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <p className="text-xs text-gray-500">{t("suggestions", { count: documents.length })}</p>
        </div>
      </div>

      {notice !== null && (
        <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-gray-500">{t("loading")}</p>
      ) : documents.length === 0 ? (
        <div className="rounded border border-dashed p-4 text-center">
          <p className="text-sm text-gray-600">{t("empty")}</p>
          <p className="text-xs text-gray-500">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.documentId} className="rounded border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <button
                  type="button"
                  onClick={() => void open(doc.documentId)}
                  disabled={opening === doc.documentId}
                  aria-label={`${t("view")}: ${doc.title}`}
                  className="min-h-11 text-left text-sm font-medium text-blue-700 hover:underline disabled:opacity-50 sm:min-h-0"
                >
                  {doc.title}
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{doc.documentType || t("documentDefault")}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <Shield className="mr-1 inline h-3 w-3" />
                  {doc.privacyLabel}
                </span>
                <span className="ml-auto text-[11px] text-gray-500">{t("finalScore", { score: doc.finalScore })}</span>
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
                <button
                  type="button"
                  onClick={() => void open(doc.documentId)}
                  disabled={opening === doc.documentId}
                  aria-label={`${copy.download}: ${doc.title}`}
                  className="min-h-11 text-blue-700 hover:underline disabled:opacity-50 sm:min-h-0"
                >
                  {t("view")}
                </button>
                <a href={`/dashboard/documents`} className="text-blue-700 hover:underline">
                  {t("openRepository")}
                </a>
                <a href={`/dashboard/documents`} className="text-blue-700 hover:underline">
                  {t("linkToCase")}
                </a>
                <span className="ml-auto text-gray-500">{t("updated", { date: doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : t("notAvailable") })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
