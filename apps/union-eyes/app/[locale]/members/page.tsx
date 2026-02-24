"use client";

export const dynamic = 'force-dynamic';

/**
 * Member Management Page
 * 
 * Comprehensive member management interface integrating:
 * - Member list table with advanced search
 * - Member profile cards and details
 * - Member onboarding wizard
 * - Bulk operations (import, export, merge)
 * - Engagement dashboard
 * 
 * @page app/[locale]/members/page.tsx
 */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { MemberListTableAdvanced } from "@/components/members/member-list-table-advanced";
import { MemberOnboardingWizard } from "@/components/members/member-onboarding-wizard";
import { MemberEngagementDashboard } from "@/components/members/member-engagement-dashboard";
import { BulkMemberOperations } from "@/components/members/bulk-member-operations";

export default function MembersPage() {
  const [activeTab, setActiveTab] = React.useState<"list" | "onboard" | "engagement" | "bulk">("list");

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Member Management</h1>
          <p className="text-gray-600 mt-2">
            Manage membership, onboarding, and member engagement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab("bulk")}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Operations
          </Button>
          <Button onClick={() => setActiveTab("onboard")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="list">All Members</TabsTrigger>
          <TabsTrigger value="onboard">Onboard Member</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <MemberListTableAdvanced
            members={[]}
            onView={(_member) => {
              // Navigate to member detail page
}}
          />
        </TabsContent>

        <TabsContent value="onboard">
          <MemberOnboardingWizard
            onComplete={async (_data) => {
setActiveTab("list");
            }}
            onCancel={() => setActiveTab("list")}
          />
        </TabsContent>

        <TabsContent value="engagement">
          <MemberEngagementDashboard
            memberId="current-member-id"
            memberName="Member Name"
            metrics={{
              score: 0,
              trend: "stable",
              eventsAttended: 0,
              totalEvents: 0,
              claimsSubmitted: 0,
              messagesReceived: 0,
              messagesOpened: 0,
              meetingsAttended: 0,
              totalMeetings: 0,
            }}
            activityData={[]}
          />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkMemberOperations
            selectedMemberIds={[]}
            onOperationComplete={(_operation, _results) => {
setActiveTab("list");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
