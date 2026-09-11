/**
 * PCI-DSS Compliance Service
 * 
 * Manages PCI-DSS SAQ-A compliance tracking, assessments, and reporting
 * Aligned with PCI Security Standards Council requirements
 */

import { db } from '@/db';
import {
  pciDssSaqAssessments,
  pciDssRequirements,
  pciDssQuarterlyScans,
  pciDssEncryptionKeys,
} from '@/db/schema/domains/compliance/pci-dss';
import { organizations } from '@/db/schema-organizations';
import { eq, desc, sql } from 'drizzle-orm';

interface TemplateRequirementRow {
  requirement_number: string;
  requirement_description: string;
}

interface EncryptionKeyRow {
  organization_id: string;
  key_type: string;
  rotated_at: string;
}

function isTemplateRequirementRow(value: unknown): value is TemplateRequirementRow {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { requirement_number?: unknown }).requirement_number === 'string'
    && typeof (value as { requirement_description?: unknown }).requirement_description === 'string';
}

function isEncryptionKeyRow(value: unknown): value is EncryptionKeyRow {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { organization_id?: unknown }).organization_id === 'string'
    && typeof (value as { key_type?: unknown }).key_type === 'string'
    && typeof (value as { rotated_at?: unknown }).rotated_at === 'string';
}


export interface PCIAssessmentResult {
  id: string;
  organizationId: string;
  assessmentDate: Date;
  status: 'in_progress' | 'completed' | 'requires_remediation';
  overallCompliance: number;
  requirementsCompliant: number;
  requirementsTotal: number;
  findings: PCIFinding[];
}

export interface PCIFinding {
  requirementId: string;
  requirementNumber: string;
  description: string;
  status: 'compliant' | 'not_applicable' | 'requires_remediation';
  evidence?: string;
  remediationNotes?: string;
}

export interface QuarterlyScanResult {
  id: string;
  organizationId: string;
  scanDate: Date;
  vendorName: string;
  scanStatus: 'pass' | 'fail' | 'pending';
  vulnerabilitiesFound: number;
  criticalIssues: number;
  reportUrl?: string;
}

export class PCIComplianceService {
  /**
   * Generate PCI-DSS SAQ-A compliance report
   */
  async generatePCIAssessmentReport(organizationId: string): Promise<PCIAssessmentResult> {
    // Get latest assessment
    const assessments = await db
      .select()
      .from(pciDssSaqAssessments)
      .where(eq(pciDssSaqAssessments.organizationId, organizationId))
      .orderBy(desc(pciDssSaqAssessments.assessmentDate))
      .limit(1);

    if (assessments.length === 0) {
      throw new Error('No PCI-DSS assessments found for organization');
    }

    const assessment = assessments[0];

    // Get all requirements for this assessment
    const requirements = await db
      .select()
      .from(pciDssRequirements)
      .where(eq(pciDssRequirements.assessmentId, assessment.id));

    // Calculate compliance metrics
    const compliantRequirements = requirements.filter(
      r => r.complianceStatus === 'compliant' || r.complianceStatus === 'not_applicable'
    );

    const findings: PCIFinding[] = requirements.map(req => ({
      requirementId: req.id,
      requirementNumber: req.requirementNumber,
      description: req.requirementDescription,
      status: req.complianceStatus as 'compliant' | 'not_applicable' | 'requires_remediation',
      evidence: req.evidence || undefined,
      remediationNotes: req.remediationNotes || undefined
    }));

    return {
      id: assessment.id,
      organizationId: assessment.organizationId,
      assessmentDate: new Date(assessment.assessmentDate),
      status: assessment.overallStatus as 'in_progress' | 'completed' | 'requires_remediation',
      overallCompliance: (compliantRequirements.length / requirements.length) * 100,
      requirementsCompliant: compliantRequirements.length,
      requirementsTotal: requirements.length,
      findings
    };
  }

  /**
   * Create or update PCI-DSS assessment
   */
  async createAssessment(organizationId: string): Promise<string> {
    const [assessment] = await db
      .insert(pciDssSaqAssessments)
      .values({
        organizationId,
        assessmentDate: new Date(),
        sqaLevel: 'SAQ-A',
        overallStatus: 'in_progress',
        attestationOfCompliance: null,
        attestationDate: null
      })
      .returning();

    // Copy requirements from template
    await this.initializeRequirementsFromTemplate(assessment.id, organizationId);

    return assessment.id;
  }

  /**
   * Initialize requirements from SAQ-A template
   */
  private async initializeRequirementsFromTemplate(
    assessmentId: string,
    organizationId: string
  ): Promise<void> {
    // Get template requirements — no Drizzle table exists for this
    // reference/template relation yet, so query it directly by name.
    const templateResponse = await db.execute(
      sql`SELECT requirement_number, requirement_description FROM pci_dss_saq_a_requirements_template ORDER BY requirement_number`
    );

    const templateRows: unknown[] = Array.isArray(templateResponse)
      ? templateResponse
      : Array.isArray((templateResponse as { rows?: unknown[] }).rows)
        ? (templateResponse as { rows: unknown[] }).rows
        : [];
    const templateRequirements = templateRows.filter(isTemplateRequirementRow);

    if (templateRequirements.length === 0) return;

    // Copy to requirements table
    const requirements = templateRequirements.map((template) => ({
      assessmentId,
      organizationId,
      requirementNumber: template.requirement_number,
      requirementDescription: template.requirement_description,
      complianceStatus: 'requires_remediation' as const,
      evidence: null,
      remediationNotes: null
    }));

    await db.insert(pciDssRequirements).values(requirements);
  }

