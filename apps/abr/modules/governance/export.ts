import type { AbrRole } from '@/lib/rbac';
import type { AbrDataMode } from '@/lib/data-mode';
import {
  getExecutiveInsightWidgets,
  listImportJobs,
  listManualReviewQueue,
  listSourceRegistry,
} from '@/modules/intelligence/service';
import {
  getDashboardSummary,
  getIncidentDetail,
  listIncidents,
} from '@/modules/incidents/service';

import { getGovernancePackSummary, listGovernancePersonaViews } from './service';

export interface GovernanceExportContext {
  orgId: string;
  role: AbrRole;
  dataMode: AbrDataMode;
}

export interface GovernanceExportArtifact {
  generatedAt: string;
  title: string;
  format: 'json' | 'markdown' | 'csv';
  filename: string;
  payload: unknown;
}

function csvEscape(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'n/a';
  return value.slice(0, 10);
}

export async function buildExecutiveSummaryExport(
  context: GovernanceExportContext,
): Promise<GovernanceExportArtifact> {
  const generatedAt = new Date().toISOString();
  const [dashboard, governance, personas, widgets, sources, jobs, reviewQueue] = await Promise.all([
    getDashboardSummary(context.orgId),
    Promise.resolve(getGovernancePackSummary(context.orgId)),
    Promise.resolve(listGovernancePersonaViews()),
    getExecutiveInsightWidgets(context.dataMode),
    listSourceRegistry(context.dataMode),
    listImportJobs(context.dataMode),
    listManualReviewQueue(context.dataMode),
  ]);

  const markdown = [
    '# ABR Executive Summary',
    '',
    `Generated: ${generatedAt}`,
    `Organization: ${context.orgId}`,
    `Role View: ${context.role}`,
    `Data Mode: ${context.dataMode}`,
    '',
    '## Board Readiness',
    `- Status: ${governance.boardReadiness}`,
    `- Open incidents: ${dashboard.openIncidents}`,
    `- Overdue investigations: ${dashboard.overdueInvestigations}`,
    `- Overdue remediation actions: ${dashboard.overdueActions}`,
    `- Pending executive actions: ${governance.pendingExecutiveActions}`,
    `- Unresolved critical risks: ${governance.unresolvedCriticalRisks}`,
    '',
    '## Intelligence Confidence',
    `- Sources tracked: ${sources.length}`,
    `- Import jobs: ${jobs.length}`,
    `- Review queue: ${reviewQueue.length}`,
    ...widgets.risingIssueCategories.map((item) => `- Rising issue: ${item.label} (${item.deltaPct}% signal lift)`),
    '',
    '## Persona Views',
    ...personas.flatMap((persona) => [
      `### ${persona.persona}`,
      persona.headline,
      ...persona.metrics.map((metric) => `- ${metric.label}: ${metric.value} (${metric.note})`),
      '',
    ]),
  ].join('\n');

  return {
    generatedAt,
    title: 'ABR Executive Summary',
    format: 'markdown',
    filename: `abr-executive-summary-${context.orgId}-${context.dataMode}.md`,
    payload: {
      generatedAt,
      dashboard,
      governance,
      personas,
      widgets,
      sourceCount: sources.length,
      importJobCount: jobs.length,
      reviewQueueCount: reviewQueue.length,
      markdown,
    },
  };
}

export async function buildIncidentExport(
  context: GovernanceExportContext,
): Promise<{ json: GovernanceExportArtifact; csv: GovernanceExportArtifact }> {
  const generatedAt = new Date().toISOString();
  const incidents = await listIncidents(context.orgId);
  const details = await Promise.all(
    incidents.map((incident) =>
      getIncidentDetail(context.orgId, incident.id, {
        role: context.role,
        includeSensitiveNotes: context.role !== 'executive_viewer' && context.role !== 'auditor',
      }),
    ),
  );
  const rows = details.filter(Boolean);

  const csv = [
    'id,title,status,severity,assigned_to,due_at,visible_notes,actions,summary',
    ...rows.map((detail) =>
      [
        detail!.incident.id,
        csvEscape(detail!.incident.title),
        detail!.incident.status,
        detail!.incident.severity,
        detail!.incident.assignedTo ?? '',
        formatDate(detail!.incident.dueAt),
        detail!.notes.length,
        detail!.actions.length,
        csvEscape(detail!.incident.summary),
      ].join(','),
    ),
  ].join('\n');

  return {
    json: {
      generatedAt,
      title: 'ABR Incident Export',
      format: 'json',
      filename: `abr-incidents-${context.orgId}.json`,
      payload: {
        generatedAt,
        role: context.role,
        dataMode: context.dataMode,
        items: rows,
      },
    },
    csv: {
      generatedAt,
      title: 'ABR Incident Export',
      format: 'csv',
      filename: `abr-incidents-${context.orgId}.csv`,
      payload: csv,
    },
  };
}

export async function buildRemediationExport(
  context: GovernanceExportContext,
): Promise<{ json: GovernanceExportArtifact; csv: GovernanceExportArtifact }> {
  const generatedAt = new Date().toISOString();
  const incidents = await listIncidents(context.orgId);
  const details = await Promise.all(
    incidents.map((incident) =>
      getIncidentDetail(context.orgId, incident.id, {
        role: context.role,
        includeSensitiveNotes: false,
      }),
    ),
  );

  const actions = details
    .filter(Boolean)
    .flatMap((detail) =>
      detail!.actions.map((action) => ({
        remediationAction: action,
        incidentId: detail!.incident.id,
        incidentTitle: detail!.incident.title,
        incidentSeverity: detail!.incident.severity,
        incidentStatus: detail!.incident.status,
      })),
    );

  const csv = [
    'incident_id,incident_title,severity,status,action_id,owner_id,remediation_type,action_status,due_date,description',
    ...actions.map((action) =>
      [
        action.incidentId,
        csvEscape(action.incidentTitle),
        action.incidentSeverity,
        action.incidentStatus,
        action.remediationAction.id,
        action.remediationAction.ownerId,
        action.remediationAction.remediationType,
        action.remediationAction.status,
        formatDate(action.remediationAction.dueDate),
        csvEscape(action.remediationAction.description),
      ].join(','),
    ),
  ].join('\n');

  return {
    json: {
      generatedAt,
      title: 'ABR Remediation Export',
      format: 'json',
      filename: `abr-remediation-${context.orgId}.json`,
      payload: {
        generatedAt,
        role: context.role,
        dataMode: context.dataMode,
        items: actions,
      },
    },
    csv: {
      generatedAt,
      title: 'ABR Remediation Export',
      format: 'csv',
      filename: `abr-remediation-${context.orgId}.csv`,
      payload: csv,
    },
  };
}
