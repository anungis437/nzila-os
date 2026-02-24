/**
 * Report Worker - Processes report generation jobs
 * 
 * Generates various reports (PDF, Excel) and stores them for download
 */

// Only import bullmq in runtime, not during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Worker: any, _Job: any,IORedis: any;

if (typeof window === 'undefined' && !process.env.__NEXT_BUILDING) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bullmq = require('bullmq');
    Worker = bullmq.Worker;
    _Job = bullmq.Job;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    IORedis = require('ioredis');
  } catch (_e) {
    // Fail silently during build
  }
}

import { db } from '../../db/db';
import { claims } from '../../db/schema/claims-schema';
import { organizationMembers as members } from '../../db/schema/organization-members-schema';
import { 
  _grievanceWorkflows,
  _grievanceStages,
  grievanceTransitions,
  _grievanceAssignments,
  _grievanceSettlements 
} from '../../db/schema/grievance-workflow-schema';
import { getNotificationService } from '../services/notification-service';
import { eq, and, between, desc } from 'drizzle-orm';
import { generatePDF } from '../utils/pdf-generator';
import { generateExcel } from '../utils/excel-generator';
import { DataExportService, GdprRequestManager } from '../gdpr/consent-manager';
import Papa from 'papaparse';
import fs from 'fs/promises';
import path from 'path';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

const REPORTS_DIR = process.env.REPORTS_DIR || './reports';

/**
 * Ensure reports directory exists
 */
async function ensureReportsDir() {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch (_error) {
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenForExport(input: any, prefix = ''): Array<{ path: string; value: string }> {
  if (input === null || input === undefined) {
    return [{ path: prefix, value: '' }];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item, index) =>
      flattenForExport(item, `${prefix}[${index}]`)
    );
  }

  if (typeof input === 'object') {
    return Object.entries(input).flatMap(([key, value]) =>
      flattenForExport(value, prefix ? `${prefix}.${key}` : key)
    );
  }

  return [{ path: prefix, value: String(input) }];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toXml(entries: Array<{ path: string; value: string }>): string {
  const items = entries
    .map(
      (entry) =>
        `<entry><path>${escapeXml(entry.path)}</path><value>${escapeXml(entry.value)}</value></entry>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><export>${items}</export>`;
}

async function _generateGdprExport(
  organizationId: string,
  userId: string,
  parameters: { requestId: string; format: 'json' | 'csv' | 'xml' }
) {
  const exportData = await DataExportService.exportUserData(
    userId,
    organizationId,
    parameters.format
  );

  if (parameters.format === 'csv') {
    const flattened = flattenForExport(exportData);
    const csv = Papa.unparse(flattened);
    return Buffer.from(csv, 'utf8');
  }

  if (parameters.format === 'xml') {
    const flattened = flattenForExport(exportData);
    const xml = toXml(flattened);
    return Buffer.from(xml, 'utf8');
  }

  return Buffer.from(JSON.stringify(exportData, null, 2), 'utf8');
}
}

/**
 * Generate claims report
 */
async function generateClaimsReport(
  organizationId: string,
  parameters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    format: 'pdf' | 'excel';
  }
) {
// Build query with combined where conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(claims.organizationId, organizationId)];
  
  if (parameters.startDate && parameters.endDate) {
    conditions.push(
      between(claims.createdAt, new Date(parameters.startDate), new Date(parameters.endDate))
    );
  }

  if (parameters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(claims.status, parameters.status as any));
  }

  // Execute query
  const data = await db
    .select()
    .from(claims)
    .where(and(...conditions))
    .orderBy(desc(claims.createdAt));

  // Generate report based on format
  if (parameters.format === 'pdf') {
    return await generatePDF({
      title: 'Claims Report',
      data,
      template: 'claims-report',
    });
  } else {
    return await generateExcel({
      title: 'Claims Report',
      data,
      columns: [
        { header: 'ID', key: 'id' },
        { header: 'Member', key: 'memberId' },
        { header: 'Status', key: 'status' },
        { header: 'Priority', key: 'priority' },
        { header: 'Created', key: 'createdAt' },
        { header: 'Updated', key: 'updatedAt' },
      ],
    });
  }
}

