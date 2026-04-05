"use client";

import * as React from "react";
import { useUser } from '@nzila/platform-auth/entra/client';
import { PrivacyConsentManager, ConsentPurpose, ConsentRecord } from "@/components/compliance/privacy-consent-manager";
import { GdprDataExport, ExportJob } from "@/components/compliance/gdpr-data-export";
import { useOrganizationId } from "@/contexts/organization-context";

interface ConsentsResponse {
  purposes: ConsentPurpose[];
  consents: Array<{
    id: string;
    consentType: string;
    status: "granted" | "denied" | "withdrawn" | "expired";
    grantedAt?: string | Date | null;
    withdrawnAt?: string | Date | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }>;
}

interface RequestsResponse {
  requests: Array<{
    id: string;
    status: "pending" | "in_progress" | "completed" | "rejected" | "cancelled";
    requestDetails?: {
      preferredFormat?: "json" | "csv" | "xml";
      dataCategories?: string[];
    };
    requestedAt?: string | Date | null;
    completedAt?: string | Date | null;
    responseData?: {
      fileUrl?: string;
      expiresAt?: string;
    };
  }>;
}

export function PrivacySettingsPanel() {
  const { user } = useUser();
  const organizationId = useOrganizationId();
  const [purposes, setPurposes] = React.useState<ConsentPurpose[]>([]);
  const [consents, setConsents] = React.useState<ConsentRecord[]>([]);
  const [exportHistory, setExportHistory] = React.useState<ExportJob[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const memberId = user?.id || "";
  const memberName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Member";

  const refreshConsents = React.useCallback(async () => {
    if (!organizationId) return;

    const response = await fetch(
      `/api/gdpr/consents?organizationId=${encodeURIComponent(organizationId)}`
    );

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as ConsentsResponse;
    const mappedConsents = data.consents
      .map<ConsentRecord>((record) => {
        const purpose = data.purposes.find((p) => p.id === record.consentType);
        const granted = record.status === "granted";
        return {
          id: record.id,
          purposeId: record.consentType,
          purposeName: purpose?.name || record.consentType,
          granted,
          grantedAt: record.grantedAt ? new Date(record.grantedAt) : undefined,
          withdrawnAt: record.withdrawnAt ? new Date(record.withdrawnAt) : undefined,
          ipAddress: record.ipAddress || undefined,
          userAgent: record.userAgent || undefined,
          method: "explicit",
        };
      })
      .sort((a, b) => {
        const dateA = a.withdrawnAt || a.grantedAt;
        const dateB = b.withdrawnAt || b.grantedAt;
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });

    setPurposes(data.purposes);
    setConsents(mappedConsents);
  }, [organizationId]);

  const refreshExports = React.useCallback(async () => {
    if (!organizationId) return;

    const response = await fetch(
      `/api/gdpr/requests?organizationId=${encodeURIComponent(organizationId)}&type=access`
    );

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as RequestsResponse;

    const mapped = data.requests.map((request) => {
      const status = request.status === "in_progress"
        ? "processing"
        : request.status === "completed"
        ? "completed"
        : request.status === "pending"
        ? "pending"
        : "failed";

      return {
        id: request.id,
        memberId,
        memberName,
        status,
        format: request.requestDetails?.preferredFormat || "json",
        requestedAt: request.requestedAt ? new Date(request.requestedAt) : new Date(),
        completedAt: request.completedAt ? new Date(request.completedAt) : undefined,
        downloadUrl: request.responseData?.fileUrl,
        expiresAt: request.responseData?.expiresAt
          ? new Date(request.responseData.expiresAt)
          : undefined,
        dataCategories: request.requestDetails?.dataCategories || [],
      } as ExportJob;
    });

    setExportHistory(mapped);
  }, [organizationId, memberId, memberName]);

  React.useEffect(() => {
    if (!organizationId || !memberId) return;

    setIsLoading(true);

    Promise.all([refreshConsents(), refreshExports()])
      .finally(() => setIsLoading(false));
  }, [organizationId, memberId, refreshConsents, refreshExports]);

  const handleUpdateConsent = React.useCallback(
    async (purposeId: string, granted: boolean) => {
      if (!organizationId) return;

      await fetch("/api/gdpr/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          consentType: purposeId,
          granted,
        }),
      });

      await refreshConsents();
    },
    [organizationId, refreshConsents]
  );

  const handleWithdrawAll = React.useCallback(async () => {
    const optionalPurposes = purposes.filter((p) => !p.required);

    for (const purpose of optionalPurposes) {
      await handleUpdateConsent(purpose.id, false);
    }
  }, [handleUpdateConsent, purposes]);

  const handleRequestExport = React.useCallback(
    async (request: {
      format: "json" | "csv" | "xml";
      includeProfile: boolean;
      includeClaims: boolean;
      includeDocuments: boolean;
      includeMessages: boolean;
      includePayments: boolean;
      includeVotingHistory: boolean;
      includeAuditLogs: boolean;
    }) => {
      if (!organizationId) return;

      await fetch("/api/gdpr/data-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          preferredFormat: request.format,
          requestDetails: {
            dataCategories: Object.entries(request)
              .filter(([key, value]) => key.startsWith("include") && value)
              .map(([key]) => key.replace("include", "").toLowerCase()),
          },
        }),
      });

      await refreshExports();
    },
    [organizationId, refreshExports]
  );

  const handleDownload = React.useCallback((jobId: string) => {
    const job = exportHistory.find((entry) => entry.id === jobId);
    if (job?.downloadUrl) {
      window.location.assign(job.downloadUrl);
    }
  }, [exportHistory]);

  if (!memberId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PrivacyConsentManager
        memberId={memberId}
        purposes={purposes}
        consents={consents}
        onUpdateConsent={handleUpdateConsent}
        onWithdrawAll={handleWithdrawAll}
        onExportConsents={refreshConsents}
      />
      <GdprDataExport
        memberId={memberId}
        memberName={memberName}
        exportHistory={exportHistory}
        onRequestExport={handleRequestExport}
        onDownload={handleDownload}
      />
      {isLoading && (
        <p className="text-sm text-gray-500">Loading privacy settings...</p>
      )}
    </div>
  );
}
