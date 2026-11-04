"use client";

/**
 * DocumentsConsole — full document management UI (client component).
 * Extracted from documents/page.tsx so the page can be a server component.
 * Operational-only; the demo experience lives in `@nzila/union-eyes-demo`.
 */

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Shield } from "lucide-react";
import {
  DocumentLibraryBrowser,
  type DocumentItem,
} from "@/components/documents/document-library-browser";
import {
  DocumentVersionControl,
  type DocumentVersion,
} from "@/components/documents/document-version-control";
import {
  DocumentTemplateManager,
  type DocumentTemplate,
} from "@/components/documents/document-template-manager";
import {
  DocumentSearchAdvanced,
  type SavedSearch,
  type SearchFilters,
} from "@/components/documents/document-search-advanced";
import { DocumentBulkOperations } from "@/components/documents/document-bulk-operations";
import { DocumentRetentionPolicy } from "@/components/documents/document-retention-policy";
import { OCRUpload } from "@/components/documents/ocr-upload";
import { useOrganizationId } from "@/lib/hooks/use-organization";
import {
  canonicalShareUnavailable,
  denialForBulkOutcome,
  formatBulkSummary,
  journeyCopy,
  type BulkDownloadReport,
  type JourneyDenial,
} from "@/lib/documents/canonical-journey";
import {
  listDenied,
  repositoryRows,
  requestAuthorizedDownload,
  requestBulkDownload,
  submitDocumentVersion,
  submitRepositoryDocument,
} from "@/lib/documents/document-repository-client";

type RepositoryDocumentRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  filename?: string | null;
  documentType?: string | null;
  privacyLabel?: string | null;
  uploadedBy?: string | null;
  uploadedByName?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
};

type PrivacyLabel =
  | 'public_internal'
  | 'team_confidential'
  | 'lro_confidential'
  | 'privileged'
  | 'case_restricted'
  | 'highly_sensitive';

type RepositoryDetailResponse = RepositoryDocumentRow & {
  versions?: Array<{
    id: string;
    versionNo: number;
    uploadedAt: string | Date;
    uploadedBy?: string | null;
    uploadedByName?: string | null;
    contentHash: string;
  }>;
};


function toDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  return value ? new Date(value) : new Date();
}

function toRepositoryDocumentItem(row: RepositoryDocumentRow): DocumentItem {
  const name = row.title ?? row.name ?? row.filename ?? row.id;
  const labels = [row.documentType, row.privacyLabel].filter(Boolean) as string[];

  return {
    id: row.id,
    name,
    type: 'file',
    mimeType: row.documentType ?? undefined,
    size: row.fileSize ?? undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    ...(row.uploadedByName ? { createdBy: { id: row.uploadedBy ?? row.uploadedByName, name: row.uploadedByName } } : {}),
    parentId: null,
    path: [],
    starred: false,
    tags: labels,
    permissions: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
    },
  };
}

function toVersionView(version: NonNullable<RepositoryDetailResponse['versions']>[number], isCurrent: boolean): DocumentVersion {
  return {
    id: version.id,
    versionNumber: version.versionNo,
    createdAt: toDate(version.uploadedAt),
    ...(version.uploadedByName ? { createdBy: { id: version.uploadedBy ?? version.uploadedByName, name: version.uploadedByName } } : {}),
    contentHash: version.contentHash,
    isCurrent,
    downloadUrl: '',
  };
}