/**
 * Generate members report
 */
async function generateMembersReport(
  organizationId: string,
  parameters: {
    status?: string;
    format: 'pdf' | 'excel';
  }
) {
// Build query with combined where conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(members.organizationId, organizationId)];
  
  if (parameters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(members.status, parameters.status as any));
  }

  // Execute query
  const data = await db
    .select()
    .from(members)
    .where(and(...conditions))
    .orderBy(desc(members.createdAt));

  // Generate report
  if (parameters.format === 'pdf') {
    return await generatePDF({
      title: 'Members Report',
      data,
      template: 'members-report',
    });
  } else {
    return await generateExcel({
      title: 'Members Report',
      data,
      columns: [
        { header: 'ID', key: 'id' },
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Status', key: 'status' },
        { header: 'Joined', key: 'createdAt' },
      ],
    });
  }
}

/**
 * Generate grievances report
 */
async function generateGrievancesReport(
  organizationId: string,
  parameters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    stageType?: string;
    format: 'pdf' | 'excel';
  }
) {
// Build query with combined where conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [eq(claims.organizationId, organizationId)];
  
  if (parameters.startDate && parameters.endDate) {
    conditions.push(
      between(claims.createdAt, new Date(parameters.startDate), new Date(parameters.endDate))
    );
  }

  if (parameters.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(eq(claims.status, parameters.status as any));
  }

  // Query grievance claims with latest transition info
  const data = await db
    .select({
      id: claims.claimId,
      claimNumber: claims.claimNumber,
      subject: claims.subject,
      description: claims.description,
      status: claims.status,
      priority: claims.priority,
      memberId: claims.memberId,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
      resolvedAt: claims.resolvedAt,
      // Could join with transitions/assignments for more info
    })
    .from(claims)
    .where(and(...conditions))
    .orderBy(desc(claims.createdAt));

  // Generate report based on format
  if (parameters.format === 'pdf') {
    return await generatePDF({
      title: 'Grievances Report',
      data,
      template: 'grievances-report',
    });
  } else {
    return await generateExcel({
      title: 'Grievances Report',
      data,
      columns: [
        { header: 'Claim #', key: 'claimNumber' },
        { header: 'Subject', key: 'subject' },
        { header: 'Member ID', key: 'memberId' },
        { header: 'Status', key: 'status' },
        { header: 'Priority', key: 'priority' },
        { header: 'Filed', key: 'createdAt' },
        { header: 'Resolved', key: 'resolvedAt' },
      ],
    });
  }
}

/**
 * Generate usage analytics report
 */
