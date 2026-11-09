import crypto from 'crypto';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { organizations, organizingCampaigns, organizingFormGenerationReceipts, organizingFormTemplateVersions } from '@/db/schema';
import { renderOrganizingFormPdf } from '@/lib/organizing/form-pdf';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ campaignId: z.guid(), templateKey: z.string().min(1).max(100) });
const digest = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');

export const POST = withApi({
  auth: { required: true, minRole: 'steward' },
  body: bodySchema,
  registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
}, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
  const result = await withRLSContext({ organizationId, userId }, async (tx) => {
    const [campaign] = await tx.select().from(organizingCampaigns).where(and(
      eq(organizingCampaigns.id, body.campaignId),
      eq(organizingCampaigns.organizationId, organizationId),
    )).limit(1);
    if (!campaign) throw ApiError.notFound('Organizing campaign');
    const [org] = await tx.select({ jurisdiction: organizations.provinceTerritory }).from(organizations)
      .where(eq(organizations.id, organizationId)).limit(1);
    const jurisdiction = org?.jurisdiction?.trim().toUpperCase();
    if (!jurisdiction) throw ApiError.conflict('Organization jurisdiction is not configured');
    const now = new Date();
    const templates = await tx.select().from(organizingFormTemplateVersions).where(and(
      eq(organizingFormTemplateVersions.jurisdiction, jurisdiction),
      eq(organizingFormTemplateVersions.templateKey, body.templateKey),
      eq(organizingFormTemplateVersions.status, 'reviewed'),
      lte(organizingFormTemplateVersions.effectiveFrom, now),
      or(isNull(organizingFormTemplateVersions.effectiveUntil), gt(organizingFormTemplateVersions.effectiveUntil, now)),
    )).limit(2);
    if (templates.length !== 1) throw ApiError.notImplemented('No single reviewed form template is effective for this jurisdiction');
    const template = templates[0];
    const values: Record<string, unknown> = {
      campaignName: campaign.campaignName,
      campaignCode: campaign.campaignCode,
      targetEmployer: campaign.targetEmployer,
      workplaceLocation: campaign.workplaceLocation,
      estimatedUnitSize: campaign.estimatedUnitSize,
      campaignStartDate: campaign.campaignStartDate,
      filingDate: campaign.filingDate,
    };
    const fields = template.fieldSpec.map((field) => {
      if (!Object.prototype.hasOwnProperty.call(values, field.source)) throw ApiError.conflict(`Template source field is not approved: ${field.source}`);
      return { label: field.label, value: String(values[field.source] ?? '') };
    });
    const inputDigest = digest(JSON.stringify({ campaignId: campaign.id, templateId: template.id, fields }));
    const pdf = await renderOrganizingFormPdf({ title: template.title, templateVersion: template.version, jurisdiction, sourceUri: template.sourceUri, fields });
    if (pdf.length < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw ApiError.internal('PDF renderer returned invalid output');
    if (pdf.length > 5 * 1024 * 1024) throw ApiError.conflict('Generated PDF exceeds the allowed size');
    const pdfDigest = digest(pdf);
    const safeCode = campaign.campaignCode.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'campaign';
    const fileName = `${safeCode}-${template.templateKey}-v${template.version}.pdf`;
    const [receipt] = await tx.insert(organizingFormGenerationReceipts).values({
      organizationId, campaignId: campaign.id, templateVersionId: template.id, generatedBy: userId,
      inputDigest, pdfDigest, fileName, validPdfHeader: true, byteLength: pdf.length,
    }).returning();
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'organizing.form.generate', resourceType: 'organizing_form_generation_receipts', resourceId: receipt.id,
      details: { campaignId: campaign.id, templateVersionId: template.id, inputDigest, pdfDigest, byteLength: pdf.length },
    });
    return { pdf, fileName, receiptId: receipt.id, pdfDigest };
  });
  return new Response(new Uint8Array(result.pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': String(result.pdf.length),
      'X-Document-Receipt': result.receiptId,
      'X-Document-SHA256': result.pdfDigest,
      'Cache-Control': 'private, no-store',
    },
  });
});
