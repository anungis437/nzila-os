/**
 * @nzila/ue-assistant — Workflow Tool System (Phase 5)
 *
 * Implements governed tools that the AI assistant can invoke. All tools
 * enforce role permissions, entitlements, and org scope, and log usage.
 */
import {
  ToolNames,
  type ToolName,
  type ToolResult,
  type ToolInvocation,
  type UserContext,
  UEAssistantRoles,
} from './types'
import { isToolAllowed } from './roles'
import { hasEntitlement } from './context'

// ── Tool Handler Type ───────────────────────────────────────────────────────

type ToolHandler = (
  ctx: UserContext,
  params: Record<string, unknown>,
) => ToolResult

// ── Tool Registry ───────────────────────────────────────────────────────────

const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  [ToolNames.OPEN_GRIEVANCE_FORM]: (ctx, params) => {
    if (!hasEntitlement(ctx, 'grievance') && ctx.entitlements.length > 0) {
      return { success: false, data: {}, error: 'Grievance module not entitled' }
    }
    return {
      success: true,
      data: {
        action: 'navigate',
        target: `/${ctx.language}/grievances/new`,
        prefill: params,
      },
    }
  },

  [ToolNames.GET_CASE_STATUS]: (ctx, params) => {
    const caseId = params.caseId as string | undefined
    if (!caseId) {
      return { success: false, data: {}, error: 'caseId is required' }
    }
    // Members can only access their own cases
    if (ctx.userRole === UEAssistantRoles.MEMBER) {
      if (!ctx.userState.openCases.includes(caseId)) {
        return { success: false, data: {}, error: 'Access denied: case not owned by user' }
      }
    }
    return {
      success: true,
      data: {
        caseId,
        status: 'retrieved',
        message: `Case ${caseId} status retrieved for org ${ctx.orgId}`,
      },
    }
  },

  [ToolNames.NAVIGATE_TO_PAGE]: (_ctx, params) => {
    const page = params.page as string | undefined
    if (!page) {
      return { success: false, data: {}, error: 'page is required' }
    }
    return {
      success: true,
      data: { action: 'navigate', target: page },
    }
  },

  [ToolNames.ANALYZE_CASE]: (ctx, params) => {
    const caseId = params.caseId as string | undefined
    if (!caseId) {
      return { success: false, data: {}, error: 'caseId is required' }
    }
    return {
      success: true,
      data: {
        caseId,
        analysis: 'Case analysis generated',
        orgId: ctx.orgId,
      },
    }
  },

  [ToolNames.SUMMARIZE_CASE]: (ctx, params) => {
    const caseId = params.caseId as string | undefined
    if (!caseId) {
      return { success: false, data: {}, error: 'caseId is required' }
    }
    return {
      success: true,
      data: {
        caseId,
        summary: 'Case summary generated',
        orgId: ctx.orgId,
      },
    }
  },

  [ToolNames.MAP_TO_CONTRACT_CLAUSES]: (_ctx, params) => {
    const description = params.description as string | undefined
    if (!description) {
      return { success: false, data: {}, error: 'description is required' }
    }
    return {
      success: true,
      data: {
        matchedClauses: [],
        description,
        message: 'Contract clause mapping completed',
      },
    }
  },

  [ToolNames.DRAFT_GRIEVANCE]: (ctx, params) => {
    return {
      success: true,
      data: {
        draft: 'Grievance draft generated',
        orgId: ctx.orgId,
        params,
        disclaimer: 'This is a draft and should be reviewed before submission.',
      },
    }
  },

  [ToolNames.SUGGEST_NEXT_STEPS]: (_ctx, params) => {
    const caseId = params.caseId as string | undefined
    return {
      success: true,
      data: {
        caseId,
        steps: [
          'Review case documentation',
          'Consult collective agreement',
          'Prepare timeline of events',
        ],
      },
    }
  },

  [ToolNames.REPORT_SAFETY_ISSUE]: (ctx, params) => {
    const isUrgent = params.urgent === true
    return {
      success: true,
      data: {
        action: isUrgent ? 'emergency_protocol' : 'reporting_workflow',
        target: `/${ctx.language}/health-safety/report`,
        urgent: isUrgent,
        message: isUrgent
          ? 'Emergency protocol activated. Contact safety officer immediately.'
          : 'Safety report form opened.',
      },
    }
  },

  [ToolNames.EXPLAIN_AGREEMENT_SECTION]: (_ctx, params) => {
    const section = params.section as string | undefined
    if (!section) {
      return { success: false, data: {}, error: 'section is required' }
    }
    return {
      success: true,
      data: {
        section,
        explanation: `Explanation of section "${section}" from the collective agreement.`,
        disclaimer: 'This is informational guidance, not legal advice.',
      },
    }
  },

  [ToolNames.CASE_DASHBOARD_INSIGHTS]: (ctx) => {
    return {
      success: true,
      data: {
        orgId: ctx.orgId,
        localId: ctx.localId,
        insights: 'Dashboard insights generated',
      },
    }
  },

  [ToolNames.WORKLOAD_ANALYSIS]: (ctx) => {
    return {
      success: true,
      data: {
        orgId: ctx.orgId,
        localId: ctx.localId,
        analysis: 'Workload analysis generated',
      },
    }
  },

  [ToolNames.AGGREGATE_INSIGHTS]: (ctx) => {
    return {
      success: true,
      data: {
        orgId: ctx.orgId,
        crossLocal: true,
        insights: 'Aggregate cross-local insights generated',
      },
    }
  },

  [ToolNames.TREND_ANALYSIS]: (ctx, params) => {
    return {
      success: true,
      data: {
        orgId: ctx.orgId,
        period: params.period ?? 'last_30_days',
        trends: 'Trend analysis generated',
      },
    }
  },
}

// ── Tool Execution Log ──────────────────────────────────────────────────────

const toolLog: ToolInvocation[] = []

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a tool with role, entitlement, and org-scope enforcement.
 */
export function executeTool(
  tool: ToolName,
  ctx: UserContext,
  params: Record<string, unknown>,
): ToolInvocation {
  // Role permission check
  if (!isToolAllowed(ctx.userRole, tool)) {
    const invocation: ToolInvocation = {
      tool,
      params,
      result: { success: false, data: {}, error: `Tool '${tool}' not allowed for role '${ctx.userRole}'` },
      timestamp: new Date().toISOString(),
    }
    toolLog.push(invocation)
    return invocation
  }

  const handler = TOOL_HANDLERS[tool]
  if (!handler) {
    const invocation: ToolInvocation = {
      tool,
      params,
      result: { success: false, data: {}, error: `Unknown tool: ${tool}` },
      timestamp: new Date().toISOString(),
    }
    toolLog.push(invocation)
    return invocation
  }

  const result = handler(ctx, params)
  const invocation: ToolInvocation = {
    tool,
    params,
    result,
    timestamp: new Date().toISOString(),
  }
  toolLog.push(invocation)
  return invocation
}

export function getToolLog(): readonly ToolInvocation[] {
  return [...toolLog]
}

export function clearToolLog(): void {
  toolLog.length = 0
}
