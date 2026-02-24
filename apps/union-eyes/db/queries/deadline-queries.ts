/**
 * Deadline Tracking Database Queries
 * 
 * Query functions for proactive deadline management:
 * - Deadline calculation and creation
 * - Extension requests and approvals
 * - Alert generation and tracking
 * - Compliance reporting
 * - Business day calculations
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface DeadlineRule {
  id: string;
  organizationId: string;
  ruleName: string;
  ruleCode: string;
  description?: string;
  claimType?: string;
  priorityLevel?: string;
  stepNumber?: number;
  daysFromEvent: number;
  eventType: string;
  businessDaysOnly: boolean;
  allowsExtension: boolean;
  maxExtensionDays: number;
  requiresApproval: boolean;
  escalateToRole?: string;
  escalationDelayDays: number;
  isActive: boolean;
  isSystemRule: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClaimDeadline {
  id: string;
  claimId: string;
  organizationId: string;
  deadlineRuleId?: string;
  deadlineName: string;
  deadlineType: string;
  eventDate: Date;
  originalDeadline: Date;
  currentDeadline: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'missed' | 'extended' | 'waived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  extensionCount: number;
  totalExtensionDays: number;
  lastExtensionDate?: Date;
  lastExtensionReason?: string;
  completedBy?: string;
  completionNotes?: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  daysOverdue: number;
  escalatedAt?: Date;
  escalatedTo?: string;
  alertCount: number;
  lastAlertSent?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadlineExtension {
  id: string;
  deadlineId: string;
  organizationId: string;
  requestedBy: string;
  requestedAt: Date;
  requestedDays: number;
  requestReason: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  requiresApproval: boolean;
  approvedBy?: string;
  approvalDecisionAt?: Date;
  approvalNotes?: string;
  newDeadline?: Date;
  daysGranted?: number;
  createdAt: Date;
}

export interface DeadlineAlert {
  id: string;
  deadlineId: string;
  organizationId: string;
  alertType: string;
  alertSeverity: string;
  alertTrigger: string;
  recipientId: string;
  recipientRole?: string;
  deliveryMethod: string;
  sentAt: Date;
  deliveredAt?: Date;
  deliveryStatus: string;
  deliveryError?: string;
  viewedAt?: Date;
  acknowledgedAt?: Date;
  actionTaken?: string;
  actionTakenAt?: Date;
  subject?: string;
  message?: string;
  actionUrl?: string;
  createdAt: Date;
}

export interface Holiday {
  id: string;
  organizationId?: string;
  holidayDate: Date;
  holidayName: string;
  holidayType: string;
  isRecurring: boolean;
  appliesTo: string;
  isObserved: boolean;
}

// ============================================================================
// DEADLINE RULES QUERIES
// ============================================================================

/**
 * Get all active deadline rules for organization
 */
