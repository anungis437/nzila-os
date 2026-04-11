/**
 * Trust Dashboard Page
 * 
 * Purpose: Transparency dashboard showing system integrity
 * Audience: CIOs, risk officers, union leadership, skeptical stakeholders
 * 
 * Shows:
 * - Immutability enforcement status
 * - RLS org isolation
 * - FSM validation
 * - Governance structure
 * - Audit log metrics
 * 
 * Exportable as PDF for investor/partnership discussions
 */


export const dynamic = 'force-dynamic';

import * as React from 'react';
import { Metadata } from 'next';
import { getTrustMetrics } from '@/lib/trust/system-metrics';
import { getTranslations } from 'next-intl/server';
import { SystemStatusGrid } from '@/components/marketing/system-status-badge';
import { HumanCenteredCallout, CalloutPresets } from '@/components/marketing/human-centered-callout';
import { Shield, Lock, GitBranch, Scale, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Trust Dashboard | UnionEyes',
  description:
    'Verify UnionEyes trust infrastructure: immutability enforcement, RLS isolation, FSM validation, and governance transparency.',
};

export default async function TrustPage() {
  const metrics = await getTrustMetrics();
  const t = await getTranslations('trust');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {t("title")}
              </h1>
              <p className="text-slate-600">
                {t("subtitle")}
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              {t("exportReport")}
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span>{t("lastUpdated")}:</span>
            <span className="font-medium text-slate-700">
              {metrics.lastUpdated.toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Philosophy Callout */}
        <CalloutPresets.TransparencyFirst />

        {/* Overview Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard
            icon={<Lock className="h-5 w-5" />}
            label={t("statImmutability")}
            value={metrics.immutability.status}
            status={metrics.immutability.status}
          />
          <StatCard
            icon={<Shield className="h-5 w-5" />}
            label={t("statRLS")}
            value={metrics.rlsEnforcement.orgIsolation}
            status={metrics.rlsEnforcement.status}
          />
          <StatCard
            icon={<GitBranch className="h-5 w-5" />}
            label={t("statFSM")}
            value={`${metrics.fsmValidation.complianceRate}%`}
            status={metrics.fsmValidation.status}
          />
          <StatCard
            icon={<Scale className="h-5 w-5" />}
            label={t("statGovernance")}
            value={metrics.governance.goldenShareActive ? t("yes") : t("no")}
            status={metrics.governance.status}
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label={t("statAuditEvents")}
            value={metrics.auditLog.eventsLogged.toLocaleString()}
            status={metrics.auditLog.status}
          />
        </div>

        {/* Detailed System Status */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {t("systemSafeguards")}
          </h2>
          <SystemStatusGrid
            systems={[
              {
                system: t("immutabilityTitle"),
                status: metrics.immutability.status,
                description: metrics.immutability.description,
                lastCheck: metrics.immutability.lastCheck,
                metadata: [
                  {
                    label: t("triggersActive"),
                    value: metrics.immutability.triggersActive ? t("yes") : t("no"),
                  },
                  {
                    label: t("tablesProtected"),
                    value: metrics.immutability.tablesProtected.length,
                  },
                  {
                    label: t("violationsBlocked"),
                    value: metrics.immutability.violationAttempts,
                  },
                  {
                    label: t("lastAudit"),
                    value: metrics.immutability.lastAudit.toLocaleDateString(),
                  },
                ],
                auditUrl: '#immutability',
              },
              {
                system: t("rlsTitle"),
                status: metrics.rlsEnforcement.status,
                description: metrics.rlsEnforcement.description,
                lastCheck: metrics.rlsEnforcement.lastCheck,
                metadata: [
                  {
                    label: t("policiesActive"),
                    value: metrics.rlsEnforcement.policiesActive,
                  },
                  {
                    label: t("orgIsolation"),
                    value: metrics.rlsEnforcement.orgIsolation,
                  },
                  {
                    label: t("tablesProtected"),
                    value: metrics.rlsEnforcement.tablesProtected.length,
                  },
                  {
                    label: t("lastCheck"),
                    value: metrics.rlsEnforcement.lastPolicyCheck.toLocaleDateString(),
                  },
                ],
                auditUrl: '#rls',
              },
              {
                system: t("fsmTitle"),
                status: metrics.fsmValidation.status,
                description: metrics.fsmValidation.description,
                lastCheck: metrics.fsmValidation.lastCheck,
                metadata: [
                  {
                    label: t("complianceRate"),
                    value: `${metrics.fsmValidation.complianceRate}%`,
                  },
                  {
                    label: t("invalidTransitionsBlocked"),
                    value: metrics.fsmValidation.invalidTransitionsBlocked,
                  },
                  {
                    label: t("lastValidation"),
                    value: metrics.fsmValidation.lastValidation.toLocaleDateString(),
                  },
                ],
                auditUrl: '#fsm',
              },
              {
                system: t("governanceTitle"),
                status: metrics.governance.status,
                description: metrics.governance.description,
                lastCheck: metrics.governance.lastCheck,
                metadata: [
                  {
                    label: t("goldenShare"),
                    value: metrics.governance.goldenShareActive ? t("yes") : t("no"),
                  },
                  {
                    label: t("shareHolder"),
                    value: metrics.governance.goldenShareHolder,
                  },
                  {
                    label: t("reservedMatters"),
                    value: metrics.governance.reservedMattersProtection,
                  },
                ],
                auditUrl: '#governance',
              },
            ]}
          />
        </div>

        {/* Audit Log Section */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">{t("auditTrail")}</h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-600 mb-2">{t("eventsLogged")}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.eventsLogged.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">{t("archivedEvents")}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.archivedEvents.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">{t("retentionPolicy")}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.retentionPolicy}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-600">
              {t("auditLogDescription")}
            </p>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {t("technicalImplementation")}
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="space-y-6">
              <Section
                id="immutability"
                title={t("immutabilityDescription")}
                description={t("immutabilityDetails")}
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>{t("updateTriggers")}</li>
                  <li>{t("deleteTriggers")}</li>
                  <li>{t("appliedTo")}: {metrics.immutability.tablesProtected.join(', ')}</li>
                  <li>{t("verified")}: {metrics.immutability.lastAudit.toLocaleDateString()}</li>
                </ul>
              </Section>

              <Section
                id="rls"
                title={t("rlsDescription")}
                description={t("rlsDetails")}
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>{t("activePolicies")}: {metrics.rlsEnforcement.policiesActive}</li>
                  <li>{t("orgIsolation")}: {metrics.rlsEnforcement.orgIsolation}</li>
                  <li>{t("tablesProtected")}: {metrics.rlsEnforcement.tablesProtected.join(', ')}</li>
                </ul>
              </Section>

              <Section
                id="fsm"
                title={t("fsmDescription")}
                description={t("fsmDetails")}
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>{t("complianceRate")}: {metrics.fsmValidation.complianceRate}%</li>
                  <li>{t("blockedTransitions")}: {metrics.fsmValidation.invalidTransitionsBlocked}</li>
                  <li>{t("roleBasedValidation")}</li>
                  <li>{t("slaEnforcement")}</li>
                </ul>
              </Section>

              <Section
                id="governance"
                title={t("governanceDescription")}
                description={t("governanceDetails")}
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>
                    {t("goldenShareHolder")}: {metrics.governance.goldenShareHolder}
                  </li>
                  <li>
                    {t("reservedMattersProtection")}: {metrics.governance.reservedMattersProtection}
                  </li>
                  {metrics.governance.lastElectionDate && (
                    <li>
                      {t("lastElection")}: {metrics.governance.lastElectionDate.toLocaleDateString()}
                    </li>
                  )}
                  <li>{t("classVotingRights")}</li>
                </ul>
              </Section>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-12">
          <HumanCenteredCallout
            variant="trust"
            title={t("securityQuestion")}
            description={t("securityDescriptionContact")}
          >
            <Button variant="outline" className="mt-2">
              {t("contactSecurityTeam")}
            </Button>
          </HumanCenteredCallout>
        </div>
      </main>
    </div>
  );
}

/**
 * Helper Components
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: string;
}

function StatCard({ icon, label, value, status }: StatCardProps) {
  const statusColor =
    status === 'active'
      ? 'text-emerald-600 bg-emerald-50'
      : status === 'degraded'
      ? 'text-amber-600 bg-amber-50'
      : 'text-slate-600 bg-slate-50';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg ${statusColor} mb-2`}>
        {icon}
      </div>
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

interface SectionProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ id, title, description, children }: SectionProps) {
  return (
    <div id={id} className="scroll-mt-20">
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 mb-3">{description}</p>
      {children}
    </div>
  );
}
