/**
 * M365 — Microsoft 365 Integration
 *
 * SharePoint document management, Outlook email logging, and Teams
 * channel creation for CFO workflows (audit evidence, AP/AR documents,
 * financial statements archival).
 * Self-contained stubs until @nzila/integrations-m365 is available.
 *
 * @module cfo/m365
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface SharePointConfig { siteId: string; driveId: string; rootFolder?: string }
export interface SharePointDocument { id: string; name: string; sharepointUrl: string }
export interface SharePointFolder { id: string; name: string }
export interface GraphClient { accessToken: string; baseUrl?: string }
export interface EmailMessage { to: string; subject: string; body: string }
export interface EmailLogEntry { id: string; subject: string; timestamp: string }
export interface GraphMailClient { accessToken: string }
export interface TeamsChannel { id: string; displayName: string }
export interface GraphTeamsClient { accessToken: string }

// ── Stub Functions ──────────────────────────────────────────────────────────

export async function attachSharePointFolder(
  _graph: GraphClient, _config: SharePointConfig, _caseId: string,
): Promise<void> { /* stub */ }

export async function uploadToSharePoint(
  _graph: GraphClient, _config: SharePointConfig, _caseId: string, filename: string, _content: Buffer | Uint8Array,
): Promise<SharePointDocument> {
  return { id: crypto.randomUUID(), name: filename, sharepointUrl: `https://sharepoint.stub/${filename}` }
}

export async function logEmailToCase(
  _client: GraphMailClient, _caseId: string, _message: EmailMessage,
): Promise<EmailLogEntry> {
  return { id: crypto.randomUUID(), subject: _message.subject, timestamp: new Date().toISOString() }
}

export async function createCaseChannel(
  _client: GraphTeamsClient, _teamId: string, displayName: string,
): Promise<TeamsChannel> {
  return { id: crypto.randomUUID(), displayName }
}

// ── CFO Facades ─────────────────────────────────────────────────────────────

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
