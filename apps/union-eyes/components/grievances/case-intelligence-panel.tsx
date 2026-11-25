"use client";

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CaseGraphSummary } from '@/components/grievances/case-graph-summary';
import { PrecedentDocumentsPanel } from '@/components/grievances/precedent-documents-panel';
import { RelatedDocumentsPanel } from '@/components/grievances/related-documents-panel';
import { SimilarCasesPanel } from '@/components/grievances/similar-cases-panel';
import type { IntelligenceResponse } from '@/services/case-intelligence/types';

const emptyState: IntelligenceResponse = {
  graph: { nodes: [], edges: [] },
  relatedDocuments: [],
  similarCases: [],
  precedentDocuments: [],
};

function readIntelligence(body: unknown): IntelligenceResponse {
  const data = (body as { data?: Partial<IntelligenceResponse> } | null)?.data;
  if (
    !data ||
    !data.graph ||
    !Array.isArray(data.graph.nodes) ||
    !Array.isArray(data.graph.edges) ||
    !Array.isArray(data.relatedDocuments) ||
    !Array.isArray(data.similarCases) ||
    !Array.isArray(data.precedentDocuments)
  ) {
    throw new Error('not an intelligence answer');
  }
  return data as IntelligenceResponse;
}

export function CaseIntelligencePanel(props: { caseId: string }) {
  const t = useTranslations("caseIntelligence");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<IntelligenceResponse>(emptyState);
  const [reasonFilter, setReasonFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch(`/api/grievances/${props.caseId}/intelligence`);
        if (!response.ok) throw new Error('not ok');
        const json = await response.json();
        const next = readIntelligence(json);
        if (isMounted) setData(next);
      } catch {
        if (isMounted) {
          setData(emptyState);
          setFailed(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [props.caseId]);

  const labels = useMemo(
    () => [...new Set(data.relatedDocuments.map((item) => item.privacyLabel))],
    [data.relatedDocuments],
  );

  const filteredRelatedDocuments = useMemo(
    () =>
      data.relatedDocuments.filter((item) => {
        if (labelFilter && item.privacyLabel !== labelFilter) return false;
        if (reasonFilter && !item.reasons.some((reason) => reason.toLowerCase().includes(reasonFilter.toLowerCase()))) {
          return false;
        }
        return true;
      }),
    [data.relatedDocuments, labelFilter, reasonFilter],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold">{t("title")}</h2>
          <p className="text-xs text-gray-500">{t("description")}</p>
        </div>
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t("humanReviewNotice")}
        </div>
        {failed && (
          <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {t("loadFailed")}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            value={reasonFilter}
            onChange={(event) => setReasonFilter(event.target.value)}
            placeholder={t("filterByReason")}
            className="rounded border px-3 py-2 text-xs"
          />
          <select
            value={labelFilter}
            onChange={(event) => setLabelFilter(event.target.value)}
            className="rounded border px-3 py-2 text-xs"
          >
            <option value="">{t("allPrivacyLabels")}</option>
            {labels.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!failed && (
          <>
            <RelatedDocumentsPanel documents={filteredRelatedDocuments} loading={loading} />
            <SimilarCasesPanel cases={data.similarCases} loading={loading} />
            <PrecedentDocumentsPanel documents={data.precedentDocuments} loading={loading} />
            <CaseGraphSummary graph={data.graph} loading={loading} />
          </>
        )}
      </div>
    </div>
  );
}
