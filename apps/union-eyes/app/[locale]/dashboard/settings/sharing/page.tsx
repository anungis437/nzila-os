"use client";


export const dynamic = 'force-dynamic';
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileText, Eye } from "lucide-react";
import SharingSettingsForm from "@/components/sharing/SharingSettingsForm";
import AccessLogViewer from "@/components/sharing/AccessLogViewer";

export default function SharingSettingsPage() {
  const t = useTranslations("sharingSettingsPage");
  const params = useParams();
  const organizationId = params?.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settings, setSettings] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/sharing-settings`);
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (_error) {
} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = (updatedSettings: unknown) => {
    setSettings(updatedSettings);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <FileText className="h-4 w-4" />
            {t("tabs.settings")}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Eye className="h-4 w-4" />
            {t("tabs.audit")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <SharingSettingsForm
            organizationId={organizationId}
            initialSettings={settings}
            onSave={handleSave}
          />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AccessLogViewer organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
