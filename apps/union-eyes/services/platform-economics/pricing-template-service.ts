/**
 * Pricing Template Service
 *
 * CRUD and instantiation of configurable commercial pricing templates.
 * Templates define base pricing, module fees, cadence, and constraints
 * for CUPE-style pilots, shared rollouts, and full deployments.
 *
 * Functions:
 *  - createTemplate          — define a new pricing template
 *  - getTemplate             — retrieve template by ID or code
 *  - listTemplates           — list available templates
 *  - updateTemplate          — update template fields
 *  - addTemplateModule       — add module pricing to template
 *  - instantiateTemplate     — create contract + subscription from template
 *  - seedDefaultTemplates    — seed canonical CUPE templates
 *
 * @domain platform-economics
 * @layer 1 — Platform Billing (Templates)
 */

import { db } from '@/db';
import {
  pricingTemplates,
  pricingTemplateModules,
  type NewPricingTemplate,
  type PricingTemplate,
  type PricingTemplateModule,
  type NewPricingTemplateModule,
  subscriptionPlans,
  orgSubscriptions,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

// ============================================================================
// Types
// ============================================================================

export interface CreateTemplateInput {
  code: string;
  name: string;
  description?: string;
  tier: NewPricingTemplate['tier'];
  basePlatformFeeCad: string;
  perLocalFeeCad?: string;
  perDivisionFeeCad?: string;
  perAdminSeatFeeCad?: string;
  perModuleFeeCad?: string;
  transactionFeeRate?: string;
  transactionFlatFeeCad?: string;
  onboardingFeeCad?: string;
  supportFeeCad?: string;
  discountPercent?: string;
  subsidyCad?: string;
  billingCadence?: NewPricingTemplate['billingCadence'];
  maxCoveredLocals?: number;
  maxCoveredDivisions?: number;
  includedModules?: number;
  trialDays?: number;
  contractTermMonths?: number;
  feeWaiverActive?: boolean;
  allocationEnabled?: boolean;
  pilotMode?: boolean;
  modules?: CreateTemplateModuleInput[];
  createdBy?: string;
}

export interface CreateTemplateModuleInput {
  moduleKey: string;
  moduleName: string;
  included: boolean;
  additionalFeeCad?: string;
  usageLimit?: number;
}

export interface InstantiateTemplateResult {
  subscriptionPlanId: string;
  subscriptionId: string;
  templateCode: string;
}

// ============================================================================
// Template CRUD
// ============================================================================

/**
 * Create a new pricing template with optional module definitions.
 */
export async function createTemplate(
  input: CreateTemplateInput,
): Promise<{ template: PricingTemplate; modules: PricingTemplateModule[] }> {
  return await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(pricingTemplates)
      .values({
        code: input.code,
        name: input.name,
        description: input.description,
        tier: input.tier,
        basePlatformFeeCad: input.basePlatformFeeCad,
        perLocalFeeCad: input.perLocalFeeCad,
        perDivisionFeeCad: input.perDivisionFeeCad,
        perAdminSeatFeeCad: input.perAdminSeatFeeCad,
        perModuleFeeCad: input.perModuleFeeCad,
        transactionFeeRate: input.transactionFeeRate,
        transactionFlatFeeCad: input.transactionFlatFeeCad,
        onboardingFeeCad: input.onboardingFeeCad,
        supportFeeCad: input.supportFeeCad,
        discountPercent: input.discountPercent,
        subsidyCad: input.subsidyCad,
        billingCadence: input.billingCadence ?? 'monthly',
        maxCoveredLocals: input.maxCoveredLocals,
        maxCoveredDivisions: input.maxCoveredDivisions,
        includedModules: input.includedModules,
        trialDays: input.trialDays,
        contractTermMonths: input.contractTermMonths,
        feeWaiverActive: input.feeWaiverActive ?? false,
        allocationEnabled: input.allocationEnabled ?? false,
        pilotMode: input.pilotMode ?? false,
        createdBy: input.createdBy,
      })
      .returning();

    const modules: PricingTemplateModule[] = [];

    if (input.modules?.length) {
      for (const mod of input.modules) {
        const [m] = await tx
          .insert(pricingTemplateModules)
          .values({
            templateId: template.id,
            moduleKey: mod.moduleKey,
            moduleName: mod.moduleName,
            included: mod.included,
            additionalFeeCad: mod.additionalFeeCad,
            usageLimit: mod.usageLimit,
          })
          .returning();
        modules.push(m);
      }
    }

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.MEDIUM,
      resource: 'pricing_template',
      resourceId: template.id,
      action: 'template_created',
      userId: input.createdBy,
      metadata: { code: input.code, tier: input.tier, moduleCount: modules.length },
    });

    return { template, modules };
  });
}

