/**
 * TrustCore — PDF Generation (server-side, pdfkit)
 *
 * Produces a structured, typography-clean PDF audit report.
 * NOT a raw JSON dump — organised into labelled sections.
 *
 * Used by POST /api/export/audit?format=pdf
 */

// pdfkit ships only CommonJS modules (no ESM exports), so require() is needed here.
// The serverExternalPackages config in next.config.ts ensures this runs only on the server.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit')
import { withNzilaSpan } from '@nzila/otel-core'
import type { ComplianceReport } from './report'

// ── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  teal: '#0f766e',
  red: '#dc2626',
  orange: '#ea580c',
  yellow: '#ca8a04',
  gray: '#6b7280',
  darkGray: '#111827',
  lightGray: '#e5e7eb',
  white: '#ffffff',
}

function statusColor(status: ComplianceReport['status']): string {
  if (status === 'compliant') return COLORS.teal
  if (status === 'at-risk') return COLORS.yellow
  return COLORS.red
}

function severityColor(severity: string): string {
  if (severity === 'critical') return COLORS.red
  if (severity === 'high') return COLORS.orange
  if (severity === 'medium') return COLORS.yellow
  return COLORS.gray
}

// ── Layout helpers ──────────────────────────────────────────────────────────

const PAGE_MARGIN = 50
const PAGE_WIDTH = 595 // A4 width in pts
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2

function heading1(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.fontSize(20).fillColor(COLORS.darkGray).font('Helvetica-Bold').text(text, { continued: false })
  doc.moveDown(0.5)
}

function heading2(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.fontSize(13).fillColor(COLORS.teal).font('Helvetica-Bold').text(text, { continued: false })
  doc.moveDown(0.25)
}

function body(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.fontSize(10).fillColor(COLORS.darkGray).font('Helvetica').text(text, { continued: false })
}

function small(doc: InstanceType<typeof PDFDocument>, text: string, color = COLORS.gray) {
  doc.fontSize(9).fillColor(color).font('Helvetica').text(text, { continued: false })
}

function divider(doc: InstanceType<typeof PDFDocument>) {
  const y = doc.y
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor(COLORS.lightGray).lineWidth(0.5).stroke()
  doc.moveDown(0.5)
}

// ── PDF assembler ────────────────────────────────────────────────────────────

export async function generateAuditPdf(report: ComplianceReport): Promise<Buffer> {
  return withNzilaSpan('trustcore.compliance.pdf.generate', report.orgId, async () => {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

    // ── Cover ───────────────────────────────────────────────────────────────
    doc
      .fontSize(28)
      .fillColor(COLORS.teal)
      .font('Helvetica-Bold')
      .text('TrustCore', PAGE_MARGIN, 60)

    doc
      .fontSize(14)
      .fillColor(COLORS.gray)
      .font('Helvetica')
      .text('Law 25 Compliance Audit Report', { continued: false })

    doc.moveDown(1)
    divider(doc)

    small(doc, `Organisation: ${report.orgId}`)
    small(doc, `Generated: ${new Date(report.generatedAt).toLocaleString()}`)
    small(doc, `Framework: Quebec Law 25 (An Act to modernize legislative provisions as regards the protection of personal information)`)
    doc.moveDown(1)

    // ── 1. Compliance Score ─────────────────────────────────────────────────
    heading1(doc, '1. Compliance Score')

    doc
      .fontSize(48)
      .fillColor(statusColor(report.status))
      .font('Helvetica-Bold')
      .text(`${report.score}`, PAGE_MARGIN, doc.y, { continued: false })

    doc
      .fontSize(12)
      .fillColor(COLORS.gray)
      .font('Helvetica')
      .text(`out of 100  ·  Status: ${report.status.toUpperCase()}  ·  Confidence: ${report.confidence}%`, { continued: false })

    doc.moveDown(0.5)
    body(doc, report.auditReadyStatement)
    doc.moveDown(1)
    divider(doc)

    // ── 2. Summary Stats ────────────────────────────────────────────────────
    heading1(doc, '2. Summary')

    const stats = [
      ['Active Data Assets', String(report.summary.totalAssets)],
      ['Missing PIAs', String(report.summary.missingPias)],
      ['Overdue DSR Requests', String(report.summary.overdueRequests)],
      ['Open Incidents', String(report.summary.openIncidents)],
      ['High-Risk Vendors', String(report.summary.highRiskVendors)],
      ['Total Risks', String(report.totalRisks)],
      ['Blocking Risks', String(report.blockingCount)],
    ]

    for (const [label, value] of stats) {
      doc.fontSize(10).fillColor(COLORS.darkGray).font('Helvetica-Bold').text(`${label}: `, { continued: true })
      doc.font('Helvetica').text(value, { continued: false })
    }

    doc.moveDown(1)
    divider(doc)

    // ── 3. Key Risks ────────────────────────────────────────────────────────
    heading1(doc, '3. Key Risks')

    if (report.evaluation.risks.length === 0) {
      body(doc, 'No compliance risks identified at this time.')
    } else {
      const sortedRisks = [...report.evaluation.risks].sort((a, b) => {
        const order = ['critical', 'high', 'medium', 'low']
        return order.indexOf(a.severity) - order.indexOf(b.severity)
      })

      for (const risk of sortedRisks) {
        // Check page space
        if (doc.y > 700) doc.addPage()

        doc
          .fontSize(10)
          .fillColor(severityColor(risk.severity))
          .font('Helvetica-Bold')
          .text(`[${risk.severity.toUpperCase()}] ${risk.blocking ? '⚠ BLOCKING · ' : ''}${risk.category.toUpperCase()}`, { continued: false })

        doc.fontSize(10).fillColor(COLORS.darkGray).font('Helvetica').text(risk.message, { continued: false })
        doc.fontSize(9).fillColor(COLORS.gray).font('Helvetica-Oblique').text(`→ ${risk.recommendation}`, { continued: false })

        if (risk.slaDeadline) {
          doc.fontSize(9).fillColor(COLORS.red).font('Helvetica-Bold').text(
            `SLA Deadline: ${new Date(risk.slaDeadline).toLocaleString()}`,
            { continued: false },
          )
        }

        doc.moveDown(0.5)
      }
    }

    doc.addPage()
    divider(doc)

    // ── 4–8. Narrative Sections ─────────────────────────────────────────────
    for (const section of report.sections) {
      if (doc.y > 680) doc.addPage()
      heading2(doc, section.title)
      for (const finding of section.findings) {
        doc.fontSize(10).fillColor(COLORS.darkGray).font('Helvetica').text(`• ${finding}`, { indent: 10, continued: false })
      }
      doc.moveDown(0.75)
    }

    divider(doc)

    // ── Privacy Officer ──────────────────────────────────────────────────────
    if (doc.y > 680) doc.addPage()
    heading2(doc, 'Privacy Officer Contact')
    if (report.privacyOfficerEmail) {
      body(doc, `Name: ${report.privacyOfficerName ?? 'On file'}`)
      body(doc, `Email: ${report.privacyOfficerEmail}`)
      if (report.privacyOfficerRole) body(doc, `Role: ${report.privacyOfficerRole}`)
    } else {
      body(doc, 'No Privacy Officer email on file.')
    }

    doc.moveDown(1)
    divider(doc)

    // ── Footer ───────────────────────────────────────────────────────────────
    small(
      doc,
      'This report was generated automatically by TrustCore. It is based on data entered by the organisation and reflects the compliance posture at the time of generation. It does not constitute legal advice.',
    )

      doc.end()
    })
  })
}