export async function getDeadlineRules(organizationId: string): Promise<DeadlineRule[]> {
  const result = await db.execute(sql`
    SELECT * FROM deadline_rules
    WHERE tenant_id = ${organizationId} AND is_active = TRUE
    ORDER BY rule_name
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get deadline rule by code
 */
export async function getDeadlineRuleByCode(
  organizationId: string,
  ruleCode: string
): Promise<DeadlineRule | null> {
  const result = await db.execute(sql`
    SELECT * FROM deadline_rules
    WHERE tenant_id = ${organizationId} AND rule_code = ${ruleCode} AND is_active = TRUE
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any || null;
}

/**
 * Get applicable deadline rules for a claim
 */
export async function getApplicableDeadlineRules(
  organizationId: string,
  claimType: string,
  priorityLevel?: string
): Promise<DeadlineRule[]> {
  const result = await db.execute(sql`
    SELECT * FROM deadline_rules
    WHERE tenant_id = ${organizationId}
      AND is_active = TRUE
      AND (claim_type IS NULL OR claim_type = ${claimType})
      AND (priority_level IS NULL OR priority_level = ${priorityLevel || null})
    ORDER BY step_number NULLS LAST, days_from_event
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Create custom deadline rule
 */
export async function createDeadlineRule(
  organizationId: string,
  ruleName: string,
  ruleCode: string,
  daysFromEvent: number,
  eventType: string,
  createdBy: string,
  options: {
    description?: string;
    claimType?: string;
    priorityLevel?: string;
    stepNumber?: number;
    businessDaysOnly?: boolean;
    allowsExtension?: boolean;
    maxExtensionDays?: number;
    requiresApproval?: boolean;
    escalateToRole?: string;
    escalationDelayDays?: number;
  } = {}
): Promise<DeadlineRule> {
  const result = await db.execute(sql`
    INSERT INTO deadline_rules (
      tenant_id, rule_name, rule_code, description, claim_type, priority_level,
      step_number, days_from_event, event_type, business_days_only,
      allows_extension, max_extension_days, requires_approval,
      escalate_to_role, escalation_delay_days, created_by
    ) VALUES (
      ${organizationId}, ${ruleName}, ${ruleCode}, ${options.description || null},
      ${options.claimType || null}, ${options.priorityLevel || null},
      ${options.stepNumber || null}, ${daysFromEvent}, ${eventType},
      ${options.businessDaysOnly || false}, ${options.allowsExtension !== false},
      ${options.maxExtensionDays || 30}, ${options.requiresApproval || false},
      ${options.escalateToRole || null}, ${options.escalationDelayDays || 0},
      ${createdBy}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

// ============================================================================
// CLAIM DEADLINES QUERIES
// ============================================================================

/**
 * Get all deadlines for a claim
 */
export async function getClaimDeadlines(claimId: string): Promise<ClaimDeadline[]> {
  const result = await db.execute(sql`
    SELECT * FROM claim_deadlines
    WHERE claim_id = ${claimId}
    ORDER BY due_date
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get pending deadlines for a claim
 */
export async function getPendingClaimDeadlines(claimId: string): Promise<ClaimDeadline[]> {
  const result = await db.execute(sql`
    SELECT * FROM claim_deadlines
    WHERE claim_id = ${claimId} AND status = 'pending'
    ORDER BY due_date
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get critical deadlines for organization (overdue + due within 3 days)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCriticalDeadlines(organizationId: string): Promise<any[]> {
  try {
    // Check if v_critical_deadlines view exists
    const viewCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_critical_deadlines'
      ) as view_exists
    `);
    
    if (!viewCheck[0]?.view_exists) {
      logger.warn('Critical deadlines view missing; returning empty array', {
        organizationId,
      });
      return [];
    }

    const result = await db.execute(sql`
      SELECT * FROM v_critical_deadlines
      WHERE tenant_id = ${organizationId}
      ORDER BY 
        CASE 
          WHEN is_overdue THEN 1
          WHEN days_until_due = 0 THEN 2
          ELSE 3
        END,
        due_date
    `);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result as any[];
  } catch (error) {
    logger.error('Error fetching critical deadlines', { error, organizationId });
    return [];
  }
}

/**
 * Get member's deadlines
 */
export async function getMemberDeadlines(
  memberId: string,
  organizationId: string,
  options: {
    status?: 'pending' | 'completed' | 'missed';
    daysAhead?: number;
  } = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  let query = sql`
    SELECT cd.*, c.claim_number, c.claim_type, c.status as claim_status
    FROM claim_deadlines cd
    JOIN claims c ON cd.claim_id = c.id
    WHERE c.assigned_to = ${memberId}
      AND cd.tenant_id = ${organizationId}
  `;
  
  if (options.status) {
    query = sql`${query} AND cd.status = ${options.status}`;
  }
  
  if (options.daysAhead) {
    query = sql`${query} AND cd.due_date <= CURRENT_DATE + ${options.daysAhead}`;
  }
  
  query = sql`${query} ORDER BY cd.due_date`;
  
  const result = await db.execute(query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get overdue deadlines for organization
 */
export async function getOverdueDeadlines(organizationId: string): Promise<ClaimDeadline[]> {
  const result = await db.execute(sql`
    SELECT * FROM claim_deadlines
    WHERE tenant_id = ${organizationId}
      AND status = 'pending'
      AND is_overdue = TRUE
    ORDER BY days_overdue DESC, priority DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Create deadline for claim
 */
export async function createClaimDeadline(
  claimId: string,
  organizationId: string,
  deadlineName: string,
  deadlineType: string,
  eventDate: Date,
  daysFromEvent: number,
  createdBy: string,
  options: {
    deadlineRuleId?: string;
    businessDaysOnly?: boolean;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  } = {}
): Promise<ClaimDeadline> {
  // Calculate deadline based on business days or calendar days
  const deadlineDate = options.businessDaysOnly
    ? await addBusinessDays(eventDate, daysFromEvent, organizationId)
    : new Date(eventDate.getTime() + daysFromEvent * 24 * 60 * 60 * 1000);
  
  const result = await db.execute(sql`
    INSERT INTO claim_deadlines (
      claim_id, tenant_id, deadline_rule_id, deadline_name, deadline_type,
      event_date, original_deadline, due_date, priority, created_by
    ) VALUES (
      ${claimId}, ${organizationId}, ${options.deadlineRuleId || null},
      ${deadlineName}, ${deadlineType}, ${eventDate}, ${deadlineDate},
      ${deadlineDate}, ${options.priority || 'medium'}, ${createdBy}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Auto-create deadlines based on rules when claim is created
 */
export async function autoCreateClaimDeadlines(
  claimId: string,
  organizationId: string,
  claimType: string,
  priorityLevel: string,
  eventDate: Date,
  createdBy: string
): Promise<ClaimDeadline[]> {
  // Get applicable rules
  const rules = await getApplicableDeadlineRules(organizationId, claimType, priorityLevel);
  
  const deadlines: ClaimDeadline[] = [];
  
  for (const rule of rules) {
    if (rule.eventType === 'claim_created') {
      const deadline = await createClaimDeadline(
        claimId,
        organizationId,
        rule.ruleName,
        'filing',
        eventDate,
        rule.daysFromEvent,
        createdBy,
        {
          deadlineRuleId: rule.id,
          businessDaysOnly: rule.businessDaysOnly,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priority: priorityLevel as any,
        }
      );
      deadlines.push(deadline);
    }
  }
  
  return deadlines;
}

/**
 * Complete a deadline
 */
export async function completeDeadline(
  deadlineId: string,
  completedBy: string,
  notes?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    UPDATE claim_deadlines
    SET status = 'completed',
        completed_at = NOW(),
        completed_by = ${completedBy},
        completion_notes = ${notes || null},
        updated_at = NOW(),
        updated_by = ${completedBy}
    WHERE id = ${deadlineId}
    RETURNING *
  `);
  return result[0];
}

/**
 * Mark deadline as missed (run by scheduled job)
 */
export async function markOverdueDeadlines(): Promise<number> {
  const result = await db.execute(sql`
    SELECT mark_overdue_deadlines() as count
  `);
  return (result[0]?.count as number) || 0;
}

// ============================================================================
// DEADLINE EXTENSIONS QUERIES
// ============================================================================

/**
 * Request deadline extension
 */
export async function requestDeadlineExtension(
  deadlineId: string,
  organizationId: string,
  requestedBy: string,
  requestedDays: number,
  reason: string,
  requiresApproval: boolean = true
): Promise<DeadlineExtension> {
  const result = await db.execute(sql`
    INSERT INTO deadline_extensions (
      deadline_id, tenant_id, requested_by, requested_days,
      request_reason, requires_approval
    ) VALUES (
      ${deadlineId}, ${organizationId}, ${requestedBy}, ${requestedDays},
      ${reason}, ${requiresApproval}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Approve deadline extension
 */
export async function approveDeadlineExtension(
  extensionId: string,
  approvedBy: string,
  daysGranted?: number,
  approvalNotes?: string
): Promise<void> {
  // Get extension and deadline details
  const extensionResult = await db.execute(sql`
    SELECT de.*, cd.due_date, cd.tenant_id
    FROM deadline_extensions de
    JOIN claim_deadlines cd ON de.deadline_id = cd.id
    WHERE de.id = ${extensionId}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extension = extensionResult[0] as any;
  if (!extension) throw new Error('Extension not found');
  
  const granted = daysGranted || extension.requested_days;
  
  // Calculate new deadline
  const currentDeadline = new Date(extension.due_date);
  const newDeadline = new Date(currentDeadline.getTime() + granted * 24 * 60 * 60 * 1000);
  
  // Update extension
  await db.execute(sql`
    UPDATE deadline_extensions
    SET status = 'approved',
        approved_by = ${approvedBy},
        approval_decision_at = NOW(),
        approval_notes = ${approvalNotes || null},
        new_deadline = ${newDeadline},
        days_granted = ${granted}
    WHERE id = ${extensionId}
  `);
  
  // Update claim deadline
  await db.execute(sql`
    UPDATE claim_deadlines
    SET due_date = ${newDeadline},
        status = 'extended',
        extension_count = extension_count + 1,
        total_extension_days = total_extension_days + ${granted},
        last_extension_date = CURRENT_DATE,
        last_extension_reason = ${extension.request_reason},
        updated_at = NOW(),
        updated_by = ${approvedBy}
    WHERE id = ${extension.deadline_id}
  `);
}

/**
 * Deny deadline extension
 */
export async function denyDeadlineExtension(
  extensionId: string,
  deniedBy: string,
  denialNotes?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE deadline_extensions
    SET status = 'denied',
        approved_by = ${deniedBy},
        approval_decision_at = NOW(),
        approval_notes = ${denialNotes || null}
    WHERE id = ${extensionId}
  `);
}

/**
 * Get pending extension requests for approval
 */
export async function getPendingExtensionRequests(
  organizationId: string
): Promise<DeadlineExtension[]> {
  const result = await db.execute(sql`
    SELECT de.*, cd.deadline_name, cd.due_date, c.claim_number
    FROM deadline_extensions de
    JOIN claim_deadlines cd ON de.deadline_id = cd.id
    JOIN claims c ON cd.claim_id = c.id
    WHERE de.tenant_id = ${organizationId}
      AND de.status = 'pending'
      AND de.requires_approval = TRUE
    ORDER BY de.requested_at
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

// ============================================================================
// DEADLINE ALERTS QUERIES
// ============================================================================

/**
 * Create deadline alert
 */
export async function createDeadlineAlert(
  deadlineId: string,
  organizationId: string,
  recipientId: string,
  alertType: string,
  alertTrigger: string,
  deliveryMethod: string,
  options: {
    alertSeverity?: string;
    recipientRole?: string;
    subject?: string;
    message?: string;
    actionUrl?: string;
  } = {}
): Promise<DeadlineAlert> {
  const result = await db.execute(sql`
    INSERT INTO deadline_alerts (
      deadline_id, tenant_id, recipient_id, alert_type, alert_severity,
      alert_trigger, recipient_role, delivery_method, subject, message, action_url
    ) VALUES (
      ${deadlineId}, ${organizationId}, ${recipientId}, ${alertType},
      ${options.alertSeverity || 'info'}, ${alertTrigger},
      ${options.recipientRole || null}, ${deliveryMethod},
      ${options.subject || null}, ${options.message || null},
      ${options.actionUrl || null}
    )
    RETURNING *
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result[0] as any;
}

/**
 * Mark alert as delivered
 */
export async function markAlertDelivered(
  alertId: string,
  deliveryStatus: 'delivered' | 'failed' | 'bounced',
  deliveryError?: string
): Promise<void> {
  await db.execute(sql`
    UPDATE deadline_alerts
    SET delivery_status = ${deliveryStatus},
        delivered_at = CASE WHEN ${deliveryStatus} = 'delivered' THEN NOW() ELSE NULL END,
        delivery_error = ${deliveryError || null}
    WHERE id = ${alertId}
  `);
}

/**
 * Mark alert as viewed
 */
export async function markAlertViewed(alertId: string): Promise<void> {
  await db.execute(sql`
    UPDATE deadline_alerts
    SET viewed_at = NOW()
    WHERE id = ${alertId} AND viewed_at IS NULL
  `);
}

/**
 * Record alert action taken
 */
export async function recordAlertAction(
  alertId: string,
  actionTaken: string
): Promise<void> {
  await db.execute(sql`
    UPDATE deadline_alerts
    SET action_taken = ${actionTaken},
        action_taken_at = NOW(),
        acknowledged_at = COALESCE(acknowledged_at, NOW())
    WHERE id = ${alertId}
  `);
}

/**
 * Get unread alerts for member
 */
export async function getUnreadAlerts(
  memberId: string,
  organizationId: string
): Promise<DeadlineAlert[]> {
  const result = await db.execute(sql`
    SELECT da.*, cd.deadline_name, cd.due_date, c.claim_number
    FROM deadline_alerts da
    JOIN claim_deadlines cd ON da.deadline_id = cd.id
    JOIN claims c ON cd.claim_id = c.id
    WHERE da.recipient_id = ${memberId}
      AND da.tenant_id = ${organizationId}
      AND da.viewed_at IS NULL
      AND da.delivery_method = 'in_app'
    ORDER BY da.sent_at DESC
  `);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Generate alerts for upcoming deadlines (run by scheduled job)
 */
export async function generateUpcomingDeadlineAlerts(
  organizationId: string
): Promise<number> {
  let alertCount = 0;
  
  // Get deadlines due in 3 days (first alert)
  const threeDayResult = await db.execute(sql`
    SELECT cd.id, cd.deadline_name, cd.due_date, c.assigned_to, c.claim_number
    FROM claim_deadlines cd
    JOIN claims c ON cd.claim_id = c.id
    WHERE cd.tenant_id = ${organizationId}
      AND cd.status = 'pending'
      AND cd.days_until_due = 3
      AND NOT EXISTS (
        SELECT 1 FROM deadline_alerts da
        WHERE da.deadline_id = cd.id AND da.alert_trigger = '3_days_before'
      )
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const deadline of threeDayResult as any[]) {
    if (deadline.assigned_to) {
      await createDeadlineAlert(
        deadline.id,
        organizationId,
        deadline.assigned_to,
        'upcoming',
        '3_days_before',
        'in_app',
        {
          alertSeverity: 'info',
          subject: `Deadline approaching: ${deadline.deadline_name}`,
          message: `Claim ${deadline.claim_number} deadline is due in 3 days (${deadline.due_date})`,
          actionUrl: `/claims/${deadline.claim_number}`,
        }
      );
      alertCount++;
    }
  }
  
  // Get deadlines due tomorrow (second alert)
  const oneDayResult = await db.execute(sql`
    SELECT cd.id, cd.deadline_name, cd.due_date, c.assigned_to, c.claim_number
    FROM claim_deadlines cd
    JOIN claims c ON cd.claim_id = c.id
    WHERE cd.tenant_id = ${organizationId}
      AND cd.status = 'pending'
      AND cd.days_until_due = 1
      AND NOT EXISTS (
        SELECT 1 FROM deadline_alerts da
        WHERE da.deadline_id = cd.id AND da.alert_trigger = '1_day_before'
      )
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const deadline of oneDayResult as any[]) {
    if (deadline.assigned_to) {
      await createDeadlineAlert(
        deadline.id,
        organizationId,
        deadline.assigned_to,
        'upcoming',
        '1_day_before',
        'in_app',
        {
          alertSeverity: 'warning',
          subject: `Urgent: ${deadline.deadline_name} due tomorrow`,
          message: `Claim ${deadline.claim_number} deadline is due tomorrow (${deadline.due_date})`,
          actionUrl: `/claims/${deadline.claim_number}`,
        }
      );
      alertCount++;
    }
  }
  
  // Get deadlines due today (critical alert)
  const todayResult = await db.execute(sql`
    SELECT cd.id, cd.deadline_name, cd.due_date, c.assigned_to, c.claim_number
    FROM claim_deadlines cd
    JOIN claims c ON cd.claim_id = c.id
    WHERE cd.tenant_id = ${organizationId}
      AND cd.status = 'pending'
      AND cd.days_until_due = 0
      AND NOT EXISTS (
        SELECT 1 FROM deadline_alerts da
        WHERE da.deadline_id = cd.id AND da.alert_trigger = 'day_of'
      )
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const deadline of todayResult as any[]) {
    if (deadline.assigned_to) {
      await createDeadlineAlert(
        deadline.id,
        organizationId,
        deadline.assigned_to,
        'due_today',
        'day_of',
        'in_app',
        {
          alertSeverity: 'error',
          subject: `URGENT: ${deadline.deadline_name} due TODAY`,
          message: `Claim ${deadline.claim_number} deadline is due today (${deadline.due_date})`,
          actionUrl: `/claims/${deadline.claim_number}`,
        }
      );
      alertCount++;
    }
  }
  
  return alertCount;
}

// ============================================================================
// BUSINESS DAY CALCULATIONS
// ============================================================================

/**
 * Calculate business days between two dates
 */
export async function calculateBusinessDays(
  startDate: Date,
  endDate: Date,
  organizationId?: string
): Promise<number> {
  const result = await db.execute(sql`
    SELECT calculate_business_days(${startDate}, ${endDate}, ${organizationId || null}) as days
  `);
  return (result[0]?.days as number) || 0;
}

/**
 * Add business days to a date
 */
export async function addBusinessDays(
  startDate: Date,
  daysToAdd: number,
  organizationId?: string
): Promise<Date> {
  const result = await db.execute(sql`
    SELECT add_business_days(${startDate}, ${daysToAdd}, ${organizationId || null}) as result_date
  `);
  return result[0]?.result_date as Date;
}

/**
 * Get holidays for date range
 */
export async function getHolidays(
  startDate: Date,
  endDate: Date,
  organizationId?: string
): Promise<Holiday[]> {
  let query = sql`
    SELECT * FROM holiday_calendar
    WHERE holiday_date >= ${startDate}
      AND holiday_date <= ${endDate}
      AND is_observed = TRUE
  `;
  
  if (organizationId) {
    query = sql`${query} AND (tenant_id IS NULL OR tenant_id = ${organizationId})`;
  } else {
    query = sql`${query} AND tenant_id IS NULL`;
  }
  
  query = sql`${query} ORDER BY holiday_date`;
  
  const result = await db.execute(query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

// ============================================================================
// COMPLIANCE & REPORTING
// ============================================================================

/**
 * Get deadline compliance metrics for organization
 */
export async function getDeadlineComplianceMetrics(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  let query = sql`
    SELECT * FROM v_deadline_compliance_metrics
    WHERE tenant_id = ${organizationId}
  `;
  
  if (startDate) {
    query = sql`${query} AND month >= ${startDate}`;
  }
  if (endDate) {
    query = sql`${query} AND month <= ${endDate}`;
  }
  
  query = sql`${query} ORDER BY month DESC`;
  
  const result = await db.execute(query);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get member deadline summary (for dashboard)
 */
export async function getMemberDeadlineSummary(
  memberId: string,
  organizationId: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const result = await db.execute(sql`
    SELECT * FROM v_member_deadline_summary
    WHERE member_id = ${memberId} AND tenant_id = ${organizationId}
  `);
  return result[0] || {
    total_deadlines: 0,
    overdue_count: 0,
    due_soon_count: 0,
    critical_count: 0,
    next_deadline: null,
  };
}

/**
 * Get deadline summary for all claims (dashboard widget)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDeadlineDashboardSummary(organizationId: string): Promise<any> {
  const result = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as active_deadlines,
      COUNT(*) FILTER (WHERE is_overdue = TRUE) as overdue_count,
      COUNT(*) FILTER (WHERE days_until_due <= 3 AND days_until_due >= 0) as due_soon_count,
      COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'pending') as critical_count,
      ROUND(AVG(days_overdue) FILTER (WHERE is_overdue = TRUE), 1) as avg_days_overdue,
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= due_date) as on_time_completed,
      COUNT(*) FILTER (WHERE status IN ('completed', 'missed')) as total_completed
    FROM claim_deadlines
    WHERE tenant_id = ${organizationId}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = result[0] as any;
  return {
    activeDeadlines: parseInt(row.active_deadlines) || 0,
    overdueCount: parseInt(row.overdue_count) || 0,
    dueSoonCount: parseInt(row.due_soon_count) || 0,
    criticalCount: parseInt(row.critical_count) || 0,
    avgDaysOverdue: parseFloat(row.avg_days_overdue) || 0,
    onTimePercentage: row.total_completed > 0 
      ? Math.round((row.on_time_completed / row.total_completed) * 100)
      : 100,
  };
}

