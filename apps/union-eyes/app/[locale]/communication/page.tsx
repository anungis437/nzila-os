"use client";

export const dynamic = 'force-dynamic';

/**
 * Communication Center Page
 * 
 * Communication hub integrating:
 * - Announcement composer
 * - Email template builder
 * - SMS campaign manager
 * - Communication analytics
 * 
 * @page app/[locale]/communication/page.tsx
 */

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AnnouncementComposer } from "@/components/communication/announcement-composer";
import { EmailTemplateBuilder } from "@/components/communication/email-template-builder";
import { SMSCampaignManager } from "@/components/communication/sms-campaign-manager";
import { CommunicationAnalytics } from "@/components/communication/communication-analytics";

export default function CommunicationPage() {
  const [showAnnouncementComposer, setShowAnnouncementComposer] = React.useState(false);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communication Center</h1>
          <p className="text-gray-600 mt-2">
            Send announcements, manage campaigns, and track engagement
          </p>
        </div>
        <Button onClick={() => setShowAnnouncementComposer(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      <Tabs defaultValue="announcements">
        <TabsList>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="sms">SMS Campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="announcements">
          <div className="space-y-4">
            {/* Recent announcements list would be here */}
            <p className="text-gray-600">
              Recent announcements will appear here. Create a new announcement to get started.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <EmailTemplateBuilder
            onSave={async (_template) => {
}}
          />
        </TabsContent>

        <TabsContent value="sms">
          <SMSCampaignManager
            departments={[]}
            roles={[]}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <CommunicationAnalytics
            metrics={{
              period: "Last 30 days",
              email: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                bounced: 0,
                unsubscribed: 0,
              },
              sms: {
                sent: 0,
                delivered: 0,
                clicked: 0,
                failed: 0,
                optOuts: 0,
              },
              push: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
              },
              inApp: {
                shown: 0,
                viewed: 0,
                clicked: 0,
              },
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Announcement Composer Modal */}
      {showAnnouncementComposer && (
        <AnnouncementComposer
          departments={[]}
          roles={[]}
          onPublish={async (_announcement) => {
setShowAnnouncementComposer(false);
          }}
          onCancel={() => setShowAnnouncementComposer(false)}
        />
      )}
    </div>
  );
}
