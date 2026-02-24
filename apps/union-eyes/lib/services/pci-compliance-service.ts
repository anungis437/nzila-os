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
import { eq, desc } from 'drizzle-orm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';


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
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

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
    // Get template requirements
    const { data: templateRequirements } = await this.supabase
      .from('pci_dss_saq_a_requirements_template')
      .select('*')
      .order('requirement_number');

    if (!templateRequirements) return;

    // Copy to requirements table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requirements = templateRequirements.map((template: any) => ({
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
    const { data: orgs } = await this.supabase
      .from('organizations')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('id') as any;

    if (!orgs) return [];

    const overdue: Array<{ organizationId: string; daysSinceLastScan: number }> = [];

    for (const org of orgs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const latestScan = await this.getLatestQuarterlyScan((org as any).id);
      
      if (!latestScan) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overdue.push({ organizationId: (org as any).id, daysSinceLastScan: 999 });
        continue;
      }

      const daysSinceLastScan = Math.floor(
        (Date.now() - latestScan.scanDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastScan > 90) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        overdue.push({ organizationId: (org as any).id, daysSinceLastScan });
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
    const { data: keys } = await this.supabase
      .from('pci_dss_encryption_keys')
      .select('*')
      .order('rotated_at', { ascending: false });

    if (!keys) return [];

    const needsRotation: Array<{
      organizationId: string;
      keyType: string;
      daysSinceRotation: number;
    }> = [];

    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keyAny = key as any;
      const daysSinceRotation = Math.floor(
        (Date.now() - new Date(keyAny.rotated_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceRotation > 90) {
        needsRotation.push({
          organizationId: keyAny.organization_id,
          keyType: keyAny.key_type,
          daysSinceRotation
        });
      }
    }

    return needsRotation;
  }
}

export const pciComplianceService = new PCIComplianceService();
