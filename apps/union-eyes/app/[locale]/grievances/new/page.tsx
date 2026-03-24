/**
 * Grievance Filing Page
 *
 * Multi-step guided intake for filing a new grievance.
 * Accessible from /grievances/new — union-aware, guided experience.
 *
 * @module app/grievances/new/page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GrievanceIntakeForm, GrievanceFormData } from '@/components/grievances/grievance-intake-form';
import { logger } from '@/lib/logger';

export default function GrievanceNewPage() {
  const router = useRouter();

  const handleSubmit = async (
    data: GrievanceFormData
  ): Promise<{ grievanceNumber: string; status: string }> => {
    const response = await fetch('/api/grievances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.grievanceType,
        priority: data.urgency,
        title: data.title,
        description: data.description,
        grievantName: data.memberName,
        grievantEmail: data.memberEmail,
        employerName: data.employerName,
        workplaceName: data.workplaceName,
        incidentDate: data.issueDate?.toISOString(),
        location: data.location,
        desiredOutcome: data.desiredResolution,
        metadata: {
          memberPhone: data.memberPhone,
          memberNumber: data.memberNumber,
          localChapter: data.localChapter,
          department: data.department,
          branch: data.branch,
          supervisorName: data.supervisorName,
          flags: {
            workplaceSafety: data.workplaceSafetyFlag,
            harassment: data.harassmentFlag,
            discrimination: data.discriminationFlag,
            accommodation: data.accommodationFlag,
          },
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message ?? 'Failed to file grievance');
    }

    const result = await response.json();
    logger.info('Grievance filed', { grievanceNumber: result.data?.grievanceNumber });
    return {
      grievanceNumber: result.data?.grievanceNumber ?? 'GR-PENDING',
      status: result.data?.status ?? 'filed',
    };
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">File a Grievance</h1>
          <p className="text-muted-foreground text-sm">
            Complete the steps below to file your grievance. Your information is kept confidential.
          </p>
        </div>
      </div>

      <GrievanceIntakeForm
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </div>
  );
}