export function DocumentsConsole() {
  const t = useTranslations("documentsPage");
  const locale = useLocale();
  const copy = journeyCopy(locale);
  const organizationId = useOrganizationId();
  const [notice, setNotice] = React.useState<JourneyDenial | 'saved' | null>(null);
  const [activeTab, setActiveTab] = React.useState("library");
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = React.useState<RepositoryDetailResponse | null>(null);
  const [selectedDocumentVersions, setSelectedDocumentVersions] = React.useState<DocumentVersion[]>([]);
  const [selectedLibraryItems, setSelectedLibraryItems] = React.useState<DocumentItem[]>([]);
  const [selectionResetSignal, setSelectionResetSignal] = React.useState(0);
  const [repoDocs, setRepoDocs] = React.useState<RepositoryDocumentRow[]>([]);
  const [query, setQuery] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [savedSearches, setSavedSearches] = React.useState<SavedSearch[]>([]);
  const [bulkReport, setBulkReport] = React.useState<BulkDownloadReport | null>(null);
  const [filters, setFilters] = React.useState<SearchFilters>({ query: '' });
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [versioning, setVersioning] = React.useState(false);
  const [uploadPayload, setUploadPayload] = React.useState({
    title: '',
    filename: '',
    fileUrl: '',
    mimeType: 'application/pdf',
    documentType: 'evidence',
    privacyLabel: 'team_confidential',
    contentHash: '',
    linkedEntityType: 'grievance',
    linkedEntityId: '',
  });

  const loadRepository = React.useCallback(async (nextFilters: SearchFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextFilters.query) params.set('keyword', nextFilters.query);
      if (nextFilters.fileTypes?.length) params.set('documentType', nextFilters.fileTypes[0] ?? '');
      if (nextFilters.owners?.length) params.set('uploader', nextFilters.owners[0] ?? '');
      if (nextFilters.dateFrom) params.set('from', nextFilters.dateFrom.toISOString());
      if (nextFilters.dateTo) params.set('to', nextFilters.dateTo.toISOString());
      if (nextFilters.tags?.length) params.set('label', nextFilters.tags[0] ?? '');
      const res = await fetch(`/api/documents/repository?${params.toString()}`);
      const json = await res.json().catch(() => null);
      const denial = listDenied(res.status, json);
      if (denial) {
        setRepoDocs([]);
        setNotice(denial);
        return;
      }
      setRepoDocs(repositoryRows(json) as RepositoryDocumentRow[]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadDocumentDetails = React.useCallback(async (documentId: string) => {
    setSelectedDocumentId(documentId);
    try {
      const res = await fetch(`/api/documents/repository/${documentId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSelectedDocument(null);
        setSelectedDocumentVersions([]);
        setNotice(res.status === 401 || res.status === 403 || res.status === 404 ? 'unauthorized' : 'list_unavailable');
        return;
      }
      const detail = (json && typeof json === 'object' && 'data' in json ? (json as { data: RepositoryDetailResponse }).data : json) as RepositoryDetailResponse;
      setSelectedDocument(detail);
      const versions = Array.isArray(detail?.versions) ? detail.versions : [];
      setSelectedDocumentVersions(
        versions.map((version, index) => toVersionView(version, index === 0)),
      );
      setNotice(null);
      setActiveTab('library');
    } catch {
      setSelectedDocument(null);
      setSelectedDocumentVersions([]);
    }
  }, []);

  const repositoryItems = React.useMemo<DocumentItem[]>(() => {
    return repoDocs.map((row) => toRepositoryDocumentItem(row));
  }, [repoDocs]);

  const availableTags = React.useMemo(() => {
    return Array.from(
      new Set(repoDocs.flatMap((row) => [row.documentType, row.privacyLabel].filter(Boolean) as string[])),
    ).sort();
  }, [repoDocs]);

  const availableUsers = React.useMemo(() => {
    const users = new Map<string, string>();
    for (const row of repoDocs) {
      if (row.uploadedBy && row.uploadedByName) users.set(row.uploadedBy, row.uploadedByName);
    }
    return Array.from(users, ([id, name]) => ({ id, name }));
  }, [repoDocs]);

  const templateItems = React.useMemo<DocumentTemplate[]>(() => {
    return repoDocs
      .filter((document) => {
        const type = document.documentType?.toLowerCase() ?? '';
        return document.linkedEntityType === 'template_library' || type.includes('template');
      })
      .map((document) => ({
        id: document.id,
        name: document.title ?? document.name ?? document.filename ?? document.id,
        category: document.documentType ?? 'template',
        description: document.filename ?? undefined,
        createdAt: toDate(document.createdAt),
        updatedAt: toDate(document.updatedAt),
      }));
  }, [repoDocs]);

  React.useEffect(() => {
    void loadRepository(filters);
  }, [filters, loadRepository]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem('documents:saved-searches');
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedSearch[];
      if (Array.isArray(parsed)) {
        setSavedSearches(parsed);
      }
    } catch {
      // Ignore local parsing failures.
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem('documents:saved-searches', JSON.stringify(savedSearches));
  }, [savedSearches]);

  const uploadDocument = async () => {
    setUploading(true);
    try {
      const payload = {
        ...uploadPayload,
        // The server computes the content hash from storage. A value typed here is only a claim to be checked.
        contentHash: uploadPayload.contentHash.trim() || undefined,
        linkedEntityType: uploadPayload.linkedEntityId ? uploadPayload.linkedEntityType : undefined,
        linkedEntityId: uploadPayload.linkedEntityId || undefined,
      };

      const result = await submitRepositoryDocument(payload);
      if (!result.accepted) {
        setNotice(result.denial ?? 'upload_rejected');
        return;
      }

      setUploadPayload({
        title: '',
        filename: '',
        fileUrl: '',
        mimeType: 'application/pdf',
        documentType: 'evidence',
        privacyLabel: 'team_confidential',
        contentHash: '',
        linkedEntityType: 'grievance',
        linkedEntityId: '',
      });
      setNotice('saved');
      await loadRepository();
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = (search: SearchFilters) => {
    setFilters(search);
    setQuery(search.query);
  };

  const handleSaveSearch = (name: string, nextFilters: SearchFilters) => {
    setSavedSearches((previous) => {
      const existing = previous.find((item) => item.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        return previous.map((item) =>
          item.id === existing.id
            ? { ...item, filters: nextFilters, usageCount: item.usageCount + 1 }
            : item,
        );
      }

      return [
        {
          id: `saved-${Date.now()}`,
          name,
          filters: nextFilters,
          usageCount: 1,
        },
        ...previous,
      ].slice(0, 10);
    });
  };

  const handleOpenDocument = (documentId: string) => {
    void loadDocumentDetails(documentId);
  };

  const openAuthorizedDownload = async (documentId: string) => {
    const result = await requestAuthorizedDownload(documentId);
    if (!result.downloadUrl) {
      setNotice(result.denial ?? 'unauthorized');
      return;
    }
    setNotice(null);
    window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadDocument = (item: DocumentItem) => {
    void openAuthorizedDownload(item.id);
  };

  const handlePreviewDocument = (item: DocumentItem) => {
    void loadDocumentDetails(item.id);
  };

  const handleClearSelection = () => {
    setSelectionResetSignal((value) => value + 1);
    setSelectedLibraryItems([]);
  };

  const handleRepositorySearch = async () => {
    const nextFilters: SearchFilters = {
      ...filters,
      query,
      tags: label ? [label] : undefined,
    };
    setFilters(nextFilters);
    await loadRepository(nextFilters);
  };

  const handleBulkDownload = async () => {
    if (selectedLibraryItems.length === 0) {
      setNotice('none_selected');
      return;
    }

    setBulkReport(null);
    const result = await requestBulkDownload(selectedLibraryItems.map((item) => item.id));
    if (!result.report) {
      setNotice(result.denial ?? 'bulk_unavailable');
      return;
    }
    setNotice(null);
    setBulkReport(result.report);
    for (const item of result.report.items) {
      if (item.outcome === 'issued' && item.downloadUrl) {
        window.open(item.downloadUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleBulkShare = async (_permission: string) => {
    canonicalShareUnavailable();
    setNotice('share_blocked');
  };

  const appendVersion = async (documentId: string) => {
    const fileUrl = window.prompt(t('prompts.versionFileUrl'));
    const contentHash = window.prompt(t('prompts.versionContentHash'));
    if (!fileUrl || !contentHash) {
      return;
    }

    setVersioning(true);
    try {
      const result = await submitDocumentVersion(documentId, {
        fileUrl,
        contentHash,
        expectedVersionNo: selectedDocumentId === documentId ? selectedDocumentVersions[0]?.versionNumber : undefined,
      });
      if (!result.accepted) {
        setNotice(result.denial ?? 'upload_rejected');
        return;
      }
      setNotice('saved');
      await loadRepository();
    } finally {
      setVersioning(false);
    }
  };

  return (
    <div className="container mx-auto max-w-full py-4 sm:py-8 space-y-6">
      {notice && (
        <p
          role="alert"
          data-testid="document-journey-notice"
          className="rounded-md border px-3 py-2 text-sm"
        >
          {notice === 'saved' ? copy.saved : copy[notice]}
        </p>
      )}
      {bulkReport && (
        <div role="status" data-testid="document-bulk-report" className="rounded-md border px-3 py-2 text-sm">
          <p>{formatBulkSummary(copy, bulkReport)}</p>
          {bulkReport.items.some((item) => item.outcome !== 'issued') && (
            <ul className="mt-2 list-disc pl-5">
              {bulkReport.items
                .filter((item) => item.outcome !== 'issued')
                .map((item) => (
                  <li key={item.documentId}>
                    {selectedLibraryItems.find((candidate) => candidate.id === item.documentId)?.name ?? item.documentId}
                    {': '}
                    {copy[denialForBulkOutcome(item.outcome)]}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('header.title')}</h1>
          <p className="text-gray-600 mt-2">
            {t('header.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("bulk")}>
            <Upload className="h-4 w-4 mr-2" />
            {t('header.bulkUpload')}
          </Button>
          <Button onClick={() => setActiveTab('repository')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('header.uploadDocument')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="repository">{t('tabs.repository')}</TabsTrigger>
          <TabsTrigger value="library">{t('tabs.library')}</TabsTrigger>
          <TabsTrigger value="search">{t('tabs.search')}</TabsTrigger>
          <TabsTrigger value="templates">{t('tabs.templates')}</TabsTrigger>
          <TabsTrigger value="retention">{t('tabs.retention')}</TabsTrigger>
          <TabsTrigger value="bulk">{t('tabs.bulk')}</TabsTrigger>
        </TabsList>

        <TabsContent value="repository" className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <Shield className="mr-1 inline h-4 w-4" />
            {t('repository.privacyNotice')}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('repository.searchPlaceholder')}
              className="rounded border px-3 py-2 text-sm md:col-span-2"
            />
            <select value={label} onChange={(e) => setLabel(e.target.value)} className="rounded border px-3 py-2 text-sm">
              <option value="">{t('repository.allLabels')}</option>
              <option value="public_internal">public_internal</option>
              <option value="team_confidential">team_confidential</option>
              <option value="lro_confidential">lro_confidential</option>
              <option value="privileged">privileged</option>
              <option value="case_restricted">case_restricted</option>
              <option value="highly_sensitive">highly_sensitive</option>
            </select>
            <Button variant="outline" onClick={() => void handleRepositorySearch()} disabled={loading}>
              {loading ? t('repository.searching') : t('repository.search')}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-3">
            <input value={uploadPayload.title} onChange={(e) => setUploadPayload((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('repository.uploadFields.title')} className="rounded border px-3 py-2 text-sm" />
            <input value={uploadPayload.filename} onChange={(e) => setUploadPayload((prev) => ({ ...prev, filename: e.target.value }))} placeholder={t('repository.uploadFields.filename')} className="rounded border px-3 py-2 text-sm" />
            <input value={uploadPayload.fileUrl} onChange={(e) => setUploadPayload((prev) => ({ ...prev, fileUrl: e.target.value }))} placeholder={t('repository.uploadFields.fileUrl')} className="rounded border px-3 py-2 text-sm" />
            <input value={uploadPayload.mimeType} onChange={(e) => setUploadPayload((prev) => ({ ...prev, mimeType: e.target.value }))} placeholder={t('repository.uploadFields.mimeType')} className="rounded border px-3 py-2 text-sm" />
            <input value={uploadPayload.documentType} onChange={(e) => setUploadPayload((prev) => ({ ...prev, documentType: e.target.value }))} placeholder={t('repository.uploadFields.documentType')} className="rounded border px-3 py-2 text-sm" />
            <select value={uploadPayload.privacyLabel} onChange={(e) => setUploadPayload((prev) => ({ ...prev, privacyLabel: e.target.value }))} className="rounded border px-3 py-2 text-sm" required>
              <option value="public_internal">public_internal</option>
              <option value="team_confidential">team_confidential</option>
              <option value="lro_confidential">lro_confidential</option>
              <option value="privileged">privileged</option>
              <option value="case_restricted">case_restricted</option>
              <option value="highly_sensitive">highly_sensitive</option>
            </select>
            <input value={uploadPayload.contentHash} onChange={(e) => setUploadPayload((prev) => ({ ...prev, contentHash: e.target.value }))} placeholder={t('repository.uploadFields.contentHash')} className="rounded border px-3 py-2 text-sm" />
            <input value={uploadPayload.linkedEntityId} onChange={(e) => setUploadPayload((prev) => ({ ...prev, linkedEntityId: e.target.value }))} placeholder={t('repository.uploadFields.linkedEntityId')} className="rounded border px-3 py-2 text-sm md:col-span-2" />
            <Button onClick={() => void uploadDocument()} disabled={uploading || !uploadPayload.title || !uploadPayload.filename || !uploadPayload.fileUrl || !uploadPayload.privacyLabel}>
              {uploading ? t('repository.uploading') : t('repository.uploadGoverned')}
            </Button>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-3 text-sm font-medium">OCR Ingestion</div>
            {organizationId ? (
              <OCRUpload
                organizationId={organizationId}
                maxFiles={5}
                onUploadComplete={() => {
                  void loadRepository();
                }}
              />
            ) : (
              <p className="text-sm text-gray-600">Organization context is loading. OCR upload will be available shortly.</p>
            )}
          </div>

          <div className="space-y-2">
            {repoDocs.map((doc) => (
              <div key={String(doc.id)} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm">
                <button type="button" onClick={() => setSelectedDocumentId(String(doc.id))} className="font-medium text-left text-blue-700 hover:underline">
                  {String(doc.title ?? doc.name ?? doc.filename ?? doc.id)}
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{String(doc.documentType ?? t('repository.defaults.documentType'))}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{String(doc.privacyLabel ?? t('repository.defaults.privacyLabel'))}</span>
                <span className="text-xs text-gray-500">{String(doc.linkedEntityType ?? t('repository.defaults.unlinked'))}:{String(doc.linkedEntityId ?? '-')}</span>
                <Button variant="outline" size="sm" onClick={() => void openAuthorizedDownload(String(doc.id))} className="ml-auto">
                  {copy.download}
                </Button>
                <Button variant="outline" size="sm" disabled={versioning} onClick={() => void appendVersion(String(doc.id))}>
                  {t('repository.addVersion')}
                </Button>
              </div>
            ))}
            {repoDocs.length === 0 && !loading && (
              <p className="text-sm text-gray-500">{t('repository.empty')}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="library">
          <DocumentLibraryBrowser
            items={repositoryItems}
            onUpload={() => setActiveTab('repository')}
            onDownload={handleDownloadDocument}
            onPreview={handlePreviewDocument}
            onSelectionChange={setSelectedLibraryItems}
            selectionResetSignal={selectionResetSignal}
          />
        </TabsContent>

        <TabsContent value="search">
          <DocumentSearchAdvanced
            onSearch={handleSearch}
            suggestions={repositoryItems.slice(0, 5).map((item) => ({
              id: item.id,
              text: item.name,
              type: 'recent' as const,
            }))}
            savedSearches={savedSearches}
            onSaveSearch={handleSaveSearch}
            owners={availableUsers}
            tags={availableTags}
          />
        </TabsContent>

        <TabsContent value="templates">
          <DocumentTemplateManager
            templates={templateItems}
            categories={availableTags.map((tag) => ({ id: tag, name: tag, count: repoDocs.filter((doc) => doc.documentType === tag || doc.privacyLabel === tag).length }))}
            onUseTemplate={(template) => {
              setUploadPayload((prev) => ({
                ...prev,
                title: template.name,
                filename: template.name,
                documentType: template.category,
              }));
              setActiveTab('repository');
            }}
            onPreviewTemplate={(template) => handleOpenDocument(template.id)}
          />
        </TabsContent>

        <TabsContent value="retention">
          <DocumentRetentionPolicy
            legalHolds={null}
            unavailableNotice={copy.retention_unavailable}
            stats={{
              totalDocuments: repoDocs.length,
              documentsUnderRetention: null,
              documentsOnHold: null,
              scheduledForArchival: null,
              scheduledForDeletion: null,
            }}
            categories={availableTags}
          />
        </TabsContent>

        <TabsContent value="bulk">
          <DocumentBulkOperations
            selectedCount={selectedLibraryItems.length}
            onClearSelection={handleClearSelection}
            onBulkDownload={handleBulkDownload}
            onBulkShare={handleBulkShare}
            folders={[]}
            availableTags={availableTags}
          />
        </TabsContent>
      </Tabs>

      {/* Document Version Control Modal */}
      {selectedDocumentId && (
        <DocumentVersionControl
          document={{
            id: selectedDocumentId,
            name: selectedDocument?.title ?? selectedDocument?.name ?? t('versionControl.defaultDocumentName'),
            currentVersion: selectedDocumentVersions[0]?.versionNumber ?? 1,
            totalVersions: selectedDocumentVersions.length || 1,
          }}
          versions={selectedDocumentVersions}
          canDownload={(version) => version.isCurrent}
          onDownload={() => {
            void openAuthorizedDownload(selectedDocumentId);
          }}
        />
      )}
    </div>
  );
}
