
// =====================================================================================
// PKI Workflow Details API - Status, Advance, Cancel
// =====================================================================================
// GET /api/admin/pki/workflows/[id] - Get workflow status
// PUT /api/admin/pki/workflows/[id] - Advance workflow manually (admin)
// DELETE /api/admin/pki/workflows/[id] - Cancel workflow
// =====================================================================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  getWorkflow,
  getWorkflowStatus,
  advanceWorkflow,
  cancelWorkflow,
} from '@/services/pki/workflow-engine';
import { z } from "zod";
import { withAdminAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withAdminAuth(async (request, _context) => {
  try {
      const workflowId = params.id;
      const { searchParams } = new URL(request.url);
      const detailLevel = searchParams.get('detail') || 'status';

      if (detailLevel === 'full') {
        // Get full workflow details
        const workflow = getWorkflow(workflowId);
        
        if (!workflow) {
          return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Workflow not found'
    );
        }

        return NextResponse.json({
          success: true,
          workflow,
        });
      } else {
        // Get workflow status summary (default)
        const status = getWorkflowStatus(workflowId);

        return NextResponse.json({
          success: true,
          status,
        });
      }

    } catch (error) {
return NextResponse.json(
        { error: 'Failed to fetch workflow', details: (error as Error).message },
        { status: 500 }
      );
    }
    })(request, { params });
};


const adminPkiWorkflowsSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});

export const PUT = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withAdminAuth(async (_request, _context) => {
  try {
      const workflowId = params.id;

      const result = advanceWorkflow(workflowId);

      return NextResponse.json({
        success: true,
        result,
        message: result.isComplete 
          ? 'Workflow completed' 
          : `Advanced to step ${result.currentStep} of ${result.totalSteps}`,
      });

    } catch (error) {
return NextResponse.json(
        { error: 'Failed to advance workflow', details: (error as Error).message },
        { status: 500 }
      );
    }
    })(request, { params });
};

export const DELETE = async (request: NextRequest, { params }: { params: { id: string } }) => {
  return withAdminAuth(async (request, context) => {
    const { userId } = context;

  try {
      const workflowId = params.id;
      const body = await request.json();
    // Validate request body
    const validation = adminPkiWorkflowsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { reason } = validation.data;

      if (!reason) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Cancellation reason required'
    );
      }

      cancelWorkflow(workflowId, userId as string, reason);

      return NextResponse.json({
        success: true,
        message: 'Workflow cancelled successfully',
      });

    } catch (error) {
return NextResponse.json(
        { error: 'Failed to cancel workflow', details: (error as Error).message },
        { status: 500 }
      );
    }
    })(request, { params });
};