/**
 * Get a template by ID or code.
 */
export async function getTemplate(
  idOrCode: string,
): Promise<{ template: PricingTemplate; modules: PricingTemplateModule[] } | null> {
  // Try by ID first, then by code
  let [template] = await db
    .select()
    .from(pricingTemplates)
    .where(eq(pricingTemplates.id, idOrCode))
    .limit(1);

  if (!template) {
    [template] = await db
      .select()
      .from(pricingTemplates)
      .where(eq(pricingTemplates.code, idOrCode))
      .limit(1);
  }

  if (!template) return null;

  const modules = await db
    .select()
    .from(pricingTemplateModules)
    .where(eq(pricingTemplateModules.templateId, template.id));

  return { template, modules };
}

/**
 * List all active templates.
 */
export async function listTemplates(
  statusFilter: ('active' | 'inactive' | 'archived')[] = ['active'],
): Promise<PricingTemplate[]> {
  return await db
    .select()
    .from(pricingTemplates)
    .where(inArray(pricingTemplates.status, statusFilter));
}

/**
 * Update template fields (non-destructive).
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<Omit<NewPricingTemplate, 'id' | 'code' | 'createdAt'>>,
  updatedBy?: string,
): Promise<PricingTemplate | null> {
  const [updated] = await db
    .update(pricingTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(pricingTemplates.id, templateId))
    .returning();

  if (updated) {
    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.MEDIUM,
      resource: 'pricing_template',
      resourceId: templateId,
      action: 'template_updated',
      userId: updatedBy,
      metadata: { fields: Object.keys(updates) },
    });
  }

  return updated ?? null;
}

/**
 * Add a module pricing entry to a template.
 */
export async function addTemplateModule(
  templateId: string,
  input: CreateTemplateModuleInput,
): Promise<PricingTemplateModule> {
  const [mod] = await db
    .insert(pricingTemplateModules)
    .values({
      templateId,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      included: input.included,
      additionalFeeCad: input.additionalFeeCad,
      usageLimit: input.usageLimit,
    })
    .returning();

  return mod;
}

// ============================================================================
// Template Instantiation
// ============================================================================

/**
 * Instantiate a pricing template into a subscription plan + org subscription.
 * Creates the plan from template pricing, then subscribes the org.
 */
