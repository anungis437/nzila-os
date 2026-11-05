"use client";

import { useLocale, useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { CapabilityUnavailable } from "@/components/system/capability-unavailable";

export const dynamic = 'force-dynamic';

// Sharing settings and the cross-organization access log have no canonical model yet: both routes answer 501
// (GOVERNED_SHARING_SETTINGS_NOT_IMPLEMENTED, CROSS_ORG_ACCESS_LOG_NOT_IMPLEMENTED), so this page asks for neither and offers no form.
const COPY = {
  en: "Sharing settings and the access log cannot be viewed or changed in this release.",
  fr: "Les paramètres de partage et le journal d’accès ne peuvent être ni consultés ni modifiés dans cette version.",
} as const;

export default function SharingSettingsPage() {
  const t = useTranslations("sharingSettingsPage");
  const locale = useLocale();

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>
      </div>

      <CapabilityUnavailable locale={locale} capability="UE-ORG-SHARING-SETTINGS" />
      <p className="text-sm text-muted-foreground">
        {locale.toLowerCase().startsWith("fr") ? COPY.fr : COPY.en}
      </p>
    </div>
  );
}
