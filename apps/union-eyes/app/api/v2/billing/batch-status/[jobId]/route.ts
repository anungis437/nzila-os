import { NextResponse } from 'next/server';
/**
 * GET /api/billing/batch-status/[jobId]
 * Migrated to withApi() framework
 */
 
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    openapi: {
      tags: ['Billing'],
      summary: 'GET [jobId]',
    },
  },
  async ({ request: _request, params, userId: _userId, organizationId, user: _user, body: _body, query: _query }) => {

          const jobId = params.jobId;
          // Query newsletter campaigns to get batch job status
          // Job ID format: "campaign-{campaignId}" or "batch-{timestamp}"
          let status = 'processing';
          let progress = {
            total: 0,
            sent: 0,
            failed: 0,
            pending: 0,
          };
          let startedAt = new Date().toISOString();
          let estimatedCompletion: string | null = null;
          let errors: Array<Record<string, unknown>> = [];
          // Check if this is a newsletter campaign job
          if (jobId.startsWith('campaign-')) {
            const campaignId = jobId.replace('campaign-', '');
            const { newsletterCampaigns, newsletterRecipients } = await import('@/db/schema');
            const { db } = await import('@/db');
            const { and, eq, sql } = await import('drizzle-orm');
            // Get campaign details
            const [campaign] = await db
              .select()
              .from(newsletterCampaigns)
              .where(
                and(
                  eq(newsletterCampaigns.id, campaignId),
                  eq(newsletterCampaigns.organizationId, organizationId!)
                )
              )
              .limit(1);
            if (campaign) {
              // Get recipient stats
              const [stats] = await db
                .select({
                  total: sql<number>`count(*)::int`,
                  sent: sql<number>`count(*) filter (where status = 'sent')::int`,
                  failed: sql<number>`count(*) filter (where status = 'failed')::int`,
                  pending: sql<number>`count(*) filter (where status = 'pending')::int`,
                })
                .from(newsletterRecipients)
                .where(eq(newsletterRecipients.campaignId, campaignId));
              progress = {
                total: stats?.total || 0,
                sent: stats?.sent || 0,
                failed: stats?.failed || 0,
                pending: stats?.pending || 0,
              };
              status = campaign.status === 'sent' ? 'completed' : 
                       campaign.status === 'sending' ? 'processing' :
                       campaign.status === 'paused' ? 'paused' :
                       campaign.status === 'cancelled' ? 'failed' : 'queued';
              startedAt = campaign.sentAt?.toISOString() || campaign.updatedAt?.toISOString() || startedAt;
              // Estimate completion (assume 100 emails per minute)
              if (progress.pending > 0 && status === 'processing') {
                const remainingMinutes = Math.ceil(progress.pending / 100);
                estimatedCompletion = new Date(Date.now() + remainingMinutes * 60000).toISOString();
              }
              // Get failed recipients as errors
              if (progress.failed > 0) {
                const failedRecipients = await db
                  .select({
                    email: newsletterRecipients.email,
                    error: newsletterRecipients.errorMessage,
                  })
                  .from(newsletterRecipients)
                  .where(
                    and(
                      eq(newsletterRecipients.campaignId, campaignId),
                      eq(newsletterRecipients.status, 'failed')
                    )
                  )
                  .limit(10);
                errors = failedRecipients.map(r => ({
                  recipientEmail: r.email,
                  error: r.error || 'Unknown error',
                }));
              }
            }
          }
          return NextResponse.json({
            jobId,
            status,
            progress,
            startedAt,
            estimatedCompletion,
            errors,
          });
  },
);