export async function instantiateTemplate(
  templateCode: string,
  organizationId: string,
  billingAccountId: string,
  createdBy?: string,
): Promise<InstantiateTemplateResult> {
  const tmpl = await getTemplate(templateCode);
  if (!tmpl) {
    throw new Error(`Pricing template '${templateCode}' not found`);
  }

  const { template } = tmpl;

  return await db.transaction(async (tx) => {
    // 1. Create subscription plan from template
    const planCode = `${template.code}-plan-${Date.now().toString(36)}`;
    const now = new Date();
    const [plan] = await tx
      .insert(subscriptionPlans)
      .values({
        code: planCode,
        name: `${template.name} Plan`,
        description: template.description,
        pricingModel: 'hybrid',
        baseFee: template.basePlatformFeeCad,
        perLocalFee: template.perLocalFeeCad,
        perSeatFee: template.perAdminSeatFeeCad,
        perModuleFee: template.perModuleFeeCad,
        onboardingFee: template.onboardingFeeCad,
        supportFee: template.supportFeeCad,
        billingInterval: template.billingCadence,
        isActive: true,
        effectiveFrom: now,
      })
      .returning();

    // 2. Create org subscription
    const startDate = now;
    const endDate = calculatePeriodEnd(startDate, template.billingCadence);
    const trialEndDate = template.trialDays
      ? new Date(startDate.getTime() + template.trialDays * 86_400_000)
      : undefined;

    const [subscription] = await tx
      .insert(orgSubscriptions)
      .values({
        billingAccountId,
        organizationId,
        planId: plan.id,
        status: template.pilotMode ? 'trialing' : 'active',
        startDate,
        endDate,
        trialEndDate,
        discountPercent: template.discountPercent,
        subsidyAmount: template.subsidyCad,
        createdBy,
      })
      .returning();

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      organizationId,
      resource: 'org_subscription',
      resourceId: subscription.id,
      action: 'template_instantiated',
      userId: createdBy,
      metadata: {
        templateCode: template.code,
        planId: plan.id,
        tier: template.tier,
        pilotMode: template.pilotMode,
      },
    });

    return {
      subscriptionPlanId: plan.id,
      subscriptionId: subscription.id,
      templateCode: template.code,
    };
  });
}

// ============================================================================
// Default Template Seeds
// ============================================================================

/**
 * Seed the five canonical CUPE pricing templates.
 * Idempotent — skips templates whose codes already exist.
 */
