/**
 * M365 — Microsoft 365 Integration (re-export from @nzila/integrations-m365)
 *
 * SharePoint document management, Outlook email logging, and Teams
 * channel creation for CFO workflows (audit evidence, AP/AR documents,
 * financial statements archival).
 *
 * @module cfo/m365
 */

// ── Re-exports from workspace package ───────────────────────────────────────

export {
  attachSharePointFolder,
  uploadToSharePoint,
  logEmailToCase,
  createCaseChannel,
} from '@nzila/integrations-m365'

export type {
  SharePointConfig,
  SharePointDocument,
  SharePointFolder,
  GraphClient,
  EmailMessage,
  EmailLogEntry,
  GraphMailClient,
  TeamsChannel,
  GraphTeamsClient,
} from '@nzila/integrations-m365'

// ── CFO Facades ─────────────────────────────────────────────────────────────

import { uploadToSharePoint, attachSharePointFolder } from '@nzila/integrations-m365'
import type { GraphClient, SharePointConfig } from '@nzila/integrations-m365'

export type FinancialDocType =
  | 'financial_statement'
  | 'audit_workpaper'
  | 'tax_return'
  | 'receipt'
  | 'invoice'
  | 'bank_statement'
  | 'contract'
  | 'board_minutes'
  | 'compliance_report'

/**
 * Upload a financial document to the appropriate SharePoint folder.
 */
export async function archiveFinancialDocument(
  graph: GraphClient,
  config: SharePointConfig,
  doc: {
    type: FinancialDocType
    filename: string
    content: Buffer | Uint8Array
    orgId: string
    period: string
  },
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const caseId = `${doc.orgId}-${doc.type}-${doc.period}`

  try {
    await attachSharePointFolder(graph, config, caseId)
    const result = await uploadToSharePoint(graph, config, caseId, doc.filename, doc.content)
    return { ok: true, url: result.sharepointUrl }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SharePoint upload failed' }
  }
}
