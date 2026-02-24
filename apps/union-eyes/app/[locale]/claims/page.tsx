"use client";

export const dynamic = 'force-dynamic';

/**
 * Claims Management Page
 * 
 * Comprehensive claims management interface integrating:
 * - Claim list table with advanced filtering
 * - Claim detail view with status timeline
 * - Claim form wizard for submission
 * - Document upload and evidence gallery
 * - Appeals processing
 * 
 * @page app/[locale]/claims/page.tsx
 */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ClaimListTable } from "@/components/claims/claim-list-table";
import { ClaimFormWizard } from "@/components/claims/claim-form-wizard";
import { ClaimDetailViewEnhanced } from "@/components/claims/claim-detail-view-enhanced";

export default function ClaimsPage() {
  const [activeTab, setActiveTab] = React.useState<"list" | "submit">("list");
  const [selectedClaimId, setSelectedClaimId] = React.useState<string | null>(null);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claims Management</h1>
          <p className="text-gray-600 mt-2">
            Submit, track, and manage your claims and grievances
          </p>
        </div>
        <Button onClick={() => setActiveTab("submit")}>
          <Plus className="h-4 w-4 mr-2" />
          Submit New Claim
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "list" | "submit")}>
        <TabsList>
          <TabsTrigger value="list">My Claims</TabsTrigger>
          <TabsTrigger value="submit">Submit Claim</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <ClaimListTable
            data={[]}
            onView={(claim) => setSelectedClaimId(claim.claimId)}
          />
        </TabsContent>

        <TabsContent value="submit">
          <ClaimFormWizard
            memberId="current-member-id"
            organizationId="current-organization-id"
            onSubmit={async (_data) => {
// Handle claim submission
              setActiveTab("list");
            }}
            onCancel={() => setActiveTab("list")}
          />
        </TabsContent>
      </Tabs>

      {/* Claim Detail Modal/Drawer - fetch claim data by ID here */}
      {selectedClaimId && (
        <ClaimDetailViewEnhanced
          claim={{
            claimId: selectedClaimId,
            claimNumber: "CLM-001",
            memberName: "Loading...",
            memberEmail: "",
            claimType: "grievance",
            status: "pending",
            priority: "medium",
            incidentDate: new Date(),
            location: "",
            description: "",
            desiredOutcome: "",
            witnessesPresent: false,
            previouslyReported: false,
            attachments: [],
            activity: [],
            comments: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          }}
          onStatusChange={(_status) => undefined}
        />
      )}
    </div>
  );
}
