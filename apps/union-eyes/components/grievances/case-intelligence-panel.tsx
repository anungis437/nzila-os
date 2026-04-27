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

export function CaseIntelligencePanel(props: { caseId: string }) {
  const t = useTranslations("caseIntelligence");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IntelligenceResponse>(emptyState);
  const [reasonFilter, setReasonFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/grievances/${props.caseId}/intelligence`);
        const json = await response.json();
        if (isMounted) {
          setData(json?.data ?? emptyState);
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
        <RelatedDocumentsPanel documents={filteredRelatedDocuments} loading={loading} />
        <SimilarCasesPanel cases={data.similarCases} loading={loading} />
        <PrecedentDocumentsPanel documents={data.precedentDocuments} loading={loading} />
        <CaseGraphSummary graph={data.graph} loading={loading} />
      </div>
    </div>
  );
}
