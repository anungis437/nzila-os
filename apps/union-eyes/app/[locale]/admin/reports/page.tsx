/**
 * Admin Metrics Reporting Dashboard
 * 
 * Internal analytics for marketing systems.
 * 
 * Features:
 * - Pilot health trends over time
 * - Case study performance (views, downloads)
 * - Testimonial submission rates
 * - Movement insights participation
 */


export const dynamic = 'force-dynamic';

import { db } from '@/db';
import {
  pilotApplications,
  caseStudies,
  testimonials,
  dataAggregationConsent,
} from '@/db/schema/domains/marketing';
import { gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  MessageSquare,
  Shield,
} from 'lucide-react';

export default async function AdminMetricsReportPage() {
  // Time ranges
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Pilot metrics
  const allPilots = await db.select().from(pilotApplications);
  const recentPilots = await db
    .select()
    .from(pilotApplications)
    .where(gte(pilotApplications.submittedAt, thirtyDaysAgo));

  const activePilots = allPilots.filter((p) => p.status === 'active').length;
  const avgReadiness =
    allPilots.length > 0
      ? Math.round(
          allPilots.reduce((sum, a) => sum + Number(a.readinessScore || 0), 0) /
            allPilots.length
        )
      : 0;

  // Case studies metrics
  const allCaseStudies = await db.select().from(caseStudies);
  const publishedCaseStudies = allCaseStudies.filter(
    (cs) => cs.publishedAt !== null
  );

  // Testimonials metrics
  const allTestimonials = await db.select().from(testimonials);
  const recentTestimonials = await db
    .select()
    .from(testimonials)
    .where(gte(testimonials.createdAt, thirtyDaysAgo));
  
  const approvedTestimonials = allTestimonials.filter(
    (t) => t.approvedAt !== null
  );

  // Movement insights metrics
  const allConsents = await db.select().from(dataAggregationConsent);
  const activeConsents = allConsents.filter((c) => c.consentGiven);
  const recentConsents = allConsents.filter(
    (c) => new Date(c.consentDate) >= thirtyDaysAgo
  );

  const consentAdoptionRate =
    allPilots.length > 0
      ? Math.round((activeConsents.length / allPilots.length) * 100)
      : 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Marketing Metrics</h1>
        <p className="text-muted-foreground mt-2">
          Internal analytics for growth engine performance
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Active Pilots"
          value={activePilots}
          icon={<Users className="h-4 w-4" />}
          trend={recentPilots.length > 0 ? 'up' : 'neutral'}
          trendLabel={`${recentPilots.length} new (30d)`}
        />
        <MetricCard
          label="Published Case Studies"
          value={publishedCaseStudies.length}
          icon={<FileText className="h-4 w-4" />}
          trend="neutral"
          trendLabel={`of ${allCaseStudies.length} total`}
        />
        <MetricCard
          label="Approved Testimonials"
          value={approvedTestimonials.length}
          icon={<MessageSquare className="h-4 w-4" />}
          trend={recentTestimonials.length > 0 ? 'up' : 'neutral'}
          trendLabel={`${recentTestimonials.length} new (30d)`}
        />
        <MetricCard
          label="Data Sharing Adoption"
          value={`${consentAdoptionRate}%`}
          icon={<Shield className="h-4 w-4" />}
          trend={recentConsents.length > 0 ? 'up' : 'neutral'}
          trendLabel={`${activeConsents.length} active`}
        />
      </div>

      {/* Pilot Program Health */}
      <Card>
        <CardHeader>
          <CardTitle>Pilot Program Health</CardTitle>
          <CardDescription>
            Overview of pilot applications and readiness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Readiness Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Average Readiness Score</span>
                <span className="text-2xl font-bold">{avgReadiness}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${avgReadiness}%` }}
                />
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="grid gap-4 md:grid-cols-5">
              <StatusCard
                label="Pending"
                count={allPilots.filter((p) => p.status === 'submitted' || p.status === 'review').length}
                variant="warning"
              />
              <StatusCard
                label="Approved"
                count={allPilots.filter((p) => p.status === 'approved').length}
                variant="success"
              />
              <StatusCard
                label="Active"
                count={activePilots}
                variant="primary"
              />
              <StatusCard
                label="Completed"
                count={allPilots.filter((p) => p.status === 'completed').length}
                variant="secondary"
              />
              <StatusCard
                label="Rejected"
                count={allPilots.filter((p) => p.status === 'declined').length}
                variant="destructive"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Case Studies Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Case Studies Performance</CardTitle>
          <CardDescription>
            Content performance and engagement metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Total Case Studies</div>
              <div className="text-3xl font-bold">{allCaseStudies.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Published</div>
              <div className="text-3xl font-bold">{publishedCaseStudies.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Draft</div>
              <div className="text-3xl font-bold">
                {allCaseStudies.filter((cs) => cs.publishedAt === null).length}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mt-6">
            <div className="text-sm font-medium mb-3">By Category</div>
            <div className="flex flex-wrap gap-2">
              {['grievance-wins', 'organizing-victory', 'system-adoption', 'member-engagement'].map(
                (category) => {
                  const count = allCaseStudies.filter(
                    (cs) => cs.category === category
                  ).length;
                  return (
                    <Badge key={category} variant="outline">
                      {category.replace('-', ' ')}: {count}
                    </Badge>
                  );
                }
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Testimonials Funnel */}
      <Card>
        <CardHeader>
          <CardTitle>Testimonials Funnel</CardTitle>
          <CardDescription>
            Submission to approval workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <FunnelStep
              label="Submitted"
              count={allTestimonials.length}
              percentage={100}
            />
            <FunnelStep
              label="Approved"
              count={approvedTestimonials.length}
              percentage={
                allTestimonials.length > 0
                  ? Math.round(
                      (approvedTestimonials.length / allTestimonials.length) * 100
                    )
                  : 0
              }
            />
            <FunnelStep
              label="Featured"
              count={allTestimonials.filter((t) => t.featured).length}
              percentage={
                approvedTestimonials.length > 0
                  ? Math.round(
                      (allTestimonials.filter((t) => t.featured).length /
                        approvedTestimonials.length) *
                        100
                    )
                  : 0
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Movement Insights Adoption */}
      <Card>
        <CardHeader>
          <CardTitle>Movement Insights Adoption</CardTitle>
          <CardDescription>
            Cross-union data sharing participation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Adoption Rate</span>
                <span className="text-2xl font-bold">{consentAdoptionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${consentAdoptionRate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeConsents.length} of {allPilots.length} pilot organizations opted in
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-sm text-muted-foreground">Active Consents</div>
                <div className="text-3xl font-bold">{activeConsents.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Revoked</div>
                <div className="text-3xl font-bold">
                  {allConsents.filter((c) => !c.consentGiven).length}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">New (30d)</div>
                <div className="text-3xl font-bold">{recentConsents.length}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Metric card with trend indicator
 */
function MetricCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  trendLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{label}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
          <span className="text-xs text-muted-foreground">{trendLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Status card for pilot breakdown
 */
function StatusCard({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'warning' | 'success' | 'primary' | 'secondary' | 'destructive';
}) {
  const variantStyles = {
    warning: 'bg-yellow-50 border-yellow-200',
    success: 'bg-green-50 border-green-200',
    primary: 'bg-blue-50 border-blue-200',
    secondary: 'bg-gray-50 border-gray-200',
    destructive: 'bg-red-50 border-red-200',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{count}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Funnel step visualization
 */
function FunnelStep({
  label,
  count,
  percentage,
}: {
  label: string;
  count: number;
  percentage: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
