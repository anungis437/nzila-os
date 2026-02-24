/**
 * Trust Dashboard Page
 * 
 * Purpose: Transparency dashboard showing system integrity
 * Audience: CIOs, risk officers, union leadership, skeptical stakeholders
 * 
 * Shows:
 * - Immutability enforcement status
 * - RLS tenant isolation
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
import { SystemStatusGrid } from '@/components/marketing/system-status-badge';
import { HumanCenteredCallout, CalloutPresets } from '@/components/marketing/human-centered-callout';
import { Shield, Lock, GitBranch, Scale, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Trust Dashboard | Union Eyes',
  description:
    'Verify Union Eyes trust infrastructure: immutability enforcement, RLS isolation, FSM validation, and governance transparency.',
};

export default async function TrustPage() {
  const metrics = await getTrustMetrics();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Trust Infrastructure Dashboard
              </h1>
              <p className="text-slate-600">
                Real-time verification of Union Eyes security and governance safeguards
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span>Last updated:</span>
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
            label="Immutability"
            value={metrics.immutability.status}
            status={metrics.immutability.status}
          />
          <StatCard
            icon={<Shield className="h-5 w-5" />}
            label="RLS Isolation"
            value={metrics.rlsEnforcement.tenantIsolation}
            status={metrics.rlsEnforcement.status}
          />
          <StatCard
            icon={<GitBranch className="h-5 w-5" />}
            label="FSM Compliance"
            value={`${metrics.fsmValidation.complianceRate}%`}
            status={metrics.fsmValidation.status}
          />
          <StatCard
            icon={<Scale className="h-5 w-5" />}
            label="Governance"
            value={metrics.governance.goldenShareActive ? 'Active' : 'Inactive'}
            status={metrics.governance.status}
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            label="Audit Events (30d)"
            value={metrics.auditLog.eventsLogged.toLocaleString()}
            status={metrics.auditLog.status}
          />
        </div>

        {/* Detailed System Status */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            System Safeguards
          </h2>
          <SystemStatusGrid
            systems={[
              {
                system: 'Immutability Enforcement',
                status: metrics.immutability.status,
                description: metrics.immutability.description,
                lastCheck: metrics.immutability.lastCheck,
                metadata: [
                  {
                    label: 'Triggers Active',
                    value: metrics.immutability.triggersActive ? 'Yes' : 'No',
                  },
                  {
                    label: 'Tables Protected',
                    value: metrics.immutability.tablesProtected.length,
                  },
                  {
                    label: 'Violations Blocked',
                    value: metrics.immutability.violationAttempts,
                  },
                  {
                    label: 'Last Audit',
                    value: metrics.immutability.lastAudit.toLocaleDateString(),
                  },
                ],
                auditUrl: '#immutability',
              },
              {
                system: 'RLS (Row-Level Security)',
                status: metrics.rlsEnforcement.status,
                description: metrics.rlsEnforcement.description,
                lastCheck: metrics.rlsEnforcement.lastCheck,
                metadata: [
                  {
                    label: 'Policies Active',
                    value: metrics.rlsEnforcement.policiesActive,
                  },
                  {
                    label: 'Tenant Isolation',
                    value: metrics.rlsEnforcement.tenantIsolation,
                  },
                  {
                    label: 'Tables Protected',
                    value: metrics.rlsEnforcement.tablesProtected.length,
                  },
                  {
                    label: 'Last Check',
                    value: metrics.rlsEnforcement.lastPolicyCheck.toLocaleDateString(),
                  },
                ],
                auditUrl: '#rls',
              },
              {
                system: 'FSM (Finite State Machine)',
                status: metrics.fsmValidation.status,
                description: metrics.fsmValidation.description,
                lastCheck: metrics.fsmValidation.lastCheck,
                metadata: [
                  {
                    label: 'Compliance Rate',
                    value: `${metrics.fsmValidation.complianceRate}%`,
                  },
                  {
                    label: 'Invalid Transitions Blocked',
                    value: metrics.fsmValidation.invalidTransitionsBlocked,
                  },
                  {
                    label: 'Last Validation',
                    value: metrics.fsmValidation.lastValidation.toLocaleDateString(),
                  },
                ],
                auditUrl: '#fsm',
              },
              {
                system: 'Governance Structure',
                status: metrics.governance.status,
                description: metrics.governance.description,
                lastCheck: metrics.governance.lastCheck,
                metadata: [
                  {
                    label: 'Golden Share',
                    value: metrics.governance.goldenShareActive ? 'Active' : 'Inactive',
                  },
                  {
                    label: 'Share Holder',
                    value: metrics.governance.goldenShareHolder,
                  },
                  {
                    label: 'Reserved Matters',
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
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Audit Trail</h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-600 mb-2">Events Logged (30 days)</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.eventsLogged.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Archived Events</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.archivedEvents.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Retention Policy</p>
                <p className="text-3xl font-bold text-slate-900">
                  {metrics.auditLog.retentionPolicy}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-600">
              All system actions are logged immutably. Audit logs cannot be modified or
              deleted, only archived after the retention period.
            </p>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Technical Implementation
          </h2>
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <div className="space-y-6">
              <Section
                id="immutability"
                title="Immutability Enforcement (Migration 0064)"
                description="Database-level triggers prevent modification of historical records. Once written, data cannot be altered or deleted."
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>UPDATE triggers reject all modification attempts</li>
                  <li>DELETE triggers prevent data removal</li>
                  <li>Applied to: {metrics.immutability.tablesProtected.join(', ')}</li>
                  <li>Verified: {metrics.immutability.lastAudit.toLocaleDateString()}</li>
                </ul>
              </Section>

              <Section
                id="rls"
                title="Row-Level Security (RLS)"
                description="PostgreSQL RLS policies ensure complete tenant data isolation. Organizations cannot access each other's data."
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>Active policies: {metrics.rlsEnforcement.policiesActive}</li>
                  <li>Tenant isolation: {metrics.rlsEnforcement.tenantIsolation}</li>
                  <li>Protected tables: {metrics.rlsEnforcement.tablesProtected.join(', ')}</li>
                </ul>
              </Section>

              <Section
                id="fsm"
                title="Finite State Machine Validation"
                description="State transition rules enforced at application layer. Invalid transitions are blocked before database operations."
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>Compliance rate: {metrics.fsmValidation.complianceRate}%</li>
                  <li>Blocked transitions: {metrics.fsmValidation.invalidTransitionsBlocked}</li>
                  <li>Role-based transition validation</li>
                  <li>SLA enforcement integration</li>
                </ul>
              </Section>

              <Section
                id="governance"
                title="Democratic Governance"
                description="Golden share structure ensures union control over mission-critical decisions."
              >
                <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                  <li>
                    Golden share holder: {metrics.governance.goldenShareHolder}
                  </li>
                  <li>
                    Reserved matters protection: {metrics.governance.reservedMattersProtection}
                  </li>
                  {metrics.governance.lastElectionDate && (
                    <li>
                      Last election: {metrics.governance.lastElectionDate.toLocaleDateString()}
                    </li>
                  )}
                  <li>Class B voting rights on strategic decisions</li>
                </ul>
              </Section>
            </div>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-12">
          <HumanCenteredCallout
            variant="trust"
            title="Questions about our security?"
            description="We&apos;re committed to transparency. If you have questions about any of these safeguards or want to discuss Union Eyes security in depth, reach out to our team."
          >
            <Button variant="outline" className="mt-2">
              Contact Security Team
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
