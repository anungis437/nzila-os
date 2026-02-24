/**
 * GET PUT DELETE /api/admin/pki/workflows/[id]
 * Migrated to withApi() framework
 */
import { getWorkflow, getWorkflowStatus, advanceWorkflow, cancelWorkflow } from "@/services/pki/workflow-engine";

 
 
 
 
 
 
 
 
 
 
 
 
 
 
 
import { withApi, ApiError, z } from '@/lib/api/framework';

const adminPkiWorkflowsSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    openapi: {
      tags: ['Admin'],
      summary: 'GET [id]',
    },
  },
  async ({ request, params, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          const workflowId = params.id;
          const { searchParams } = new URL(request.url);
          const detailLevel = searchParams.get('detail') || 'status';
          if (detailLevel === 'full') {
            // Get full workflow details
            const workflow = getWorkflow(workflowId);
            if (!workflow) {
              throw ApiError.notFound('Workflow not found'
        );
            }
            return { workflow, };
          } else {
            // Get workflow status summary (default)
            const status = getWorkflowStatus(workflowId);
            return { status, };
          }
  },
);

export const PUT = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: adminPkiWorkflowsSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'PUT [id]',
    },
  },
  async ({ request: _request, params, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query }) => {

          const workflowId = params.id;
          const result = advanceWorkflow(workflowId);
          return { result,
            message: result.isComplete 
              ? 'Workflow completed' 
              : `Advanced to step ${result.currentStep} of ${result.totalSteps}`, };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    body: adminPkiWorkflowsSchema,
    openapi: {
      tags: ['Admin'],
      summary: 'DELETE [id]',
    },
  },
  async ({ request: _request, params, userId, organizationId: _organizationId, user: _user, body, query: _query }) => {
          const { reason } = body;
          const workflowId = params.id;
          // Validate request body
        if (!reason || !userId) {
            throw ApiError.internal('Cancellation reason required'
        );
          }
          cancelWorkflow(workflowId, userId, reason);
          return { message: 'Workflow cancelled successfully', };
  },
);
