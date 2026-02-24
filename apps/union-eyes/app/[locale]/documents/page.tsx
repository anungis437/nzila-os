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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { DocumentLibraryBrowser } from "@/components/documents/document-library-browser";
import { DocumentVersionControl } from "@/components/documents/document-version-control";
import { DocumentApprovalWorkflow } from "@/components/documents/document-approval-workflow";
import { DocumentTemplateManager } from "@/components/documents/document-template-manager";
import { DocumentSearchAdvanced } from "@/components/documents/document-search-advanced";
import { DocumentBulkOperations } from "@/components/documents/document-bulk-operations";
import { DocumentRetentionPolicy } from "@/components/documents/document-retention-policy";

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = React.useState("library");
  const [selectedDocumentId, _setSelectedDocumentId] = React.useState<string | null>(null);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-gray-600 mt-2">
            Organize, share, and collaborate on documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("bulk")}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="library">Document Library</TabsTrigger>
          <TabsTrigger value="search">Advanced Search</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
        </TabsList>

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
            documentName="Approval Workflow"
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
            name: "Document.pdf",
            currentVersion: 1,
            totalVersions: 1,
          }}
          versions={[]}
        />
      )}
    </div>
  );
}