export async function seedDefaultTemplates(createdBy?: string): Promise<string[]> {
  const seeded: string[] = [];

  const defaults: CreateTemplateInput[] = [
    {
      code: 'cupe-pilot',
      name: 'CUPE Pilot',
      description: 'Discounted pilot for limited locals/modules with optional fee waiver',
      tier: 'pilot',
      basePlatformFeeCad: '500.00',
      perLocalFeeCad: '50.00',
      perAdminSeatFeeCad: '10.00',
      discountPercent: '25.00',
      billingCadence: 'monthly',
      maxCoveredLocals: 5,
      maxCoveredDivisions: 1,
      includedModules: 2,
      trialDays: 30,
      contractTermMonths: 6,
      feeWaiverActive: true,
      pilotMode: true,
      modules: [
        { moduleKey: 'governance_suite', moduleName: 'Governance Suite', included: true },
        { moduleKey: 'grievance_case_suite', moduleName: 'Grievance & Case Suite', included: true },
        { moduleKey: 'financial_intelligence_suite', moduleName: 'Financial Intelligence', included: false, additionalFeeCad: '200.00' },
        { moduleKey: 'ai_advanced_insights', moduleName: 'AI Advanced Insights', included: false, additionalFeeCad: '350.00' },
      ],
      createdBy,
    },
    {
      code: 'cupe-shared-rollout',
      name: 'CUPE Shared Rollout',
      description: 'Parent org pays platform with internal allocation and selected modules',
      tier: 'shared_rollout',
      basePlatformFeeCad: '2000.00',
      perLocalFeeCad: '100.00',
      perDivisionFeeCad: '250.00',
      perAdminSeatFeeCad: '15.00',
      transactionFeeRate: '0.015000',
      transactionFlatFeeCad: '0.25',
      billingCadence: 'monthly',
      maxCoveredLocals: 25,
      maxCoveredDivisions: 5,
      includedModules: 3,
      contractTermMonths: 12,
      allocationEnabled: true,
      modules: [
        { moduleKey: 'governance_suite', moduleName: 'Governance Suite', included: true },
        { moduleKey: 'grievance_case_suite', moduleName: 'Grievance & Case Suite', included: true },
        { moduleKey: 'financial_intelligence_suite', moduleName: 'Financial Intelligence', included: true },
        { moduleKey: 'ai_advanced_insights', moduleName: 'AI Advanced Insights', included: false, additionalFeeCad: '500.00' },
      ],
      createdBy,
    },
    {
      code: 'cupe-full-deployment',
      name: 'CUPE Full Deployment',
      description: 'National/division base fee, expanded modules, allocation + finance intelligence',
      tier: 'full_deployment',
      basePlatformFeeCad: '5000.00',
      perLocalFeeCad: '75.00',
      perDivisionFeeCad: '200.00',
      perAdminSeatFeeCad: '12.00',
      perModuleFeeCad: '100.00',
      transactionFeeRate: '0.012500',
      transactionFlatFeeCad: '0.20',
      supportFeeCad: '500.00',
      billingCadence: 'quarterly',
      includedModules: 4,
      contractTermMonths: 24,
      allocationEnabled: true,
      modules: [
        { moduleKey: 'governance_suite', moduleName: 'Governance Suite', included: true },
        { moduleKey: 'grievance_case_suite', moduleName: 'Grievance & Case Suite', included: true },
        { moduleKey: 'financial_intelligence_suite', moduleName: 'Financial Intelligence', included: true },
        { moduleKey: 'ai_advanced_insights', moduleName: 'AI Advanced Insights', included: true },
      ],
      createdBy,
    },
    {
      code: 'mid-sized-union',
      name: 'Mid-Sized Union',
      description: 'Standard pricing for mid-sized unions (5-50 locals)',
      tier: 'mid_sized_union',
      basePlatformFeeCad: '1500.00',
      perLocalFeeCad: '80.00',
      perAdminSeatFeeCad: '12.00',
      transactionFeeRate: '0.020000',
      transactionFlatFeeCad: '0.30',
      billingCadence: 'monthly',
      maxCoveredLocals: 50,
      includedModules: 2,
      contractTermMonths: 12,
      allocationEnabled: true,
      modules: [
        { moduleKey: 'governance_suite', moduleName: 'Governance Suite', included: true },
        { moduleKey: 'grievance_case_suite', moduleName: 'Grievance & Case Suite', included: true },
        { moduleKey: 'financial_intelligence_suite', moduleName: 'Financial Intelligence', included: false, additionalFeeCad: '300.00' },
        { moduleKey: 'ai_advanced_insights', moduleName: 'AI Advanced Insights', included: false, additionalFeeCad: '400.00' },
      ],
      createdBy,
    },
    {
      code: 'membership-association',
      name: 'Membership Association',
      description: 'Pricing template for professional/membership associations',
      tier: 'membership_association',
      basePlatformFeeCad: '1000.00',
      perAdminSeatFeeCad: '10.00',
      transactionFeeRate: '0.025000',
      transactionFlatFeeCad: '0.35',
      billingCadence: 'annual',
      includedModules: 2,
      contractTermMonths: 12,
      modules: [
        { moduleKey: 'governance_suite', moduleName: 'Governance Suite', included: true },
        { moduleKey: 'grievance_case_suite', moduleName: 'Grievance & Case Suite', included: false, additionalFeeCad: '250.00' },
        { moduleKey: 'financial_intelligence_suite', moduleName: 'Financial Intelligence', included: true },
        { moduleKey: 'ai_advanced_insights', moduleName: 'AI Advanced Insights', included: false, additionalFeeCad: '300.00' },
      ],
      createdBy,
    },
  ];

  for (const tmpl of defaults) {
    const existing = await getTemplate(tmpl.code);
    if (existing) continue;

    await createTemplate(tmpl);
    seeded.push(tmpl.code);
  }

  return seeded;
}

// ============================================================================
// Helpers
// ============================================================================

function calculatePeriodEnd(start: Date, cadence: string): Date {
  const end = new Date(start);
  switch (cadence) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      break;
    default:
      end.setMonth(end.getMonth() + 1);
  }
  return end;
}
