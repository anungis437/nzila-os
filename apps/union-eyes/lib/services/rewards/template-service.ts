/**
 * Award Templates Service
 * Provides pre-configured award templates for quick recognition
 * 
 * Uses award_templates table from db/schema/award-templates-schema.ts
 */

import { db } from '@/db';
import { awardTemplates, awardHistory } from '@/db/schema';
import { eq, and, desc, sql, asc, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export interface AwardTemplateInput {
  name: string;
  description?: string;
  message: string;
  category: string;
  type: string;
  pointsValue?: number;
  monetaryValue?: number;
  currency?: string;
  badgeName?: string;
  badgeIcon?: string;
  badgeColor?: string;
  tags?: string[];
  maxUses?: number;
  perUserLimit?: number;
  validFrom?: Date;
  validUntil?: Date;
  requiresApproval?: boolean;
  approverRoles?: string[];
}

/**
 * Default award templates (system-wide)
 */
export const DEFAULT_TEMPLATES: Omit<typeof awardTemplates.$inferInsert, 'id' | 'organizationId' | 'createdBy' | 'createdAt' | 'useCount' | 'totalAwarded' | 'totalValueAwarded'>[] = [
  {
    name: 'Outstanding Performance',
    message: 'Your exceptional work and dedication have made a significant impact. Thank you for consistently going above and beyond!',
    category: 'performance',
    type: 'points',
    pointsValue: 100,
    tags: ['excellence', 'dedication', 'results'],
    status: 'active',
  },
  {
    name: 'Team Player',
    message: 'Your collaborative spirit and willingness to help teammates has strengthened our team. Thank you for being such a great team player!',
    category: 'teamwork',
    type: 'badge',
    badgeName: 'Team Player',
    badgeIcon: 'users',
    badgeColor: '#4CAF50',
    tags: ['collaboration', 'support', 'unity'],
    status: 'active',
  },
  {
    name: 'Innovative Thinking',
    message: 'Your creative solution and innovative approach have helped us solve a challenging problem. Keep thinking outside the box!',
    category: 'innovation',
    type: 'points',
    pointsValue: 150,
    tags: ['creativity', 'problem-solving', 'innovation'],
    status: 'active',
  },
  {
    name: 'Leadership Excellence',
    message: 'Your leadership and guidance have inspired the team to achieve great things. Thank you for being an outstanding leader!',
    category: 'leadership',
    type: 'certificate',
    tags: ['leadership', 'mentorship', 'inspiration'],
    status: 'active',
  },
  {
    name: 'Customer Champion',
    message: 'Your dedication to customer satisfaction and exceptional service has made a real difference. Thank you for representing us so well!',
    category: 'customer-service',
    type: 'points',
    pointsValue: 75,
    tags: ['customer-focus', 'service', 'satisfaction'],
    status: 'active',
  },
  {
    name: 'Going the Extra Mile',
    message: 'Your willingness to step up and take on additional responsibilities hasn\'t gone unnoticed. Thank you for going the extra mile!',
    category: 'performance',
    type: 'gift_card',
    monetaryValue: 50,
    tags: ['initiative', 'commitment', 'effort'],
    status: 'active',
  },
  {
    name: 'Problem Solver',
    message: 'Your analytical skills and quick thinking helped us resolve a critical issue. Thank you for being our go-to problem solver!',
    category: 'performance',
    type: 'points',
    pointsValue: 100,
    tags: ['problem-solving', 'critical-thinking', 'reliability'],
    status: 'active',
  },
  {
    name: 'Positive Attitude',
    message: 'Your positive energy and enthusiasm are contagious! Thank you for making our workplace a better place to be.',
    category: 'teamwork',
    type: 'badge',
    badgeName: 'Positive Vibes',
    badgeIcon: 'smile',
    badgeColor: '#FFC107',
    tags: ['positivity', 'morale', 'culture'],
    status: 'active',
  },
  {
    name: 'Quality Focus',
    message: 'Your attention to detail and commitment to quality ensure we always deliver our best work. Thank you for maintaining high standards!',
    category: 'performance',
    type: 'points',
    pointsValue: 75,
    tags: ['quality', 'excellence', 'precision'],
    status: 'active',
  },
  {
    name: 'Milestone Achievement',
    message: 'Congratulations on reaching this important milestone! Your hard work and perseverance have paid off.',
    category: 'milestone',
    type: 'public_recognition',
    tags: ['milestone', 'achievement', 'success'],
    status: 'active',
  },
];

/**
 * Get award templates for an organization
 */
export async function listAwardTemplates(
  organizationId: string,
  filters?: {
    category?: string;
    type?: string;
    status?: string;
  }
) {
  try {
    const conditions = [eq(awardTemplates.organizationId, organizationId)];
    
    if (filters?.category) {
      conditions.push(eq(awardTemplates.category, filters.category));
    }
    if (filters?.type) {
      conditions.push(eq(awardTemplates.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(awardTemplates.status, filters.status));
    }

    const templates = await db.query.awardTemplates.findMany({
      where: and(...conditions),
      orderBy: [desc(awardTemplates.useCount), asc(awardTemplates.name)],
      limit: 100,
    });

    return { success: true, data: templates || [] };
  } catch (error) {
    logger.error('[Templates] Error listing templates', { error, organizationId });
    return { success: false, error };
  }
}

/**
 * Get a specific template by ID
 */
export async function getAwardTemplate(templateId: string) {
  try {
    const template = await db.query.awardTemplates.findFirst({
      where: eq(awardTemplates.id, templateId),
    });

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, data: template };
  } catch (error) {
    logger.error('[Templates] Error fetching template', { error, templateId });
    return { success: false, error };
  }
}

/**
 * Create a new award template
 */
export async function createAwardTemplate(
  organizationId: string,
  template: AwardTemplateInput,
  createdBy: string
) {
  try {
    const id = uuidv4();
    const [newTemplate] = await db.insert(awardTemplates).values({
      ...template,
      id,
      organizationId,
      createdBy,
      useCount: 0,
      totalAwarded: 0,
      totalValueAwarded: 0,
      status: 'active',
    }).returning();

    return { success: true, data: newTemplate };
  } catch (error) {
    logger.error('[Templates] Error creating template', { error, organizationId, createdBy });
    return { success: false, error };
  }
}

/**
 * Update an existing template
 */
export async function updateAwardTemplate(
  templateId: string,
  updates: Partial<AwardTemplateInput>
) {
  try {
    const [updatedTemplate] = await db.update(awardTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(awardTemplates.id, templateId))
      .returning();

    if (!updatedTemplate) {
      return { success: false, error: 'Template not found' };
    }

    return { success: true, data: updatedTemplate };
  } catch (error) {
    logger.error('[Templates] Error updating template', { error, templateId });
    return { success: false, error };
  }
}

/**
 * Delete a template (soft delete by archiving)
 */
export async function deleteAwardTemplate(templateId: string) {
  try {
    // Check if template has been used
    const usage = await db.query.awardHistory.findFirst({
      where: eq(awardHistory.templateId, templateId),
    });

    if (usage) {
      // Soft delete by marking as archived instead
      await db.update(awardTemplates)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(eq(awardTemplates.id, templateId));
      return { success: true, message: 'Template archived (has usage history)' };
    }

    await db.delete(awardTemplates).where(eq(awardTemplates.id, templateId));
    return { success: true };
  } catch (error) {
    logger.error('[Templates] Error deleting template', { error, templateId });
    return { success: false, error };
  }
}

/**
 * Increment template use count
 */
export async function incrementTemplateUseCount(templateId: string) {
  try {
    await db.update(awardTemplates)
      .set({
        useCount: sql`${awardTemplates.useCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(awardTemplates.id, templateId));

    return { success: true };
  } catch (error) {
    logger.error('[Templates] Error incrementing use count', { error, templateId });
    return { success: false, error };
  }
}

/**
 * Get popular templates (most used)
 */
export async function getPopularTemplates(organizationId: string, limit = 10) {
  try {
    const templates = await db.query.awardTemplates.findMany({
      where: and(
        eq(awardTemplates.organizationId, organizationId),
        ne(awardTemplates.status, 'archived')
      ),
      orderBy: [desc(awardTemplates.useCount)],
      limit,
    });

    return { success: true, data: templates || [] };
  } catch (error) {
    logger.error('[Templates] Error fetching popular templates', { error, organizationId, limit });
    return { success: false, error };
  }
}

/**
 * Search templates by text
 */
export async function searchAwardTemplates(organizationId: string, searchQuery: string) {
  try {
    const templates = await db.query.awardTemplates.findMany({
      where: and(
        eq(awardTemplates.organizationId, organizationId),
        ne(awardTemplates.status, 'archived'),
        sql`(${awardTemplates.name} ILIKE ${`%${searchQuery}%`} OR ${awardTemplates.message} ILIKE ${`%${searchQuery}%`})`
      ),
      orderBy: [desc(awardTemplates.useCount)],
      limit: 50,
    });

    return { success: true, data: templates || [] };
  } catch (error) {
    logger.error('[Templates] Error searching templates', { error, organizationId, searchQuery });
    return { success: false, error };
  }
}

/**
 * Initialize default templates for an organization
 */
export async function initializeDefaultTemplates(
  organizationId: string,
  createdBy: string
) {
  try {
    const templates = DEFAULT_TEMPLATES.map((template) => ({
      ...template,
      id: uuidv4(),
      organizationId,
      createdBy,
    }));

    const created = await db.insert(awardTemplates).values(templates).returning();

    return { success: true, data: created };
  } catch (error) {
    logger.error('[Templates] Error initializing default templates', {
      error,
      organizationId,
      createdBy,
    });
    return { success: false, error };
  }
}

/**
 * Record template usage in history
 */
export async function recordTemplateUsage(
  templateId: string,
  userId: string,
  recipientId: string,
  recipientName: string,
  recipientEmail: string | undefined,
  pointsAwarded: number,
  monetaryValue: number,
  reason: string
) {
  try {
    // Increment use count and update totals
    await db.transaction(async (tx) => {
      // Update template counters
      await tx.update(awardTemplates)
        .set({
          useCount: sql`${awardTemplates.useCount} + 1`,
          totalAwarded: sql`${awardTemplates.totalAwarded} + 1`,
          totalValueAwarded: sql`${awardTemplates.totalValueAwarded} + ${monetaryValue || 0}`,
          updatedAt: new Date(),
        })
        .where(eq(awardTemplates.id, templateId));

      // Record in history
      await tx.insert(awardHistory).values({
        templateId,
        recipientId,
        recipientName,
        recipientEmail,
        pointsAwarded,
        monetaryValue,
        badgeAwarded: false,
        giverId: userId,
        giverName: 'System',
        reason,
        status: 'pending',
        awardedAt: new Date(),
      });
    });

    return { success: true };
  } catch (error) {
    logger.error('[Templates] Error recording template usage', {
      error,
      templateId,
      userId,
      recipientId,
    });
    return { success: false, error };
  }
}

/**
 * Get template usage history
 */
export async function getTemplateHistory(templateId: string, limit = 50) {
  try {
    const history = await db.query.awardHistory.findMany({
      where: eq(awardHistory.templateId, templateId),
      orderBy: [desc(awardHistory.awardedAt)],
      limit,
    });

    return { success: true, data: history || [] };
  } catch (error) {
    logger.error('[Templates] Error fetching template history', { error, templateId, limit });
    return { success: false, error };
  }
}

/**
 * Clone a template for another organization
 */
export async function cloneTemplate(
  templateId: string,
  newOrganizationId: string,
  createdBy: string
) {
  try {
    const original = await getAwardTemplate(templateId);
    
    if (!original.success || !original.data) {
      return { success: false, error: 'Original template not found' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const template = original.data as any;
    const cloned = await createAwardTemplate(
      newOrganizationId,
      {
        name: `${template.name} (Copy)`,
        description: template.description,
        message: template.message,
        category: template.category,
        type: template.type,
        pointsValue: template.pointsValue,
        monetaryValue: template.monetaryValue,
        badgeName: template.badgeName,
        badgeIcon: template.badgeIcon,
        badgeColor: template.badgeColor,
        tags: template.tags,
        maxUses: template.maxUses,
        perUserLimit: template.perUserLimit,
        requiresApproval: template.requiresApproval,
        approverRoles: template.approverRoles,
      },
      createdBy
    );

    return cloned;
  } catch (error) {
    logger.error('[Templates] Error cloning template', {
      error,
      templateId,
      newOrganizationId,
    });
    return { success: false, error };
  }
}

/**
 * Get template statistics
 */
export async function getTemplateStats(organizationId: string) {
  try {
    const templates = await db.query.awardTemplates.findMany({
      where: eq(awardTemplates.organizationId, organizationId),
    });

    const totalTemplates = templates?.length || 0;
    const activeTemplates = templates?.filter(t => t.status === 'active').length || 0;
    const totalUses = templates?.reduce((sum, t) => sum + (t.useCount || 0), 0) || 0;
    const totalValueAwarded = templates?.reduce((sum, t) => sum + (t.totalValueAwarded || 0), 0) || 0;
    const topTemplate = templates?.sort((a, b) => (b.useCount || 0) - (a.useCount || 0))[0];

    return {
      success: true,
      data: {
        totalTemplates,
        activeTemplates,
        totalUses,
        totalValueAwarded,
        topTemplate,
      }
    };
  } catch (error) {
    logger.error('[Templates] Error fetching template stats', { error, organizationId });
    return { success: false, error };
  }
}

/**
 * Archive old templates
 */
export async function archiveOldTemplates(organizationId: string, olderThanDays = 365) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.update(awardTemplates)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(
        eq(awardTemplates.organizationId, organizationId),
        eq(awardTemplates.status, 'active'),
        sql`${awardTemplates.createdAt} < ${cutoffDate}`
      ));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { success: true, archivedCount: (result as any).rowCount };
  } catch (error) {
    logger.error('[Templates] Error archiving old templates', {
      error,
      organizationId,
      olderThanDays,
    });
    return { success: false, error };
  }
}

