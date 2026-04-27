"use client";

export const dynamic = 'force-dynamic';

/**
 * Document Management Page
 * 
 * Comprehensive document management interface integrating:
 * - Document library browser
 * - Version control
 * - Approval workflows
 * - Template manager
 * - Search and bulk operations
 * - Retention policy management
 * 
 * @page app/[locale]/documents/page.tsx
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Shield } from "lucide-react";
import { DocumentLibraryBrowser } from "@/components/documents/document-library-browser";
import { DocumentVersionControl } from "@/components/documents/document-version-control";
import { DocumentApprovalWorkflow } from "@/components/documents/document-approval-workflow";
import { DocumentTemplateManager } from "@/components/documents/document-template-manager";
import { DocumentSearchAdvanced } from "@/components/documents/document-search-advanced";
import { DocumentBulkOperations } from "@/components/documents/document-bulk-operations";
import { DocumentRetentionPolicy } from "@/components/documents/document-retention-policy";

export default function DocumentsPage() {
  const t = useTranslations("documentsPage");
  const [activeTab, setActiveTab] = React.useState("library");
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [repoDocs, setRepoDocs] = React.useState<Array<Record<string, unknown>>>([]);
  const [query, setQuery] = React.useState('');
  const [label, setLabel] = React.useState('');
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

  const loadRepository = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('keyword', query);
      if (label) params.set('label', label);
      const res = await fetch(`/api/documents/repository?${params.toString()}`);
      const json = await res.json();
      setRepoDocs(Array.isArray(json?.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, [query, label]);

  React.useEffect(() => {
    void loadRepository();
  }, [loadRepository]);

  const uploadDocument = async () => {
    setUploading(true);
    try {
      const payload = {
        ...uploadPayload,
        contentHash: uploadPayload.contentHash || `manual:${Date.now()}`,
        linkedEntityType: uploadPayload.linkedEntityId ? uploadPayload.linkedEntityType : undefined,
        linkedEntityId: uploadPayload.linkedEntityId || undefined,
      };

      await fetch('/api/documents/repository', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

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
      await loadRepository();
    } finally {
      setUploading(false);
    }
  };

  const appendVersion = async (documentId: string) => {
    const fileUrl = window.prompt(t('prompts.versionFileUrl'));
    const contentHash = window.prompt(t('prompts.versionContentHash'));
    if (!fileUrl || !contentHash) {
      return;
    }

    setVersioning(true);
    try {
      await fetch(`/api/documents/repository/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, contentHash }),
      });
      await loadRepository();
    } finally {
      setVersioning(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
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
          <TabsTrigger value="approvals">{t('tabs.approvals')}</TabsTrigger>
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
            <Button variant="outline" onClick={() => void loadRepository()} disabled={loading}>
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

          <div className="space-y-2">
            {repoDocs.map((doc) => (
              <div key={String(doc.id)} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm">
                <button type="button" onClick={() => setSelectedDocumentId(String(doc.id))} className="font-medium text-left text-blue-700 hover:underline">
                  {String(doc.title ?? doc.name ?? doc.filename ?? doc.id)}
                </button>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{String(doc.documentType ?? t('repository.defaults.documentType'))}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{String(doc.privacyLabel ?? t('repository.defaults.privacyLabel'))}</span>
                <span className="text-xs text-gray-500">{String(doc.linkedEntityType ?? t('repository.defaults.unlinked'))}:{String(doc.linkedEntityId ?? '-')}</span>
                <Button variant="outline" size="sm" disabled={versioning} onClick={() => void appendVersion(String(doc.id))} className="ml-auto">
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
            items={[]}
            onNavigate={(_folderId) => undefined}
            onUpload={() => undefined}
          />
        </TabsContent>

        <TabsContent value="search">
          <DocumentSearchAdvanced
            onSearch={(_filters) => undefined}
          />
        </TabsContent>

        <TabsContent value="templates">
          <DocumentTemplateManager
            templates={[]}
            categories={[]}
          />
        </TabsContent>

        <TabsContent value="approvals">
          <DocumentApprovalWorkflow
            documentId=""
            documentName={t('approvals.documentName')}
            reviewers={[]}
          />
        </TabsContent>

        <TabsContent value="retention">
          <DocumentRetentionPolicy
            legalHolds={[]}
            stats={{
              totalDocuments: 0,
              documentsUnderRetention: 0,
              documentsOnHold: 0,
              scheduledForArchival: 0,
              scheduledForDeletion: 0,
            }}
            categories={[]}
          />
        </TabsContent>

        <TabsContent value="bulk">
          <DocumentBulkOperations
            selectedCount={0}
            onClearSelection={() => undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Document Version Control Modal - fetch document data by ID here */}
      {selectedDocumentId && (
        <DocumentVersionControl
          document={{
            id: selectedDocumentId,
            name: t('versionControl.defaultDocumentName'),
            currentVersion: 1,
            totalVersions: 1,
          }}
          versions={[]}
        />
      )}
    </div>
  );
}