async function generateUsageReport(
  organizationId: string,
  parameters: {
    startDate: string;
    endDate: string;
    format: 'pdf' | 'excel';
  }
) {
// Gather usage statistics
  const claimsData = await db
    .select()
    .from(claims)
    .where(
      and(
        eq(claims.organizationId, organizationId),
        between(claims.createdAt, new Date(parameters.startDate), new Date(parameters.endDate))
      )
    );

  const membersData = await db
    .select()
    .from(members)
    .where(eq(members.organizationId, organizationId));

  const newMembers = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        between(members.createdAt, new Date(parameters.startDate), new Date(parameters.endDate))
      )
    );

  // Count grievances (claims with grievance workflows)
  const grievanceTransitionsData = await db
    .select()
    .from(grievanceTransitions)
    .where(eq(grievanceTransitions.organizationId, organizationId));

  const data = {
    period: { start: parameters.startDate, end: parameters.endDate },
    claims: {
      total: claimsData.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      byStatus: claimsData.reduce((acc: any, claim) => {
        acc[claim.status] = (acc[claim.status] || 0) + 1;
        return acc;
      }, {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      byPriority: claimsData.reduce((acc: any, claim) => {
        acc[claim.priority] = (acc[claim.priority] || 0) + 1;
        return acc;
      }, {}),
    },
    members: {
      total: membersData.length,
      active: membersData.filter((m) => m.status === 'active').length,
      new: newMembers.length,
    },
    grievances: {
      total: grievanceTransitionsData.length,
      resolved: claimsData.filter((c) => c.resolvedAt !== null).length,
    },
  };

  // Generate report
  if (parameters.format === 'pdf') {
    return await generatePDF({
      title: 'Usage Analytics Report',
      data,
      template: 'usage-report',
    });
  } else {
    return await generateExcel({
      title: 'Usage Analytics',
      data: [data],
      columns: [
        { header: 'Period Start', key: 'period.start' },
        { header: 'Period End', key: 'period.end' },
        { header: 'Total Claims', key: 'claims.total' },
        { header: 'Total Members', key: 'members.total' },
        { header: 'Active Members', key: 'members.active' },
        { header: 'Total Grievances', key: 'grievances.total' },
        { header: 'Resolved Grievances', key: 'grievances.resolved' },
      ],
    });
  }
}

/**
 * Process report generation job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processReportJob(job: any) {
  const { reportType, tenantId: organizationId, userId, parameters } = job.data;
await ensureReportsDir();

  await job.updateProgress(10);

  // Generate report based on type
  let buffer: Buffer;
  let filename: string;

  try {
    switch (reportType) {
      case 'claims':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer = await generateClaimsReport(organizationId, parameters as any);
        filename = `claims-report-${Date.now()}.${parameters.format}`;
        break;

      case 'members':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer = await generateMembersReport(organizationId, parameters as any);
        filename = `members-report-${Date.now()}.${parameters.format}`;
        break;

      case 'grievances':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer = await generateGrievancesReport(organizationId, parameters as any);
        filename = `grievances-report-${Date.now()}.${parameters.format}`;
        break;

      case 'usage':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer = await generateUsageReport(organizationId, parameters as any);
        filename = `usage-report-${Date.now()}.${parameters.format}`;
        break;

      case 'gdpr_export':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer = await generateGdprExport(organizationId, userId, parameters as any);
        filename = `gdpr-export-${parameters.requestId}.${parameters.format}`;
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    await job.updateProgress(70);

    // Sanitize filename to prevent path traversal
    const safeFilename = path.basename(filename);
    const filepath = path.join(REPORTS_DIR, safeFilename);
    // Verify resolved path stays within REPORTS_DIR
    const resolvedReports = path.resolve(REPORTS_DIR);
    const resolvedFilepath = path.resolve(filepath);
    if (!resolvedFilepath.startsWith(resolvedReports + path.sep)) {
      throw new Error('Invalid report filename');
    }
    await fs.writeFile(filepath, buffer);
await job.updateProgress(90);

    if (reportType === 'gdpr_export') {
      const downloadUrl = `/api/gdpr/data-export?requestId=${parameters.requestId}&organizationId=${organizationId}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await GdprRequestManager.updateRequestStatus(parameters.requestId, 'completed', {
        processedBy: 'system',
        responseData: {
          format: parameters.format,
          fileName: filename,
          fileUrl: downloadUrl,
          expiresAt,
        },
      });
    }

    // Notify user that report is ready
    try {
      const user = await db.query.profiles.findFirst({
        where: (profiles, { eq }) => eq(profiles.userId, userId),
      });

      if (user?.email) {
        const notificationService = getNotificationService();
        await notificationService.send({
          organizationId: 'system',
          recipientId: userId,
          recipientEmail: user.email,
          type: 'email',
          priority: 'normal',
          subject: 'Your Report is Ready',
          body: `Your ${reportType} report has been generated and is ready for download.\n\nClick the link below to download your report.`,
          actionUrl: `/api/reports/${filename}`,
          actionLabel: 'Download Report',
          userId: 'system',
        }).catch((_err) => {
});
}
    } catch (_notificationError) {
// Don&apos;t fail the job if notification fails
    }

    await job.updateProgress(100);

    return {
      success: true,
      filename,
      filepath,
      size: buffer.length,
    };
  } catch (error) {
throw error;
  }
}

// Create worker
export const reportWorker = new Worker(
  'reports',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    return await processReportJob(job);
  },
  {
    connection,
    concurrency: 2, // Process 2 reports concurrently
  }
);

// Event handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
reportWorker.on('completed', (_job: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
reportWorker.on('failed', (_job: any, _err: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
reportWorker.on('error', (_err: any) => {
});

// Graceful shutdown
async function shutdown() {
await reportWorker.close();
  await connection.quit();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