  /**
   * Update requirement compliance status
   */
  async updateRequirement(
    requirementId: string,
    status: 'compliant' | 'not_applicable' | 'requires_remediation',
    evidence?: string,
    remediationNotes?: string
  ): Promise<void> {
    await db
      .update(pciDssRequirements)
      .set({
        complianceStatus: status,
        evidence: evidence || null,
        remediationNotes: remediationNotes || null,
        lastReviewedAt: new Date()
      })
      .where(eq(pciDssRequirements.id, requirementId));
  }

  /**
   * Record quarterly vulnerability scan
   */
  async recordQuarterlyScan(
    organizationId: string,
    scanData: {
      vendorName: string;
      scanStatus: 'pass' | 'fail' | 'pending';
      vulnerabilitiesFound: number;
      criticalIssues: number;
      reportUrl?: string;
      notes?: string;
    }
  ): Promise<string> {
    const [scan] = await db
      .insert(pciDssQuarterlyScans)
      .values({
        organizationId,
        scanDate: new Date(),
        ...scanData
      })
      .returning();

    return scan.id;
  }

  /**
   * Get latest quarterly scan results
   */
  async getLatestQuarterlyScan(organizationId: string): Promise<QuarterlyScanResult | null> {
    const scans = await db
      .select()
      .from(pciDssQuarterlyScans)
      .where(eq(pciDssQuarterlyScans.organizationId, organizationId))
      .orderBy(desc(pciDssQuarterlyScans.scanDate))
      .limit(1);

    if (scans.length === 0) return null;

    const scan = scans[0];
    return {
      id: scan.id,
      organizationId: scan.organizationId,
      scanDate: new Date(scan.scanDate),
      vendorName: scan.vendorName,
      scanStatus: scan.scanStatus as 'pass' | 'fail' | 'pending',
      vulnerabilitiesFound: scan.vulnerabilitiesFound,
      criticalIssues: scan.criticalIssues,
      reportUrl: scan.reportUrl || undefined
    };
  }

  /**
   * Check if quarterly scan is due
   */
  async isQuarterlyScanDue(organizationId: string): Promise<boolean> {
    const latestScan = await this.getLatestQuarterlyScan(organizationId);
    
    if (!latestScan) return true;

    // Due if last scan was more than 90 days ago
    const daysSinceLastScan = Math.floor(
      (Date.now() - latestScan.scanDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastScan > 90;
  }

  /**
   * Get all overdue quarterly scans
   */
  async getOverdueScans(): Promise<Array<{ organizationId: string; daysSinceLastScan: number }>> {
    const orgs = await db.select({ id: organizations.id }).from(organizations);

    if (orgs.length === 0) return [];

    const overdue: Array<{ organizationId: string; daysSinceLastScan: number }> = [];

    for (const org of orgs) {
      const latestScan = await this.getLatestQuarterlyScan(org.id);
      
      if (!latestScan) {
        overdue.push({ organizationId: org.id, daysSinceLastScan: 999 });
        continue;
      }

      const daysSinceLastScan = Math.floor(
        (Date.now() - latestScan.scanDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastScan > 90) {
        overdue.push({ organizationId: org.id, daysSinceLastScan });
      }
    }

    return overdue;
  }

  /**
   * Track encryption key rotation
   */
  async trackKeyRotation(
    organizationId: string,
    keyType: 'stripe_secret_key' | 'database_encryption' | 'jwt_signing',
    keyIdentifier: string
  ): Promise<void> {
    await db.insert(pciDssEncryptionKeys).values({
      organizationId,
      keyType,
      keyIdentifier,
      rotatedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      rotationReason: 'scheduled_rotation'
    });
  }

  /**
   * Check for keys needing rotation
   */
  async getKeysNeedingRotation(): Promise<Array<{
    organizationId: string;
    keyType: string;
    daysSinceRotation: number;
  }>> {
    const keyResponse = await db
      .select()
      .from(pciDssEncryptionKeys)
      .orderBy(desc(pciDssEncryptionKeys.rotatedAt));

    const keys = keyResponse
      .map((row) => ({
        organization_id: row.organizationId,
        key_type: row.keyType,
        rotated_at: String(row.rotatedAt),
      }))
      .filter(isEncryptionKeyRow);

    if (keys.length === 0) return [];

    const needsRotation: Array<{
      organizationId: string;
      keyType: string;
      daysSinceRotation: number;
    }> = [];

    for (const key of keys) {
      const daysSinceRotation = Math.floor(
        (Date.now() - new Date(key.rotated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRotation > 90) {
        needsRotation.push({
          organizationId: key.organization_id,
          keyType: key.key_type,
          daysSinceRotation
        });
      }
    }

    return needsRotation;
  }
}

export const pciComplianceService = new PCIComplianceService();
