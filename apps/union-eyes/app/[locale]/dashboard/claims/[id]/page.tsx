'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, MapPin, FileText, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/file-upload';
import { Button } from '@/components/ui/button';
import { ClaimJurisdictionInfo } from '@/components/claims/claim-jurisdiction-info';
import { usePilotTracking } from '@/lib/hooks/use-pilot-tracking';
import Link from 'next/link';

interface Claim {
  claimId: string;
  claimNumber: string;
  organizationId: string;
  memberId: string;
  isAnonymous: boolean;
  claimType: string;
  status: string;
  priority: string;
  incidentDate: string;
  location: string;
  description: string;
  desiredOutcome: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attachments: unknown[];
  witnessesPresent: boolean;
  witnessDetails: string | null;
  filedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ClaimDetailPage() {
  const t = useTranslations();
  const locale = useLocale();
  
  const statusLabels: Record<string, { label: string; color: string }> = {
    submitted: { label: t('claimStatus.submitted'), color: 'bg-blue-100 text-blue-800' },
    under_review: { label: t('claimStatus.underReview'), color: 'bg-yellow-100 text-yellow-800' },
    assigned: { label: t('claimStatus.assigned'), color: 'bg-purple-100 text-purple-800' },
    investigation: { label: t('claimStatus.investigation'), color: 'bg-orange-100 text-orange-800' },
    pending_documentation: { label: t('claimStatus.pendingDocs'), color: 'bg-amber-100 text-amber-800' },
    resolved: { label: t('status.resolved'), color: 'bg-green-100 text-green-800' },
    rejected: { label: t('status.rejected'), color: 'bg-red-100 text-red-800' },
    closed: { label: t('claimStatus.closed'), color: 'bg-gray-100 text-gray-800' },
  };

  const priorityLabels: Record<string, { label: string; color: string }> = {
    low: { label: t('priority.low'), color: 'bg-gray-100 text-gray-700' },
    medium: { label: t('priority.medium'), color: 'bg-blue-100 text-blue-700' },
    high: { label: t('priority.high'), color: 'bg-orange-100 text-orange-700' },
    critical: { label: t('priority.urgent'), color: 'bg-red-100 text-red-700' },
  };

  const claimTypeLabels: Record<string, string> = {
    grievance_discipline: t('claimTypes.grievanceDiscipline'),
    grievance_schedule: t('claimTypes.grievanceSchedule'),
    grievance_pay: t('claimTypes.grievancePay'),
    workplace_safety: t('claimTypes.workplaceSafety'),
    discrimination_age: t('claimTypes.discriminationAge'),
    discrimination_gender: t('claimTypes.discriminationGender'),
    discrimination_race: t('claimTypes.discriminationRace'),
    discrimination_disability: t('claimTypes.discriminationDisability'),
    harassment_verbal: t('claimTypes.harassmentVerbal'),
    harassment_physical: t('claimTypes.harassmentPhysical'),
    harassment_sexual: t('claimTypes.harassmentSexual'),
    contract_dispute: t('claimTypes.contractDispute'),
    retaliation: t('claimTypes.retaliation'),
    other: t('claimTypes.other'),
  };
  const params = useParams();
  const _router = useRouter();
  const claimId = params.id as string;
  const { trackCaseViewed } = usePilotTracking();
  
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchClaim = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/claims/${claimId}`);
        
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message || `HTTP ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        // withApi wraps in { success, data: { data: row }, timestamp }
        const claimData = data?.data?.data ?? data?.data ?? data?.claim ?? data;
        setClaim(claimData);
        trackCaseViewed(claimData?.claimId ?? claimId);
        
        // Fetch workflow history
        try {
          const historyResponse = await fetch(`/api/claims/${claimData?.claimId ?? claimId}/workflow/history`);
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setWorkflowHistory(historyData.history || []);
          }
        } catch (_histErr) {
}
      } catch (err) {
setError(err instanceof Error ? err.message : 'Failed to load claim');
      } finally {
        setLoading(false);
      }
    };

    if (claimId) {
      fetchClaim();
    }
  }, [claimId, trackCaseViewed]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUploadComplete = (attachment: unknown) => {
    // Refresh claim data to show new attachment
    if (claim) {
      setClaim({
        ...claim,
        attachments: [...(claim.attachments || []), attachment],
      });
    }
  };

  const handleDeleteComplete = (url: string) => {
    // Update claim data to remove deleted attachment
    if (claim) {
      setClaim({
        ...claim,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attachments: (claim.attachments || []).filter((a: unknown) => a.url !== url),
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('claims.loadingDetails')}</p>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('errors.loadingError')}</h2>
            <p className="text-gray-600 mb-4">{error || t('claims.notFound')}</p>
            <Link href={`/${locale}/dashboard/inbox?type=intake`}>
              <Button>{t('claims.backToClaims')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = statusLabels[claim.status] || { label: claim.status, color: 'bg-gray-100 text-gray-800' };
  const priorityInfo = priorityLabels[claim.priority] || { label: claim.priority, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href={`/${locale}/dashboard/inbox?type=intake`}>
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
              <ArrowLeft size={20} />
              {t('claims.backToClaims')}
            </button>
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{claim.claimNumber}</h1>
              <p className="text-gray-600">{claimTypeLabels[claim.claimType] || claim.claimType}</p>
            </div>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityInfo.color}`}>
                {priorityInfo.label}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Claim Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText size={20} className="text-blue-600" />
                    {t('claims.claimDetails')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('claims.incidentDescription')}</label>
                    <p className="text-gray-900 mt-1">{claim.description}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">{t('claims.desiredOutcome')}</label>
                    <p className="text-gray-900 mt-1">{claim.desiredOutcome}</p>
                  </div>

                  {claim.witnessesPresent && claim.witnessDetails && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">{t('claims.witnesses')}</label>
                      <p className="text-gray-900 mt-1">{claim.witnessDetails}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* File Attachments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>{t('claims.attachments')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload
                    claimId={claim.claimId}
                    existingAttachments={claim.attachments || []}
                    onUploadComplete={handleUploadComplete}
                    onDeleteComplete={handleDeleteComplete}
                    maxFiles={10}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Jurisdiction & Deadline Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <ClaimJurisdictionInfo
                claimId={claim.claimId}
                organizationId={claim.organizationId}
                claimType={claim.claimType}
                status={claim.status}
                filedDate={claim.filedDate}
              />
            </motion.div>

            {/* Workflow History */}
            {workflowHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('claims.statusHistory')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {workflowHistory.map((update: unknown, index: number) => (
                        <div key={update.id || index} className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {statusLabels[update.newStatus]?.label || update.newStatus}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(update.changedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {update.previousStatus && (
                            <p className="text-xs text-gray-500 mb-1">
                              {t('claims.from')}: {statusLabels[update.previousStatus]?.label || update.previousStatus}
                            </p>
                          )}
                          {update.notes && (
                            <p className="text-sm text-gray-600 mt-1">{update.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}



            {/* Incident Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('claims.incidentInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">{t('claims.incidentDate')}</p>
                      <p className="text-gray-900">{new Date(claim.incidentDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">{t('claims.location')}</p>
                      <p className="text-gray-900">{claim.location}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">{t('claims.submittedBy')}</p>
                      <p className="text-gray-900">{new Date(claim.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock size={18} className="text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">{t('claims.lastUpdated')}</p>
                      <p className="text-gray-900">{new Date(claim.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>


          </div>
        </div>
      </div>
    </div>
  );
}
